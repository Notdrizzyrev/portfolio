require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const scraper = require('./scraper');

const app  = express();
const PORT = process.env.PORT || 5678;
const SELF = (process.env.BACKEND_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

app.use(cors({
  origin: true,
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
}));
app.use(express.json());

// ── ROOT ──────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({ title: 'AnimeVault Backend', status: 'running', version: '8.0.0', source: 'animekai' });
});

// ── SEARCH ────────────────────────────────────────────────────────────────────

app.get('/search', async (req, res) => {
  const query = req.query.query || '';
  if (!query) return res.status(400).json({ error: 'Missing query parameter' });
  try {
    const results = await scraper.searchAnime(query);
    // Normalise to shape frontend expects: { id, title, episodes_sub, episodes_dub }
    res.json(results.map(r => ({
      id:           r.slug || r.id,
      title:        r.title,
      type:         r.type || 'TV',
      episodes_sub: r.episodes_sub || 0,
      episodes_dub: r.episodes_dub || 0,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ANIME DETAILS ─────────────────────────────────────────────────────────────

app.get('/anime/:id', async (req, res) => {
  const title = req.query.title || null;
  try {
    const details = await scraper.getAnimeDetails(req.params.id, title);
    if (!details) return res.status(404).json({ error: 'Anime not found' });
    res.json(details);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DUB CHECK ─────────────────────────────────────────────────────────────────

app.get('/dub-check', async (req, res) => {
  const { show_id, title } = req.query;
  if (!show_id) return res.status(400).json({ error: 'Missing show_id' });
  try {
    const result = await scraper.dubCheck(show_id, title || null);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── EPISODES LIST ─────────────────────────────────────────────────────────────

app.get('/episodes/:id', async (req, res) => {
  const mode  = req.query.mode === 'dub' ? 'dub' : 'sub';
  const title = req.query.title || null;
  try {
    const eps = await scraper.getEpisodesList(req.params.id, mode, title);
    // Return episodes as simple sorted number array (frontend expects this shape)
    res.json({ mode, episodes: eps.map(e => String(e.number)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── EPISODE URL ───────────────────────────────────────────────────────────────

app.get('/episode_url', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: rawMode, title } = req.query;
  const mode = rawMode === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const links = await scraper.getAllEpisodeLinks(show_id, ep_no, mode, quality, title || null);
    if (!links?.length) return res.status(404).json({ error: 'Not found' });
    res.json({
      episode_url: links[0].url,
      is_hls:      links[0].is_hls,
      mode,
      quality:     links[0].resolution,
      all_links:   links,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PLAY PROXY ────────────────────────────────────────────────────────────────

const VIDEO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Referer':    'https://animekai.to',
  'Origin':     'https://animekai.to',
};

app.get('/play', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: rawMode, download, title } = req.query;
  const mode = rawMode === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing show_id or ep_no' });

  try {
    const links = await scraper.getAllEpisodeLinks(show_id, ep_no, mode, quality, title || null);
    if (!links?.length) return res.status(404).json({ error: 'Not found' });

    res.setHeader('Access-Control-Allow-Origin',   req.headers['origin'] || '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.setHeader('Cross-Origin-Resource-Policy',  'cross-origin');

    let lastError = null;

    for (const link of links) {
      const reqHeaders = { ...VIDEO_HEADERS };
      if (req.headers['range']) reqHeaders['Range'] = req.headers['range'];

      // Per-CDN referer overrides
      if (link.url.includes('megacloud') || link.url.includes('rapidcloud')) {
        reqHeaders['Referer'] = 'https://megacloud.tv/';
        reqHeaders['Origin']  = 'https://megacloud.tv';
      } else if (link.url.includes('gogoanime') || link.url.includes('gogo')) {
        reqHeaders['Referer'] = 'https://gogoanime.cl/';
        reqHeaders['Origin']  = 'https://gogoanime.cl';
      }

      try {
        const videoResp = await axios.get(link.url, {
          headers:      reqHeaders,
          responseType: 'stream',
          timeout:      20000,
          maxRedirects: 5,
        });

        if (videoResp.status >= 200 && videoResp.status < 400) {
          const isHls = link.is_hls || link.url.includes('.m3u8')
            || (videoResp.headers['content-type'] || '').includes('mpegurl');

          res.setHeader('Content-Disposition', download === '1'
            ? `attachment; filename="ep${ep_no}.mp4"` : 'inline');

          if (isHls) {
            let manifest = '';
            videoResp.data.setEncoding('utf8');
            videoResp.data.on('data', c => { manifest += c; });
            videoResp.data.on('end', () => {
              const rewritten = manifest.replace(
                /^(https?:\/\/.+)$/gm,
                m => `${SELF}/hls-proxy?url=${encodeURIComponent(m.trim())}`
              );
              const body = Buffer.from(rewritten, 'utf8');
              res.setHeader('Content-Type',   'application/vnd.apple.mpegurl');
              res.setHeader('Content-Length', body.length);
              res.status(200).send(body);
            });
            videoResp.data.on('error', () => {
              if (!res.headersSent) res.status(502).json({ error: 'Manifest read error' });
            });
          } else {
            res.setHeader('Content-Type',  videoResp.headers['content-type'] || 'video/mp4');
            res.setHeader('Accept-Ranges', 'bytes');
            if (videoResp.headers['content-length']) res.setHeader('Content-Length', videoResp.headers['content-length']);
            if (videoResp.headers['content-range'])  res.setHeader('Content-Range',  videoResp.headers['content-range']);
            res.status(videoResp.status);
            videoResp.data.pipe(res);
            res.on('close', () => videoResp.data.destroy());
          }
          return;
        }
        videoResp.data.destroy();
      } catch (e) {
        lastError = e;
        console.warn(`[Play] Link failed (${link.resolution}): ${e.message}`);
      }
    }

    if (!res.headersSent) {
      res.status(502).json({ error: 'All stream sources failed', detail: lastError?.message });
    }
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ── HLS SEGMENT PROXY ─────────────────────────────────────────────────────────

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
