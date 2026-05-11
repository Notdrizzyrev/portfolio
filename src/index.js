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
  res.json({ title: 'AnimeVault Backend', status: 'running', version: '4.0.0' });
});

app.get('/search', async (req, res) => {
  const query = (req.query.query || '').trim();
  if (!query) return res.status(400).json({ error: 'Missing query' });
  try { res.json(await scraper.searchAnime(query)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/anime/:id', async (req, res) => {
  try {
    const details = await scraper.getAnimeDetails(req.params.id);
    if (!details) return res.status(404).json({ error: 'Not found' });
    res.json(details);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/episodes/:id', async (req, res) => {
  const mode = req.query.mode === 'dub' ? 'dub' : 'sub';
  try { res.json({ mode, episodes: await scraper.getEpisodesList(req.params.id, mode) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

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

app.get('/play', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: rawMode, download } = req.query;
  const mode = rawMode === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const url = await scraper.getEpisodeUrl(show_id, ep_no, mode, quality);
    if (!url) return res.status(404).json({ error: 'Not found' });

    const upstream = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
      'Referer':    'https://allmanga.to',
      'Origin':     'https://allmanga.to',
      'Accept':     '*/*',
    };
    if (req.headers['range']) upstream['Range'] = req.headers['range'];

    const resp = await axios({ method: 'get', url, headers: upstream, responseType: 'stream', timeout: 30000, maxRedirects: 5 });

    res.setHeader('Access-Control-Allow-Origin',   req.headers['origin'] || '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.setHeader('Cross-Origin-Resource-Policy',  'cross-origin');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', resp.headers['content-type'] || 'video/mp4');
    if (resp.headers['content-length']) res.setHeader('Content-Length', resp.headers['content-length']);
    if (resp.headers['content-range'])  res.setHeader('Content-Range',  resp.headers['content-range']);
    res.setHeader('Content-Disposition', download === '1' ? `attachment; filename="ep${ep_no}.mp4"` : 'inline');
    res.status(resp.status);
    resp.data.pipe(res);
    req.on('close', () => resp.data.destroy());

  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

app.options('/play', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  req.headers['origin'] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Max-Age',       '86400');
  res.sendStatus(204);
});

app.get('/qualities', async (req, res) => {
  const { show_id, ep_no, mode: rawMode } = req.query;
  const mode = rawMode === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try { res.json({ qualities: await scraper.getAvailableQualities(show_id, ep_no, mode) }); }
  catch (e) { res.status(500).json({ error: e.message, qualities: [] }); }
});

app.get('/episode_info', async (req, res) => {
  const { show_id, ep_no } = req.query;
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const info = await scraper.getEpisodeInfo(show_id, ep_no);
    if (!info) return res.status(404).json({ error: 'Not found' });
    res.json(info);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/thumbnails', async (req, res) => {
  const ids = req.body?.ids || req.body?.mal_ids;
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "Missing 'ids' array" });
  const results = {};
  for (const id of ids) {
    try {
      const d = await scraper.getAnimeDetails(id);
      if (d?.thumbnail_url) results[id] = d.thumbnail_url;
    } catch {}
  }
  res.json(results);
});

app.listen(PORT, () => console.log(`AnimeVault backend running on port ${PORT}`));
