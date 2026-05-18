require('dotenv').config();
const express = require('express');
const cors = require('cors');
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 5678;
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;
const SHORT_CACHE_TTL = 5 * 60 * 1000;

const getCached = (k) => {
  const c = cache.get(k);
  return c && Date.now() - c.t < (c.ttl || CACHE_TTL) ? c.v : null;
};

const setCache = (k, v, ttl = CACHE_TTL) => {
  cache.set(k, { v, t: Date.now(), ttl });
};

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

app.get('/search', async (req, res) => {
  const q = req.query.query || '';
  if (!q) return res.status(400).json({ error: 'Missing query' });
  
  try {
    const cacheKey = `search:${q.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const results = await Promise.race([
      scraper.searchAnime(q),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
    ]);

    setCache(cacheKey, results || [], SHORT_CACHE_TTL);
    res.json(results || []);
  } catch (e) {
    console.error('[search]', e.message);
    res.json([]);
  }
});

app.get('/anime/:id', async (req, res) => {
  try {
    const cacheKey = `anime:${req.params.id}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const details = await Promise.race([
      scraper.getAnimeDetails(req.params.id),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
    ]);

    if (!details) return res.status(404).json({ error: 'Not found' });
    setCache(cacheKey, details);
    res.json(details);
  } catch (e) {
    console.error('[anime]', e.message);
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

app.get('/episodes/:id', async (req, res) => {
  const { id } = req.params;
  const mode = req.query.mode === 'dub' ? 'dub' : 'sub';
  
  try {
    const cacheKey = `ep:${id}:${mode}`;
    let episodes = getCached(cacheKey);
    
    if (!episodes) {
      episodes = await Promise.race([
        scraper.getEpisodesList(id, mode),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
      ]);
      if (episodes?.length) setCache(cacheKey, episodes);
    }
    
    res.json({ mode, episodes: episodes || [] });
  } catch (e) {
    res.json({ mode, episodes: [] });
  }
});

app.get('/episode_info', async (req, res) => {
  const { show_id, ep_no } = req.query;
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing params' });
  
  try {
    const cacheKey = `epinfo:${show_id}:${ep_no}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const info = await Promise.race([
      scraper.getEpisodeInfo(show_id, ep_no),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
    ]);

    if (info) setCache(cacheKey, info, SHORT_CACHE_TTL);
    res.json(info || {});
  } catch (e) {
    res.json({});
  }
});

app.get('/episode_url', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: m } = req.query;
  const mode = m === 'dub' ? 'dub' : 'sub';
  
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing params' });
  
  try {
    const cacheKey = `url:${show_id}:${ep_no}:${mode}:${quality}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ episode_url: cached, mode, cached: true });

    const url = await Promise.race([
      scraper.getEpisodeUrl(show_id, ep_no, mode, quality),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);

    if (url) {
      setCache(cacheKey, url, SHORT_CACHE_TTL);
      return res.json({ episode_url: url, mode, cached: false });
    }
    
    res.json({ episode_url: null, mode, error: 'No stream available' });
  } catch (e) {
    console.error('[episode_url]', e.message);
    res.json({ episode_url: null, mode, error: 'No stream available' });
  }
});

app.get('/play', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: m } = req.query;
  const mode = m === 'dub' ? 'dub' : 'sub';
  
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing params' });
  
  try {
    const url = await Promise.race([
      scraper.getEpisodeUrl(show_id, ep_no, mode, quality),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);

    if (url) return res.redirect(url);
    res.status(404).json({ error: 'No stream available' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get stream' });
  }
});

app.get('/qualities', async (req, res) => {
  const { show_id, ep_no, mode: rawMode } = req.query;
  const mode = rawMode === 'dub' ? 'dub' : 'sub';
  
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing params' });
  
  try {
    const qs = await Promise.race([
      scraper.getAvailableQualities(show_id, ep_no, mode),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
    ]);

    res.json({ qualities: qs || [] });
  } catch (e) {
    res.json({ qualities: [] });
  }
});

app.post('/thumbnails', async (req, res) => {
  const ids = req.body?.ids || req.body?.mal_ids || [];
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'Invalid ids' });
  
  try {
    const results = {};
    for (const id of ids.slice(0, 50)) {
      try {
        const cacheKey = `thumb:${id}`;
        const cached = getCached(cacheKey);
        
        if (cached) {
          results[id] = cached;
        } else {
          const details = await Promise.race([
            scraper.getAnimeDetails(id),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]);
          
          if (details?.thumbnail_url) {
            results[id] = details.thumbnail_url;
            setCache(cacheKey, details.thumbnail_url);
          }
        }
      } catch (e) {
        console.warn(`[thumb] ${id}:`, e.message);
      }
    }
    res.json(results);
  } catch (e) {
    res.json({});
  }
});

app.get('/', (req, res) => {
  res.json({
    title: 'AnimeVault API',
    status: 'running',
    version: '4.0',
    source: 'Jikan API',
    endpoints: {
      search: '/search?query=<query>',
      anime: '/anime/<id>',
      episodes: '/episodes/<id>?mode=sub|dub',
      episode_info: '/episode_info?show_id=<id>&ep_no=<ep>',
      episode_url: '/episode_url?show_id=<id>&ep_no=<ep>',
      play: '/play?show_id=<id>&ep_no=<ep>',
      health: '/health',
    }
  });
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Server error' });
});

const server = app.listen(PORT, () => {
  console.log(`✅ AnimeVault v4.0 on port ${PORT}`);
  console.log(`   Source: Jikan API`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
