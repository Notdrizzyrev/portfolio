require('dotenv').config();
const express = require('express');
const cors = require('cors');
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 5678;
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1h

app.use(cors());
app.use(express.json());

const getCached = (k) => {
    const c = cache.get(k);
    return c && Date.now() - c.t < CACHE_TTL ? c.v : null;
};
const setCache = (k, v) => cache.set(k, { v, t: Date.now() });

app.get('/search', async (req, res) => {
    const q = req.query.query || '';
    if (!q) return res.status(400).json({ error: 'Missing query' });
    try {
        const results = await scraper.searchAnime(q);
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/anime/:id', async (req, res) => {
    try {
        const cached = getCached(`anime:${req.params.id}`);
        if (cached) return res.json(cached);
        const details = await scraper.getAnimeDetails(req.params.id);
        if (!details) return res.status(404).json({ error: 'Not found' });
        setCache(`anime:${req.params.id}`, details);
        res.json(details);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/dub-check', async (req, res) => {
    const { show_id } = req.query;
    if (!show_id) return res.status(400).json({ error: 'Missing show_id' });
    try {
        const details = await scraper.getAnimeDetails(show_id);
        res.json({
            has_dub: (details?.episodes_dub || 0) > 0,
            episodes_dub: details?.episodes_dub || 0,
        });
    } catch (e) {
        res.status(500).json({ error: e.message, has_dub: false, episodes_dub: 0 });
    }
});

app.get('/episodes/:id', async (req, res) => {
    const { id } = req.params;
    const mode = req.query.mode === 'dub' ? 'dub' : 'sub';
    if (!id) return res.status(400).json({ error: 'Missing ID' });
    try {
        const key = `ep:${id}:${mode}`;
        let episodes = getCached(key);
        if (!episodes) {
            episodes = await scraper.getEpisodesList(id, mode);
            if (episodes.length > 0) setCache(key, episodes);
        }
        res.json({ mode, episodes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/episode_url', async (req, res) => {
    const { show_id, ep_no, quality = 'best', mode: m } = req.query;
    const mode = m === 'dub' ? 'dub' : 'sub';
    if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing params' });
    try {
        const url = await scraper.getEpisodeUrl(show_id, ep_no, mode, quality);
        if (!url) return res.status(404).json({ error: 'Not found' });
        res.json({ episode_url: url, mode });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/play', async (req, res) => {
    const { show_id, ep_no, quality = 'best', mode: m } = req.query;
    const mode = m === 'dub' ? 'dub' : 'sub';
    if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing params' });
    try {
        const url = await scraper.getEpisodeUrl(show_id, ep_no, mode, quality);
        if (!url) return res.status(404).json({ error: 'Not found' });
        res.redirect(url);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.options('/play', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers['origin'] || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.sendStatus(204);
});

app.get('/qualities', async (req, res) => {
    const { show_id, ep_no, mode: m } = req.query;
    const mode = m === 'dub' ? 'dub' : 'sub';
    if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing params' });
    try {
        const qs = await scraper.getAvailableQualities(show_id, ep_no, mode);
        res.json({ qualities: qs });
    } catch (e) {
        res.status(500).json({ error: e.message, qualities: [] });
    }
});

app.get('/episode_info', async (req, res) => {
    const id = req.query.show_id;
    const epNo = req.query.ep_no;
    if (!id || !epNo) return res.status(400).json({ error: 'Missing show_id or ep_no' });
    try {
        const info = await scraper.getEpisodeInfo(id, epNo);
        if (!info) return res.status(404).json({ error: 'Episode info not found' });
        res.json(info);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/thumbnails', async (req, res) => {
    const ids = req.body?.ids || req.body?.mal_ids;
    if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ error: "Missing 'ids' array in request body" });
    }
    const results = {};
    for (const id of ids) {
        try {
            const details = await scraper.getAnimeDetails(id);
            if (details?.thumbnail_url) results[id] = details.thumbnail_url;
        } catch { /* swallow */ }
    }
    res.json(results);
});

app.get('/', (req, res) => {
    res.json({
        title: 'AnimeVault API',
        status: 'running',
        version: '3.1 (allanime tobeparsed fix)',
        source: 'AllAnime (allanime.day)',
        endpoints: [
            '/search?query=<query>',
            '/anime/<id>',
            '/episodes/<id>?mode=sub|dub',
            '/episode_url?show_id=<id>&ep_no=<ep>&quality=<q>&mode=sub|dub',
            '/play?show_id=<id>&ep_no=<ep>&quality=<q>&mode=sub|dub',
            '/qualities?show_id=<id>&ep_no=<ep>&mode=sub|dub',
            '/episode_info?show_id=<id>&ep_no=<ep_no>',
            '/thumbnails (POST with ids array)',
            '/dub-check?show_id=<id>',
        ],
    });
});

app.listen(PORT, () => {
    console.log(`AnimeVault running on port ${PORT}`);
    console.log(`Source: AllAnime (allanime.day)`);
});