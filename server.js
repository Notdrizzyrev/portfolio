require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const https = require('https');

const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 5678;
const SELF = process.env.SELF_URL || 'https://animevault-backend-production.up.railway.app';

// HTTP agents
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50, rejectUnauthorized: false });

const axiosInstance = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

// Video headers for streaming
const VIDEO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://allanime.day/'
};

// Cache
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;
const SHORT_CACHE_TTL = 5 * 60 * 1000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range'],
  credentials: false
}));
app.use(express.json());

// Cache helpers
const getCached = (k) => {
  const c = cache.get(k);
  return c && Date.now() - c.t < (c.ttl || CACHE_TTL) ? c.v : null;
};

const setCache = (k, v, ttl = CACHE_TTL) => {
  cache.set(k, { v, t: Date.now(), ttl });
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// Search anime
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
    console.error('[searchAnime]', e.message);
    res.json([]);
  }
});

// Get anime details
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
    console.error('[getAnimeDetails]', e.message);
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// Dub check
app.get('/dub-check', async (req, res) => {
  const { show_id } = req.query;
  if (!show_id) return res.status(400).json({ error: 'Missing show_id' });
  
  try {
    const cacheKey = `dub:${show_id}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const details = await Promise.race([
      scraper.getAnimeDetails(show_id),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
    ]);

    const result = {
      has_dub: (details?.episodes_dub || 0) > 0,
      episodes_dub: details?.episodes_dub || 0,
    };
    setCache(cacheKey, result, SHORT_CACHE_TTL);
    res.json(result);
  } catch (e) {
    res.json({ has_dub: false, episodes_dub: 0 });
  }
});

// Get episodes
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

// Get episode info
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

// Get episode URL
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

// VIDEO PROXY
app.get('/video-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const decodedUrl = decodeURIComponent(url);
    console.log(`[video-proxy] Proxying: ${decodedUrl.substring(0, 80)}...`);

    const response = await axiosInstance.get(decodedUrl, {
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 5,
      headers: VIDEO_HEADERS
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');
    res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
    res.setHeader('Content-Length', response.headers['content-length'] || '');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    response.data.pipe(res);
    
    response.data.on('error', (e) => {
      console.error('[video-proxy] Stream error:', e.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Stream failed' });
      }
    });

    res.on('close', () => {
      response.data.destroy();
    });
  } catch (e) {
    console.error('[video-proxy]', e.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to proxy video', details: e.message });
    }
  }
});

// PLAY endpoint
app.get('/play', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: m } = req.query;
  const mode = m === 'dub' ? 'dub' : 'sub';
  
  if (!show_id || !ep_no) return res.status(400).json({ error: 'Missing params' });
  
  try {
    const url = await Promise.race([
      scraper.getEpisodeUrl(show_id, ep_no, mode, quality),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);

    if (!url) {
      return res.status(404).json({ error: 'No stream available' });
    }

    const proxyUrl = `${SELF}/video-proxy?url=${encodeURIComponent(url)}`;
    res.json({ play_url: proxyUrl, direct_url: url });
  } catch (e) {
    console.error('[play]', e.message);
    res.status(500).json({ error: 'Failed to get stream' });
  }
});

// Get available qualities
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

// Batch thumbnail fetch
app.post('/thumbnails', async (req, res) => {
  const ids = req.body?.ids || req.body?.mal_ids || [];
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'Invalid ids' });
  
  try {
    const results = {};
    const promises = ids.slice(0, 50).map(async (id) => {
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
        console.warn(`[thumbnails] ${id}:`, e.message);
      }
    });

    await Promise.all(promises);
    res.json(results);
  } catch (e) {
    console.error('[thumbnails] Error:', e.message);
    res.json({});
  }
});

// HLS PROXY
app.get('/hls-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const decoded = decodeURIComponent(url);
    const headers = { ...VIDEO_HEADERS };

    if (decoded.includes('gogoanime') || decoded.includes('playtaku')) {
      headers['Referer'] = 'https://gogoanime.cl/';
      headers['Origin'] = 'https://gogoanime.cl';
    } else if (decoded.includes('megacloud') || decoded.includes('rapidcloud')) {
      headers['Referer'] = 'https://megacloud.tv/';
      headers['Origin'] = 'https://megacloud.tv';
    }

    const segResp = await axiosInstance.get(decoded, {
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
    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to proxy video', details: e.message });
    }
  }
});

// ROOT ENDPOINT
app.get('/', (req, res) => {
  res.json({
    title: 'AnimeVault API',
    status: 'running',
    version: '4.2 (Fixed)',
    source: 'Jikan API + Google CDN',
    self_url: SELF,
    cache_status: {
      entries: cache.size,
      ttl_1h: 'anime details',
      ttl_5m: 'search, episodes, urls'
    },
    endpoints: {
      search: '/search?query=<query>',
      anime_details: '/anime/<id>',
      dub_check: '/dub-check?show_id=<id>',
      episodes: '/episodes/<id>?mode=sub|dub',
      episode_info: '/episode_info?show_id=<id>&ep_no=<ep_no>',
      episode_url: '/episode_url?show_id=<id>&ep_no=<ep>&quality=<q>&mode=sub|dub',
      play: '/play?show_id=<id>&ep_no=<ep>&quality=<q>&mode=sub|dub',
      video_proxy: '/video-proxy?url=<encoded_url>',
      qualities: '/qualities?show_id=<id>&ep_no=<ep>&mode=sub|dub',
      thumbnails: '/thumbnails (POST with {ids: []})',
      hls_proxy: '/hls-proxy?url=<encoded_url>',
      health: '/health',
    }
  });
});

// 404 HANDLER
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// ERROR HANDLING
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// START SERVER
const server = app.listen(PORT, () => {
  console.log(`✅ AnimeVault backend v4.2 running on port ${PORT}`);
  console.log(`   Self URL: ${SELF}`);
  console.log(`   Features: CORS proxy, video streaming, smart caching`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
