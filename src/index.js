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

// Tests all known AllAnime domains and reports which one works.
// Hit /test-domain in your browser to diagnose API issues.
app.get('/test-domain', async (req, res) => {
  const AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0";
  const POSSIBLE_DOMAINS = [
    'allanime.day', 'allanime.to', 'allmanga.to',
    'allanime.pro', 'allanime.co', 'allanime.tv', 'allanime.site'
  ];
  const testQuery = {
    variables: { search: { query: 'naruto', allowAdult: false, allowUnknown: false }, limit: 1, page: 1, countryOrigin: 'ALL' },
    query: `query($search: SearchInput $limit: Int $page: Int $countryOrigin: VaildCountryOriginEnumType) {
      shows(search: $search limit: $limit page: $page countryOrigin: $countryOrigin) { edges { _id name } }
    }`
  };
  const results = {};
  for (const domain of POSSIBLE_DOMAINS) {
    try {
      const r = await axios.post(`https://api.${domain}/api`, testQuery, {
        headers: { 'User-Agent': AGENT, 'Referer': `https://${domain}`, 'Origin': `https://${domain}` },
        timeout: 8000,
        maxRedirects: 3
      });
      const works = !!(r.data?.data?.shows?.edges?.length > 0);
      results[`api.${domain}`] = { status: r.status, works };
    } catch (e) {
      results[`api.${domain}`] = {
        error: e.message,
        httpStatus: e.response?.status || null,
        redirectsTo: e.response?.headers?.location || null
      };
    }
  }
  const working = Object.entries(results).find(([, v]) => v.works);
  res.json({ working: working ? working[0] : 'none found', results });
});

app.get('/search', async (req, res) => {
  const query = req.query.query || '';
  const allowAdult = req.query.nsfw === 'true' || req.query.adult === 'true';
  if (!query) return res.status(400).json({ error: 'Missing query parameter' });
  try {
    res.json(await scraper.searchAnime(query, allowAdult));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/anime/:id', async (req, res) => {
  try {
    const details = await scraper.getAnimeDetails(req.params.id);
    if (!details) return res.status(404).json({ error: 'Anime not found' });
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
    if (!details) return res.json({ has_dub: false });
    const hasDub = (details.episodes_dub != null && details.episodes_dub > 0) || (details.has_dub === true);
    res.json({ has_dub: hasDub, episodes_dub: details.episodes_dub || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/episodes/:id', async (req, res) => {
  const mode = req.query.mode === 'dub' ? 'dub' : 'sub';
  try {
    res.json({ mode, episodes: await scraper.getEpisodesList(req.params.id, mode) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/episode_url', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: rawMode, title } = req.query;
  const mode = rawMode === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing show_id or ep_no' });
  try {
    const links = await scraper.getAllEpisodeLinks(show_id, ep_no, mode, quality, title || null);
    if (!links || links.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({
      episode_url: links[0].url,
      is_hls: links[0].url.includes('.m3u8'),
      mode,
      quality: links[0].resolution,
      all_links: links
    });
  } catch (e) {
    res.status(e.message?.startsWith('NEED_CAPTCHA') ? 503 : 500).json({ error: e.message });
  }
});

app.get('/play', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: rawMode, download, title } = req.query;
  const mode = rawMode === 'dub' ? 'dub' : 'sub';
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing show_id or ep_no' });

  try {
    const links = await scraper.getAllEpisodeLinks(show_id, ep_no, mode, quality, title || null);
    if (!links || links.length === 0) return res.status(404).json({ error: 'Not found' });

    const primaryUrl = links[0].url;
    if (primaryUrl.includes('.m3u8')) {
      return res.redirect(primaryUrl);
    }

    const videoHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      'Referer':  'https://allmanga.to',
      'Origin':   'https://allmanga.to',
    };
    if (req.headers['range']) videoHeaders['Range'] = req.headers['range'];

    let lastError = null;
    for (const link of links) {
      if (link.url.includes('.m3u8')) {
        return res.redirect(link.url);
      }
      try {
        const videoResp = await axios.get(link.url, {
          headers: videoHeaders,
          responseType: 'stream',
          timeout: 15000,
          maxRedirects: 5,
        });

        if (videoResp.status >= 200 && videoResp.status < 400) {
          res.setHeader('Access-Control-Allow-Origin', req.headers['origin'] || '*');
          res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          res.setHeader('Content-Type', videoResp.headers['content-type'] || 'video/mp4');
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Disposition', download === '1' ? `attachment; filename="ep${ep_no}.mp4"` : 'inline');
          if (videoResp.headers['content-length']) res.setHeader('Content-Length', videoResp.headers['content-length']);
          if (videoResp.headers['content-range'])  res.setHeader('Content-Range', videoResp.headers['content-range']);
          res.status(videoResp.status);
          videoResp.data.pipe(res);
          res.on('close', () => videoResp.data.destroy());
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

app.options('/play', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  req.headers['origin'] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});

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
