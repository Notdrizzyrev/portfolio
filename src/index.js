require('dotenv').config();
const express = require('express');
const cors = require('cors');
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 5678;

app.use(cors({
  origin: function (origin, callback) {
    // Open CORS — all origins allowed. Tighten if you add auth.
    return callback(null, true);
  },
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type']
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    title: 'AnimeVault Backend (Allanime)',
    status: 'running',
    version: '3.0.0',
    endpoints: [
      'GET  /search?query=<query>',
      'GET  /anime/<allanime_id>',
      'GET  /episodes/<allanime_id>?mode=sub|dub',
      'GET  /episode_url?show_id=<id>&ep_no=<num>&quality=best|1080|720|480&mode=sub|dub',
      'GET  /stream?show_id=<id>&ep_no=<num>&quality=best|1080|720|480&mode=sub|dub  (302 redirect to direct URL)',
      'GET  /qualities?show_id=<id>&ep_no=<num>&mode=sub|dub',
      'GET  /episode_info?show_id=<id>&ep_no=<num>',
      'POST /thumbnails  body: { ids: ["id1", "id2"] }',
    ]
  });
});

app.get('/search', async (req, res) => {
  const query = (req.query.query || '').trim();
  if (!query) return res.status(400).json({ error: 'Missing query parameter' });
  try {
    const results = await scraper.searchAnime(query);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/anime/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'Missing ID' });
  try {
    const details = await scraper.getAnimeDetails(id);
    if (!details) return res.status(404).json({ error: 'Anime not found on Allanime' });
    res.json(details);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/episodes/:id', async (req, res) => {
  const id = req.params.id;
  const mode = req.query.mode === 'dub' ? 'dub' : 'sub';
  if (!id) return res.status(400).json({ error: 'Missing ID' });
  try {
    const episodes = await scraper.getEpisodesList(id, mode);
    res.json({ mode, episodes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Returns JSON with the direct video/HLS URL — frontend plays it directly, no proxying
app.get('/episode_url', async (req, res) => {
  const id      = req.query.show_id;
  const epNo    = req.query.ep_no;
  const quality = req.query.quality || 'best';
  const mode    = req.query.mode === 'dub' ? 'dub' : 'sub';
  if (!id || !epNo) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const url = await scraper.getEpisodeUrl(id, epNo, mode, quality);
    if (!url) return res.status(404).json({ error: 'Episode not found or URL not available' });
    res.json({ episode_url: url, mode, quality });
  } catch (e) {
    const status = e.message?.startsWith('NEED_CAPTCHA') ? 503 : 500;
    res.status(status).json({ error: e.message });
  }
});

// 302 redirect to the direct stream URL — alternative for video src= usage
app.get('/stream', async (req, res) => {
  const id      = req.query.show_id;
  const epNo    = req.query.ep_no;
  const quality = req.query.quality || 'best';
  const mode    = req.query.mode === 'dub' ? 'dub' : 'sub';
  if (!id || !epNo) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const url = await scraper.getEpisodeUrl(id, epNo, mode, quality);
    if (!url) return res.status(404).json({ error: 'Episode not found or URL not available' });
    // Redirect the browser directly to the source — no proxying, no timeouts
    res.redirect(302, url);
  } catch (e) {
    const status = e.message?.startsWith('NEED_CAPTCHA') ? 503 : 500;
    res.status(status).json({ error: e.message });
  }
});

// REMOVED: /play (streaming proxy) — Vercel serverless has a 10s hard timeout which
// kills video streams. The frontend now fetches the direct URL via /episode_url and
// plays it using HLS.js, bypassing the backend entirely for actual video bytes.

app.get('/qualities', async (req, res) => {
  const id   = req.query.show_id;
  const epNo = req.query.ep_no;
  const mode = req.query.mode === 'dub' ? 'dub' : 'sub';
  if (!id || !epNo) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const qualities = await scraper.getAvailableQualities(id, epNo, mode);
    res.json({ qualities });
  } catch (e) {
    res.status(500).json({ error: e.message, qualities: [] });
  }
});

app.get('/episode_info', async (req, res) => {
  const id   = req.query.show_id;
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
    } catch { }
  }
  res.json(results);
});

app.listen(PORT, () => {
  console.log(`✅ AnimeVault backend running on port ${PORT}`);
});nst mode = req.query.mode === 'dub' ? 'dub' : 'sub';
  if (!id || !epNo) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const qualities = await scraper.getAvailableQualities(id, epNo, mode);
    res.json({ qualities });
  } catch (e) {
    res.status(500).json({ error: e.message, qualities: [] });
  }
});

app.get('/episode_info', async (req, res) => {
  const id   = req.query.show_id;
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
    } catch { }
  }
  res.json(results);
});

app.listen(PORT, () => {
  console.log(`✅ AnimeVault backend running on port ${PORT}`);
});