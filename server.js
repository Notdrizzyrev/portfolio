require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 5678;
const SELF = process.env.SELF_URL || `http://localhost:${PORT}`;

// Cache configuration
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Video headers for streaming
const VIDEO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'video',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
};

// Middleware
app.use(cors());
app.use(express.json());

// Cache utilities
const getCached = (k) => {
  const c = cache.get(k);
  return c && Date.now() - c.t < CACHE_TTL ? c.v : null;
};

const setCache = (k, v) => cache.set(k, { v, t: Date.now() });

// ── SEARCH ────────────────────────────────────────────────────────────────────

app.get('/search', async (req, res) => {
  const q = req.query.query || '';
  if (!q) return res.status(400).json({ error: 'Missing query' });
  try {
    const results = await scraper.searchAnime(q);
    res.json(results);
  } catch (e) {
    console.error('[search] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── ANIME DETAILS ─────────────────────────────────────────────────────────────

app.get('/anime/:id', async (req, res) => {
  try {
    const cached = getCached(`anime:${req.params.id}`);
    if (cached) return res.json(cached);

    const details = await scraper.getAnimeDetails(req.params.id);
    if (!details) return res.status(404).json({ error: 'Anime not found' });

    setCache(`anime:${req.params.id}`, details);
    res.json(details);
  } catch (e) {
    console.error('[anime] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── DUB CHECK ─────────────────────────────────────────────────────────────────

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
    console.error('[dub-check] Error:', e.message);
    res.status(500).json({ error: e.message, has_dub: false, episodes_dub: 0 });
  }
});

// ── EPISODES ──────────────────────────────────────────────────────────────────

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
    console.error('[episodes] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── EPISODE INFO ──────────────────────────────────────────────────────────────

app.get('/episode_info', async (req, res) => {
  const id = req.query.show_id;
  const epNo = req.query.ep_no;
  if (!id || !epNo) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const info = await scraper.getEpisodeInfo(id, epNo);
    if (!info) return res.status(404).json({ error: 'Episode info not found' });
    res.json(info);
  } catch (e) {
    console.error('[episode_info] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── EPISODE URL ───────────────────────────────────────────────────────────────

app.get('/episode_url', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: m } = req.query;
  const mode = m === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing params' });
  try {
    const url = await scraper.getEpisodeUrl(show_id, ep_no, mode, quality);
    if (!url) return res.status(404).json({ error: 'Episode URL not found' });
    res.json({ episode_url: url, mode });
  } catch (e) {
    console.error('[episode_url] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── PLAY (REDIRECT) ───────────────────────────────────────────────────────────

app.get('/play', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: m } = req.query;
  const mode = m === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing params' });
  try {
    const url = await scraper.getEpisodeUrl(show_id, ep_no, mode, quality);
    if (!url) return res.status(404).json({ error: 'Episode not found' });
    res.redirect(url);
  } catch (e) {
    console.error('[play] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── PLAY OPTIONS (CORS PREFLIGHT) ─────────────────────────────────────────────

app.options('/play', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers['origin'] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});

// ── QUALITIES ─────────────────────────────────────────────────────────────────

app.get('/qualities', async (req, res) => {
  const { show_id, ep_no, mode: rawMode } = req.query;
  const mode = rawMode === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const qs = await scraper.getAvailableQualities(show_id, ep_no, mode);
    res.json({ qualities: qs });
  } catch (e) {
    console.error('[qualities] Error:', e.message);
    res.status(500).json({ error: e.message, qualities: [] });
  }
});

// ── THUMBNAILS (BATCH) ────────────────────────────────────────────────────────

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
    } catch (e) {
      console.warn(`[thumbnails] Failed for id ${id}:`, e.message);
    }
  }
  res.json(results);
});

// ── HLS PROXY (VIDEO STREAMING) ───────────────────────────────────────────────

app.get('/hls-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const decoded = decodeURIComponent(url);
    const headers = { ...VIDEO_HEADERS };

    // Set appropriate referer headers for different sources
    if (decoded.includes('gogoanime') || decoded.includes('playtaku')) {
      headers['Referer'] = 'https://gogoanime.cl/';
      headers['Origin'] = 'https://gogoanime.cl';
    } else if (decoded.includes('megacloud') || decoded.includes('rapidcloud')) {
      headers['Referer'] = 'https://megacloud.tv/';
      headers['Origin'] = 'https://megacloud.tv';
    }

    const segResp = await axios.get(decoded, {
      headers,
      responseType: 'stream',
      timeout: 15000,
      maxRedirects: 3,
    });

    res.setHeader('Access-Control-Allow-Origin', req.headers['origin'] || '*');
    res.setHeader('Content-Type', segResp.headers['content-type'] || 'video/mp2t');
    segResp.data.pipe(res);
    res.on('close', () => segResp.data.destroy());
  } catch (e) {
    console.warn('[HLS-proxy] Failed:', e.message);
    if (!res.headersSent) res.status(502).json({ error: e.message });
  }
});

// ── ROOT ENDPOINT (INFO) ──────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    title: 'AnimeVault API',
    status: 'running',
    version: '3.2 (Fixed & Cleaned)',
    source: 'AllAnime (allanime.day)',
    self_url: SELF,
    endpoints: {
      search: '/search?query=<query>',
      anime_details: '/anime/<id>',
      dub_check: '/dub-check?show_id=<id>',
      episodes: '/episodes/<id>?mode=sub|dub',
      episode_info: '/episode_info?show_id=<id>&ep_no=<ep_no>',
      episode_url: '/episode_url?show_id=<id>&ep_no=<ep>&quality=<q>&mode=sub|dub',
      play: '/play?show_id=<id>&ep_no=<ep>&quality=<q>&mode=sub|dub',
      qualities: '/qualities?show_id=<id>&ep_no=<ep>&mode=sub|dub',
      thumbnails: '/thumbnails (POST with {ids: []})',
      hls_proxy: '/hls-proxy?url=<encoded_url>',
    },
  });
});

// ── ERROR HANDLING ────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── START SERVER ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ AnimeVault backend v3.2 running on port ${PORT}`);
  console.log(`   Self URL: ${SELF}`);
  console.log(`   Source: AllAnime (allanime.day)`);
});
