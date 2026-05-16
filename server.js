require('dotenv').config();
const express = require('express');
const cors = require('cors');
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 5678;
const cache = new Map();
const CACHE_TTL = 3600000;

app.use(cors());
app.use(express.json());

const getCached = (k) => {
  const c = cache.get(k);
  return c && Date.now() - c.t < CACHE_TTL ? c.v : null;
};
const setCache = (k, v) => cache.set(k, { v, t: Date.now() });

app.get('/search', async (req, res) => {
  const q = req.query.query || '';
  if (!q) return res.status(400).json({ error: "Missing query" });
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
    if (!details) return res.status(404).json({ error: "Not found" });
    setCache(`anime:${req.params.id}`, details);
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
    res.json({
      has_dub: (details?.episodes_dub || 0) > 0,
      episodes_dub: details?.episodes_dub || 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message, has_dub: false, episodes_dub: 0 });
  }
});

app.get('/episodes/:id', async (req, res) => {
  const { id } = req.params;
  const mode = req.query.mode === 'dub' ? 'dub' : 'sub';
  if (!id) return res.status(400).json({ error: "Missing ID" });
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
  if (!show_id || !ep_no) return res.status(400).json({ error: "Missing params" });
  try {
    const url = await scraper.getEpisodeUrl(show_id, ep_no, mode, quality);
    if (!url) return res.status(404).json({ error: "Not found" });
    res.json({ episode_url: url, mode });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/play', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: m } = req.query;
  const mode = m === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: "Missing params" });
  try {
    const url = await scraper.getEpisodeUrl(show_id, ep_no, mode, quality);
    if (!url) return res.status(404).json({ error: "Not found" });
    res.redirect(url);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/qualities', async (req, res) => {
  const { show_id, ep_no, mode: m } = req.query;
  const mode = m === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: "Missing params" });
  try {
    const qs = await scraper.getAvailableQualities(show_id, ep_no, mode);
    res.json({ qualities: qs });
  } catch (e) {
    res.status(500).json({ error: e.message, qualities: [] });
  }
});

app.post('/thumbnails', async (req, res) => {
  const ids = req.body?.ids || req.body?.mal_ids || [];
  const results = {};
  for (const id of ids) {
    try {
      const details = await scraper.getAnimeDetails(id);
      if (details?.thumbnail_url) results[id] = details.thumbnail_url;
    } catch {}
  }
  res.json(results);
});

app.get('/', (req, res) => {
  res.json({
    title: "AnimeVault API",
    status: "running",
    version: "3.0 (Fast)",
    endpoints: [
      "/search?query=<query>",
      "/anime/<id>",
      "/episodes/<id>?mode=sub|dub",
      "/episode_url?show_id=<id>&ep_no=<ep>&quality=<q>&mode=sub|dub",
      "/play?show_id=<id>&ep_no=<ep>&quality=<q>&mode=sub|dub",
      "/qualities?show_id=<id>&ep_no=<ep>&mode=sub|dub",
      "/thumbnails (POST with ids array)",
      "/dub-check?show_id=<id>"
    ]
  });
});

app.listen(PORT, () => {
  console.log(`✅ Fast AnimeVault running on port ${PORT}`);
});eoResp = await axios.get(url, {
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
  const { show_id, ep_no, mode: rawMode } = req.query;
  const mode = rawMode === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const qs = await scraper.getAvailableQualities(show_id, ep_no, mode);
    res.json({ qualities: qs });
  } catch (e) {
    res.status(500).json({ error: e.message, qualities: [] });
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
    } catch {}
  }
  res.json(results);
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

app.get('/hls-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const decoded = decodeURIComponent(url);
    const headers = { ...VIDEO_HEADERS };

    if (decoded.includes('gogoanime') || decoded.includes('playtaku')) {
      headers['Referer'] = 'https://gogoanime.cl/';
      headers['Origin']  = 'https://gogoanime.cl';
    } else if (decoded.includes('megacloud') || decoded.includes('rapidcloud')) {
      headers['Referer'] = 'https://megacloud.tv/';
      headers['Origin']  = 'https://megacloud.tv';
    }

    const segResp = await axios.get(decoded, {
      headers,
      responseType: 'stream',
      timeout:      15000,
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

app.options('/play', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  req.headers['origin'] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});

app.get('/', (req, res) => {
    res.json({
        title: "AnimeVault API (Node.js)",
        status: "running",
        source: "AllAnime Direct",
        version: "2.0 (Fixed)",
        self_url: SELF,
        available_endpoints: [
            "/search?query=<query>",
            "/anime/<id>",
            "/thumbnails (POST with {'ids': ['id1', 'id2', ...]})",
            "/episodes/<id>?mode=<sub|dub>",
            "/episode_info?show_id=<id>&ep_no=<ep_no>",
            "/episode_url?show_id=<id>&ep_no=<ep_no>&quality=<quality>&mode=<sub|dub>",
            "/play?show_id=<id>&ep_no=<ep_no>&quality=<quality>&mode=<sub|dub>",
            "/qualities?show_id=<id>&ep_no=<ep_no>&mode=<sub|dub>",
            "/hls-proxy?url=<encoded_url>"
        ]
    });
});

app.listen(PORT, () => {
  console.log(`✅ AnimeVault backend running on port ${PORT}`);
  console.log(`   Self URL (for HLS rewriting): ${SELF}`);
  console.log(`   Source: AllAnime (allanime.day)`);
});ata.pipe(res);
    res.on('close', () => segResp.data.destroy());
  } catch (e) {
    console.warn('[HLS-proxy] Failed:', e.message);
    if (!res.headersSent) res.status(502).json({ error: e.message });
  }
});

app.options('/play', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  req.headers['origin'] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});

// ── QUALITIES ─────────────────────────────────────────────────────────────────

app.get('/qualities', async (req, res) => {
  const { show_id, ep_no, mode: rawMode, title } = req.query;
  const mode = rawMode === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const qs = await scraper.getAvailableQualities(show_id, ep_no, mode, title || null);
    res.json({ qualities: qs });
  } catch (e) {
    res.status(500).json({ error: e.message, qualities: [] });
  }
});

// ── THUMBNAILS ────────────────────────────────────────────────────────────────

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
    } catch {}
  }
  res.json(results);
});

// ── START ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ AnimeVault backend v8.0 running on port ${PORT}`);
  console.log(`   Self URL (for HLS rewriting): ${SELF}`);
  console.log(`   Source: AnimeKai (animekai.to)`);
});
