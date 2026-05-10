require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 5678;

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  // 'https://animevault.netlify.app'  ← add your Netlify URL here
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    if (/\.netlify\.app$/.test(origin)) return callback(null, true);
    if (/\.vercel\.app$/.test(origin)) return callback(null, true);
    if (/\.github\.io$/.test(origin)) return callback(null, true);
    return callback(null, true); // open — tighten if you need auth
  }
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    title: 'AnimeVault Backend (Allanime)',
    status: 'running',
    version: '2.0.0',
    endpoints: [
      'GET  /search?query=<query>',
      'GET  /anime/<allanime_id>',
      'GET  /episodes/<allanime_id>?mode=sub|dub',
      'GET  /episode_url?show_id=<id>&ep_no=<num>&quality=best|1080|720|480&mode=sub|dub',
      'GET  /play?show_id=<id>&ep_no=<num>&quality=best|1080|720|480&mode=sub|dub',
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

app.get('/play', async (req, res) => {
  const id      = req.query.show_id;
  const epNo    = req.query.ep_no;
  const quality = req.query.quality || 'best';
  const mode    = req.query.mode === 'dub' ? 'dub' : 'sub';
  if (!id || !epNo) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const url = await scraper.getEpisodeUrl(id, epNo, mode, quality);
    if (!url) return res.status(404).json({ error: 'Episode not found or URL not available' });

    const upstreamHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      'Referer':    'https://allmanga.to',
      'Origin':     'https://allmanga.to',
    };

    // Forward Range header from browser so video seeking works and
    // each chunk stays well under Vercel's 4.5 MB response limit
    const range = req.headers['range'];
    if (range) upstreamHeaders['Range'] = range;

    const videoResp = await axios({
      method: 'get',
      url,
      headers: upstreamHeaders,
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 5,
    });

    // Mirror status (200 or 206 Partial Content)
    res.status(videoResp.status);

    // Pass through all relevant headers
    const passThrough = [
      'content-type', 'content-length', 'content-range',
      'accept-ranges', 'cache-control', 'expires',
    ];
    passThrough.forEach(h => {
      if (videoResp.headers[h]) res.setHeader(h, videoResp.headers[h]);
    });

    // Always advertise range support so the browser seeks instead of re-downloading
    res.setHeader('Accept-Ranges', 'bytes');

    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="anime_ep${epNo}.mp4"`);
    } else {
      res.setHeader('Content-Disposition', 'inline');
    }

    videoResp.data.pipe(res);
    req.on('close', () => videoResp.data.destroy());

  } catch (e) {
    if (!res.headersSent) {
      const status = e.message?.startsWith('NEED_CAPTCHA') ? 503 : 500;
      res.status(status).json({ error: e.message });
    }
  }
});

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
});
