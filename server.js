
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const scraper = require('./scraper');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 5678;
const SELF = process.env.SELF_URL || `http://localhost:${PORT}`;

// Create HTTP/HTTPS agents with connection pooling
const httpAgent = new http.Agent({ 
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
});

const httpsAgent = new https.Agent({ 
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
});

// Axios instance with connection pooling
const axiosInstance = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 15000,
});

// Cache configuration
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const SHORT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for frequently accessed items

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

// Request logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${res.statusCode}] ${req.method} ${req.path} - ${duration}ms`);
  });
  next();
});

// Cache utilities
const getCached = (k) => {
  const c = cache.get(k);
  return c && Date.now() - c.t < (c.ttl || CACHE_TTL) ? c.v : null;
};

const setCache = (k, v, ttl = CACHE_TTL) => {
  cache.set(k, { v, t: Date.now(), ttl });
};

// Clean up old cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [k, v] of cache.entries()) {
    if (now - v.t > (v.ttl || CACHE_TTL)) {
      cache.delete(k);
      cleaned++;
    }
  }
  if (cleaned > 0) console.log(`[Cache] Cleaned ${cleaned} expired entries`);
}, 10 * 60 * 1000);

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    cache_size: cache.size,
    timestamp: new Date().toISOString()
  });
});

// ── SEARCH ────────────────────────────────────────────────────────────────────

app.get('/search', async (req, res) => {
  const q = req.query.query || '';
  if (!q) return res.status(400).json({ error: 'Missing query parameter' });
  
  try {
    const cacheKey = `search:${q.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const results = await scraper.searchAnime(q);
    setCache(cacheKey, results, SHORT_CACHE_TTL);
    res.json(results);
  } catch (e) {
    console.error('[search] Error:', e.message);
    res.status(500).json({ error: 'Failed to search anime', details: e.message });
  }
});

// ── ANIME DETAILS ─────────────────────────────────────────────────────────────

app.get('/anime/:id', async (req, res) => {
  try {
    const cacheKey = `anime:${req.params.id}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const details = await scraper.getAnimeDetails(req.params.id);
    if (!details) return res.status(404).json({ error: 'Anime not found' });

    setCache(cacheKey, details);
    res.json(details);
  } catch (e) {
    console.error('[anime] Error:', e.message);
    res.status(500).json({ error: 'Failed to fetch anime details', details: e.message });
  }
});

// ── DUB CHECK ─────────────────────────────────────────────────────────────────

app.get('/dub-check', async (req, res) => {
  const { show_id } = req.query;
  if (!show_id) return res.status(400).json({ error: 'Missing show_id parameter' });
  
  try {
    const cacheKey = `dub:${show_id}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const details = await scraper.getAnimeDetails(show_id);
    const result = {
      has_dub: (details?.episodes_dub || 0) > 0,
      episodes_dub: details?.episodes_dub || 0,
    };
    setCache(cacheKey, result, SHORT_CACHE_TTL);
    res.json(result);
  } catch (e) {
    console.error('[dub-check] Error:', e.message);
    res.status(500).json({ 
      error: 'Failed to check dub availability', 
      details: e.message, 
      has_dub: false, 
      episodes_dub: 0 
    });
  }
});

// ── EPISODES ──────────────────────────────────────────────────────────────────

app.get('/episodes/:id', async (req, res) => {
  const { id } = req.params;
  const mode = req.query.mode === 'dub' ? 'dub' : 'sub';
  if (!id) return res.status(400).json({ error: 'Missing ID parameter' });
  
  try {
    const cacheKey = `ep:${id}:${mode}`;
    let episodes = getCached(cacheKey);
    
    if (!episodes) {
      episodes = await scraper.getEpisodesList(id, mode);
      if (episodes.length > 0) setCache(cacheKey, episodes);
    }
    
    res.json({ mode, episodes, count: episodes.length });
  } catch (e) {
    console.error('[episodes] Error:', e.message);
    res.status(500).json({ error: 'Failed to fetch episodes', details: e.message });
  }
});

// ── EPISODE INFO ──────────────────────────────────────────────────────────────

app.get('/episode_info', async (req, res) => {
  const id = req.query.show_id;
  const epNo = req.query.ep_no;
  if (!id || !epNo) return res.status(400).json({ error: 'Missing show_id or ep_no parameters' });
  
  try {
    const cacheKey = `epinfo:${id}:${epNo}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const info = await scraper.getEpisodeInfo(id, epNo);
    if (!info) return res.status(404).json({ error: 'Episode info not found' });
    
    setCache(cacheKey, info, SHORT_CACHE_TTL);
    res.json(info);
  } catch (e) {
    console.error('[episode_info] Error:', e.message);
    res.status(500).json({ error: 'Failed to fetch episode info', details: e.message });
  }
});

// ── EPISODE URL (MAIN ENDPOINT - OPTIMIZE THIS) ──────────────────────────────

app.get('/episode_url', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: m } = req.query;
  const mode = m === 'dub' ? 'dub' : 'sub';
  
  if (!show_id || !ep_no) {
    return res.status(400).json({ error: 'Missing show_id or ep_no parameters' });
  }
  
  try {
    const cacheKey = `url:${show_id}:${ep_no}:${mode}:${quality}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ episode_url: cached, mode, cached: true });

    // Set a timeout for this request
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Episode URL fetch timeout')), 12000)
    );

    const url = await Promise.race([
      scraper.getEpisodeUrl(show_id, ep_no, mode, quality),
      timeoutPromise
    ]);

    if (!url) return res.status(404).json({ error: 'Episode URL not found' });
    
    setCache(cacheKey, url, SHORT_CACHE_TTL);
    res.json({ episode_url: url, mode, cached: false });
  } catch (e) {
    console.error('[episode_url] Error:', e.message);
    res.status(500).json({ 
      error: 'Failed to fetch episode URL', 
      details: e.message,
      hint: 'This endpoint may timeout if the source is slow. Try again or use a different quality.'
    });
  }
});

// ── PLAY (REDIRECT) ───────────────────────────────────────────────────────────

app.get('/play', async (req, res) => {
  const { show_id, ep_no, quality = 'best', mode: m } = req.query;
  const mode = m === 'dub' ? 'dub' : 'sub';
  
  if (!show_id || !ep_no) {
    return res.status(400).json({ error: 'Missing show_id or ep_no parameters' });
  }
  
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 12000)
    );

    const url = await Promise.race([
      scraper.getEpisodeUrl(show_id, ep_no, mode, quality),
      timeoutPromise
    ]);

    if (!url) return res.status(404).json({ error: 'Episode not found' });
    res.redirect(url);
  } catch (e) {
    console.error('[play] Error:', e.message);
    res.status(500).json({ error: 'Failed to play episode', details: e.message });
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
  
  if (!show_id || !ep_no) {
    return res.status(400).json({ error: 'Missing show_id or ep_no parameters' });
  }
  
  try {
    const cacheKey = `qualities:${show_id}:${ep_no}:${mode}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ qualities: cached });

    const qs = await scraper.getAvailableQualities(show_id, ep_no, mode);
    setCache(cacheKey, qs, SHORT_CACHE_TTL);
    res.json({ qualities: qs });
  } catch (e) {
    console.error('[qualities] Error:', e.message);
    res.status(500).json({ error: 'Failed to fetch qualities', details: e.message, qualities: [] });
  }
});

// ── THUMBNAILS (BATCH) ────────────────────────────────────────────────────────

app.post('/thumbnails', async (req, res) => {
  const ids = req.body?.ids || req.body?.mal_ids;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: "Missing 'ids' array in request body" });
  }
  
  try {
    const results = {};
    const promises = ids.map(async (id) => {
      try {
        const cacheKey = `thumb:${id}`;
        const cached = getCached(cacheKey);
        
        if (cached) {
          results[id] = cached;
        } else {
          const details = await scraper.getAnimeDetails(id);
          if (details?.thumbnail_url) {
            results[id] = details.thumbnail_url;
            setCache(cacheKey, details.thumbnail_url);
          }
        }
      } catch (e) {
        console.warn(`[thumbnails] Failed for id ${id}:`, e.message);
      }
    });

    await Promise.all(promises);
    res.json(results);
  } catch (e) {
    console.error('[thumbnails] Error:', e.message);
    res.status(500).json({ error: 'Failed to fetch thumbnails', details: e.message });
  }
});

// ── HLS PROXY (VIDEO STREAMING) ───────────────────────────────────────────────

app.get('/hls-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

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

// ── ROOT ENDPOINT (INFO) ──────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    title: 'AnimeVault API',
    status: 'running',
    version: '3.3 (Optimized)',
    source: 'AllAnime (allanime.day)',
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
      qualities: '/qualities?show_id=<id>&ep_no=<ep>&mode=sub|dub',
      thumbnails: '/thumbnails (POST with {ids: []})',
      hls_proxy: '/hls-proxy?url=<encoded_url>',
      health: '/health',
    },
  });
});

// ── 404 HANDLER ───────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// ── ERROR HANDLING ────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── START SERVER ──────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`✅ AnimeVault backend v3.3 running on port ${PORT}`);
  console.log(`   Self URL: ${SELF}`);
  console.log(`   Source: AllAnime (allanime.day)`);
  console.log(`   Features: Request pooling, smart caching, timeout handling`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});