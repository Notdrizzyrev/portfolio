require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 5678;

// Episode cache: { "showId:mode": [episodes], timestamp: Date }
const episodeCache = new Map();
const CACHE_TTL = 3600000; // 1 hour

app.use(cors());
app.use(express.json());

// Cache helper
function getCachedEpisodes(showId, mode) {
    const key = `${showId}:${mode}`;
    const cached = episodeCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.episodes;
    }
    return null;
}

function setCachedEpisodes(showId, mode, episodes) {
    const key = `${showId}:${mode}`;
    episodeCache.set(key, { episodes, timestamp: Date.now() });
}

// Routes
app.get('/search', async (req, res) => {
    const query = req.query.query || '';
    if (!query) return res.status(400).json({ error: "Missing query parameter" });

    try {
        const results = await scraper.searchAnime(query);
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/anime/:id', async (req, res) => {
    try {
        const id = req.params.id;
        if (!id) return res.status(400).json({ error: "Invalid ID format" });

        const details = await scraper.getAnimeDetails(id);

        if (!details) {
            return res.status(404).json({ error: "Anime not found on Allanime" });
        }

        res.json(details);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/dub-check', async (req, res) => {
    const { show_id } = req.query;
    if (!show_id) return res.status(400).json({ error: "Missing show_id" });

    try {
        const details = await scraper.getAnimeDetails(show_id);
        if (!details) return res.status(404).json({ error: "Anime not found", has_dub: false, episodes_dub: 0 });
        res.json({
            has_dub: (details.episodes_dub || 0) > 0,
            episodes_dub: details.episodes_dub || 0
        });
    } catch (e) {
        res.status(500).json({ error: e.message, has_dub: false, episodes_dub: 0 });
    }
});

app.get('/episodes/:id', async (req, res) => {
    const id = req.params.id;
    const mode = req.query.mode === 'dub' ? 'dub' : 'sub';

    if (!id) return res.status(400).json({ error: "Missing ID" });

    try {
        // Check cache first
        let episodes = getCachedEpisodes(id, mode);
        if (!episodes) {
            episodes = await scraper.getEpisodesList(id, mode);
            if (episodes.length > 0) {
                setCachedEpisodes(id, mode, episodes);
            }
        }
        res.json({ mode, episodes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/episode_url', async (req, res) => {
    const id = req.query.show_id;
    const epNo = req.query.ep_no;
    const quality = req.query.quality || 'best';
    const mode = req.query.mode === 'dub' ? 'dub' : 'sub';

    if (!id || !epNo) return res.status(400).json({ error: "Missing show_id or ep_no" });

    try {
        const url = await scraper.getEpisodeUrl(id, epNo, mode, quality);
        if (!url) return res.status(404).json({ error: "Episode not found or URL not available" });
        res.json({ episode_url: url, mode });
    } catch (e) {
        const status = e.message && e.message.includes('NEED_CAPTCHA') ? 503 : 500;
        res.status(status).json({ error: e.message });
    }
});

// Stream endpoint with proper headers for all video players
app.get('/play', async (req, res) => {
    const id = req.query.show_id;
    const epNo = req.query.ep_no;
    const quality = req.query.quality || 'best';
    const mode = req.query.mode === 'dub' ? 'dub' : 'sub';

    if (!id || !epNo) return res.status(400).json({ error: "Missing show_id or ep_no" });

    try {
        const url = await scraper.getEpisodeUrl(id, epNo, mode, quality);
        if (!url) return res.status(404).json({ error: "Episode not found or URL not available" });

        const range = req.headers.range;
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Referer': 'https://allmanga.to'
        };
        if (range) {
            headers['Range'] = range;
        }

        const videoResp = await axios.get(url, {
            headers,
            responseType: 'stream',
            timeout: 15000
        });

        res.setHeader('Content-Type', 'video/mp4');
        if (req.query.download === '1') {
            res.setHeader('Content-Disposition', `attachment; filename="Anime_Episode_${id}_${epNo}.mp4"`);
        } else {
            res.setHeader('Content-Disposition', 'inline');
        }
        if (videoResp.headers['content-length']) {
            res.setHeader('Content-Length', videoResp.headers['content-length']);
        }
        if (videoResp.headers['content-range']) {
            res.setHeader('Content-Range', videoResp.headers['content-range']);
        }
        if (videoResp.headers['accept-ranges']) {
            res.setHeader('Accept-Ranges', videoResp.headers['accept-ranges']);
        }
        res.status(videoResp.status);

        videoResp.data.pipe(res);

        res.on('close', () => {
            videoResp.data.destroy();
        });

    } catch (e) {
        if (!res.headersSent) {
            const status = e.message && e.message.includes('NEED_CAPTCHA') ? 503 : 500;
            res.status(status).json({ error: e.message });
        }
    }
});

app.get('/qualities', async (req, res) => {
    const id = req.query.show_id;
    const epNo = req.query.ep_no;
    const mode = req.query.mode === 'dub' ? 'dub' : 'sub';

    if (!id || !epNo) return res.status(400).json({ error: "Missing show_id or ep_no" });

    try {
        const qualities = await scraper.getAvailableQualities(id, epNo, mode);
        res.json({ qualities });
    } catch (e) {
        res.status(500).json({ error: e.message, qualities: [] });
    }
});

app.get('/episode_info', async (req, res) => {
    const id = req.query.show_id;
    const epNo = req.query.ep_no;

    if (!id || !epNo) return res.status(400).json({ error: "Missing show_id or ep_no" });

    try {
        const info = await scraper.getEpisodeInfo(id, epNo);
        if (!info) return res.status(404).json({ error: "Episode info not found" });
        res.json(info);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/thumbnails', async (req, res) => {
    try {
        const { ids } = req.body;
        const inputIds = ids || req.body.mal_ids;

        if (!inputIds || !Array.isArray(inputIds)) {
            return res.status(400).json({ error: "Missing 'ids' list in request body" });
        }

        const results = {};

        for (const id of inputIds) {
            try {
                const details = await scraper.getAnimeDetails(id);
                if (details && details.thumbnail_url) {
                    results[id] = details.thumbnail_url;
                }
            } catch (err) {
                // Ignore individual failures
            }
        }

        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/', (req, res) => {
    res.json({
        title: "Anime API (Node.js)",
        status: "running",
        source: "Allanime Direct",
        version: "2.0 (Fixed)",
        fixes: [
            "Episode string formatting for new anime (tries 1, 1.0, 01 formats)",
            "Flexible provider regex (handles sourceUrl/sourceName in any order)",
            "Increased timeouts (7s per provider, 8s per request)",
            "Episode list caching (1 hour TTL)",
            "Better error handling for NEED_CAPTCHA"
        ],
        available_endpoints: [
            "/search?query=<query>",
            "/anime/<id>",
            "/thumbnails (POST with {'ids': ['id1', 'id2', ...]})",
            "/episodes/<id>?mode=<sub|dub>",
            "/episode_info?show_id=<id>&ep_no=<ep_no>",
            "/episode_url?show_id=<id>&ep_no=<ep_no>&quality=<quality>&mode=<sub|dub>",
            "/play?show_id=<id>&ep_no=<ep_no>&quality=<quality>&mode=<sub|dub>",
            "/qualities?show_id=<id>&ep_no=<ep_no>&mode=<sub|dub>"
        ]
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} using Allanime Direct Mode (v2.0 Fixed)`);
});
