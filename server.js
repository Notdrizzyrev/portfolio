require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 5678;

// ⚡ MULTI-LEVEL CACHE
const caches = {
    episodes: new Map(),
    search: new Map(),
    details: new Map(),
    qualities: new Map()
};

const TTL = { episodes: 3600000, search: 1800000, details: 7200000, qualities: 600000 };

function getCache(type, key) {
    const c = caches[type].get(key);
    return c && Date.now() - c.ts < TTL[type] ? c.data : null;
}

function setCache(type, key, data) {
    caches[type].set(key, { data, ts: Date.now() });
}

// ⚡ MIDDLEWARE
app.use(compression());
app.use(cors({ maxAge: 86400 }));
app.use(express.json({ limit: '1mb' }));

// ⚡ ROUTES
app.get('/search', async (req, res) => {
    const q = req.query.query || '';
    if (!q || q.length < 2) return res.status(400).json({ error: "Min 2 chars" });
    
    const key = `search:${q}`;
    let result = getCache('search', key);
    if (result) return res.json(result);

    try {
        result = await scraper.searchAnime(q);
        setCache('search', key, result);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/anime/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Invalid ID" });

    const key = `details:${id}`;
    let result = getCache('details', key);
    if (result) return res.json(result);

    try {
        result = await scraper.getAnimeDetails(id);
        if (!result) return res.status(404).json({ error: "Not found" });
        setCache('details', key, result);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/dub-check', async (req, res) => {
    const { show_id } = req.query;
    if (!show_id) return res.status(400).json({ error: "Missing show_id" });

    const key = `details:${show_id}`;
    let details = getCache('details', key);

    try {
        if (!details) {
            details = await scraper.getAnimeDetails(show_id);
            if (details) setCache('details', key, details);
        }
        res.json({
            has_dub: (details?.episodes_dub || 0) > 0,
            episodes_dub: details?.episodes_dub || 0
        });
    } catch (e) {
        res.status(500).json({ error: e.message, has_dub: false });
    }
});

app.get('/episodes/:id', async (req, res) => {
    const { id } = req.params;
    const mode = req.query.mode === 'dub' ? 'dub' : 'sub';
    if (!id) return res.status(400).json({ error: "Missing ID" });

    const key = `ep:${id}:${mode}`;
    let episodes = getCache('episodes', key);
    if (episodes) return res.json({ mode, episodes });

    try {
        episodes = await scraper.getEpisodesList(id, mode);
        if (episodes.length > 0) setCache('episodes', key, episodes);
        res.json({ mode, episodes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/episode_url', async (req, res) => {
    const { show_id, ep_no, quality = 'best', mode: rawMode } = req.query;
    const mode = rawMode === 'dub' ? 'dub' : 'sub';

    if (!show_id || !ep_no) return res.status(400).json({ error: "Missing params" });

    try {
        const url = await scraper.getEpisodeUrl(show_id, ep_no, mode, quality);
        if (!url) return res.status(404).json({ error: "Episode not found" });
        res.json({ episode_url: url, mode });
    } catch (e) {
        res.status(e.message?.includes('CAPTCHA') ? 503 : 500).json({ error: e.message });
    }
});

app.get('/play', async (req, res) => {
    const { show_id, ep_no, quality = 'best', mode: rawMode } = req.query;
    const mode = rawMode === 'dub' ? 'dub' : 'sub';

    if (!show_id || !ep_no) return res.status(400).json({ error: "Missing params" });

    try {
        const url = await scraper.getEpisodeUrl(show_id, ep_no, mode, quality);
        if (!url) return res.status(404).json({ error: "Not found" });

        const axios = require('axios');
        const videoResp = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
                'Referer': 'https://allmanga.to',
                ...(req.headers.range && { 'Range': req.headers.range })
            },
            responseType: 'stream',
            timeout: 15000
        });

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', req.query.download === '1' 
            ? `attachment; filename="ep_${ep_no}.mp4"` 
            : 'inline');
        
        if (videoResp.headers['content-length']) res.setHeader('Content-Length', videoResp.headers['content-length']);
        if (videoResp.headers['content-range']) res.setHeader('Content-Range', videoResp.headers['content-range']);
        if (videoResp.headers['accept-ranges']) res.setHeader('Accept-Ranges', videoResp.headers['accept-ranges']);

        res.status(videoResp.status);
        videoResp.data.pipe(res);
        res.on('close', () => videoResp.data.destroy());
    } catch (e) {
        if (!res.headersSent) res.status(500).json({ error: e.message });
    }
});

app.get('/qualities', async (req, res) => {
    const { show_id, ep_no, mode: rawMode } = req.query;
    const mode = rawMode === 'dub' ? 'dub' : 'sub';

    if (!show_id || !ep_no) return res.status(400).json({ error: "Missing params" });

    const key = `qualities:${show_id}:${ep_no}:${mode}`;
    let qualities = getCache('qualities', key);
    if (qualities) return res.json({ qualities });

    try {
        qualities = await scraper.getAvailableQualities(show_id, ep_no, mode);
        if (qualities.length > 0) setCache('qualities', key, qualities);
        res.json({ qualities });
    } catch (e) {
        res.status(500).json({ error: e.message, qualities: [] });
    }
});

app.get('/episode_info', async (req, res) => {
    const { show_id, ep_no } = req.query;
    if (!show_id || !ep_no) return res.status(400).json({ error: "Missing params" });

    try {
        const info = await scraper.getEpisodeInfo(show_id, ep_no);
        if (!info) return res.status(404).json({ error: "Not found" });
        res.json(info);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/thumbnails', async (req, res) => {
    const ids = req.body?.ids || req.body?.mal_ids;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "Missing 'ids' array" });

    const results = {};
    await Promise.allSettled(ids.map(async (id) => {
        try {
            const details = await scraper.getAnimeDetails(id);
            if (details?.thumbnail_url) results[id] = details.thumbnail_url;
        } catch {}
    }));

    res.json(results);
});

app.get('/', (req, res) => {
    res.json({
        title: "Anime API (TURBO)",
        status: "running",
        version: "3.0 ULTRA-FAST",
        features: [
            "Multi-level caching (episodes, search, details, qualities)",
            "Gzip compression",
            "Parallel provider fetching",
            "Smart timeout management",
            "Response limiting"
        ],
        endpoints: [
            "/search?query=<q>",
            "/anime/<id>",
            "/episodes/<id>?mode=<sub|dub>",
            "/episode_url?show_id=<id>&ep_no=<no>",
            "/play?show_id=<id>&ep_no=<no>",
            "/qualities?show_id=<id>&ep_no=<no>",
            "/episode_info?show_id=<id>&ep_no=<no>",
            "/thumbnails (POST)"
        ]
    });
});

app.listen(PORT, () => {
    console.log(`⚡ TURBO AnimeVault running on port ${PORT}`);
});
