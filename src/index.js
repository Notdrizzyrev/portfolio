require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const scraper = require('./scraper');

const app  = express();
const PORT = process.env.PORT || 5678;

app.use(cors({
  origin: true,
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type']
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ title: 'AnimeVault Backend', status: 'running', version: '5.2.0' });
});

// ── JIKAN PROXY ───────────────────────────────────────────────────────────────
app.get('/jikan/*', async (req, res) => {
  const path = req.params[0];
  const query = req.url.split('?')[1] || '';
  const url = `https://api.jikan.moe/v4/${path}${query ? '?' + query : ''}`;
  try {
    const r = await axios.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 10000
    });
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(r.data);
  } catch (e) {
    const status = e.response?.status || 500;
    res.status(status).json({ error: e.message });
  }
});

// ── SEARCH ────────────────────────────────────────────────────────────────────
app.get('/search', async (req, res) => {
  const query  = req.query.query || '';
  const nsfw   = req.query.nsfw === 'true' || req.query.adult === 'true';
  if (!query) return res.status(400).json({ error: 'Missing query parameter' });
  try { res.json(await scraper.searchAnime(query, nsfw)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ANIME DETAILS ─────────────────────────────────────────────────────────────
app.get('/anime/:id', async (req, res) => {
  try {
    const details = await scraper.getAnimeDetails(req.params.id);
    if (!details) return res.status(404).json({ error: 'Anime not found' });
    res.json(details);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── EPISODES LIST ─────────────────────────────────────────────────────────────
app.get('/episodes/:id', async (req, res) => {
  const mode = req.query.mode === 'dub' ? 'dub' : 'sub';
  try { res.json({ mode, episodes: await scraper.getEpisodesList(req.params.id, mode) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DUB CHECK ─────────────────────────────────────────────────────────────────
app.get('/dub-check', async (req, res) => {
  const { show_id } = req.query;
  if (!show_id) return res.status(400).json({ error: 'Missing show_id' });
  try {
    const details = await scraper.getAnimeDetails(show_id);
    if (!details) return res.status(404).json({ error: 'Show not found', has_dub: false });
    const episodes_dub = details.episodes_dub || 0;
    res.json({ has_dub: episodes_dub > 0, episodes_dub, show_id });
  } catch (e) {
    res.status(500).json({ error: e.message, has_dub: false });
  }
});

// ── EPISODE URL (JSON) ────────────────────────────────────────────────────────
app.get('/episode_url', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: rawMode } = req.query;
  const mode = rawMode === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const url = await scraper.getEpisodeUrl(show_id, ep_no, mode, quality);
    if (!url) return res.status(404).json({ error: 'Not found' });
    res.json({ episode_url: url, mode, quality });
  } catch (e) {
    res.status(e.message?.startsWith('NEED_CAPTCHA') ? 503 : 500).json({ error: e.message });
  }
});

// ── PLAY (proxy stream) ───────────────────────────────────────────────────────
app.get('/play', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: rawMode, download } = req.query;
  const mode = rawMode === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const url = await scraper.getEpisodeUrl(show_id, ep_no, mode, quality);
    if (!url) return res.status(404).json({ error: 'Not found' });

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      'Referer': 'https://allmanga.to',
      'Origin': 'https://allmanga.to',
    };
    if (req.headers['range']) headers['Range'] = req.headers['range'];

    const videoResp = await axios.get(url, {
      headers,
      responseType: 'stream',
      timeout: 20000,
      maxRedirects: 5
    });

    res.setHeader('Access-Control-Allow-Origin', req.headers['origin'] || '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', videoResp.headers['content-type'] || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', download === '1'
      ? `attachment; filename="ep${ep_no}.mp4"`
      : 'inline');
    if (videoResp.headers['content-length']) res.setHeader('Content-Length', videoResp.headers['content-length']);
    if (videoResp.headers['content-range'])  res.setHeader('Content-Range',  videoResp.headers['content-range']);

    res.status(videoResp.status);
    videoResp.data.pipe(res);
    res.on('close', () => videoResp.data.destroy());

  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
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
  const { show_id, ep_no, mode: rawMode } = req.query;
  const mode = rawMode === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    res.json({ qualities: await scraper.getAvailableQualities(show_id, ep_no, mode) });
  } catch (e) {
    res.status(500).json({ error: e.message, qualities: [] });
  }
});

// ── EPISODE INFO ──────────────────────────────────────────────────────────────
app.get('/episode_info', async (req, res) => {
  const { show_id, ep_no } = req.query;
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const info = await scraper.getEpisodeInfo(show_id, ep_no);
    if (!info) return res.status(404).json({ error: 'Episode info not found' });
    res.json(info);
  } catch (e) {
    res.status(500).json({ error: e.message });
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
  console.log(`✅ AnimeVault backend running on port ${PORT}`);
});
