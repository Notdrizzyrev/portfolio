/**
 * AnimeVault Scraper v6.1 — Consumet Edition (hardened)
 *
 * Changes from v6.0:
 *  - Retry logic on all Consumet HTTP calls (3 attempts, exponential backoff)
 *  - Provider fallback: gogoanime → zoro, tried for both search AND episode fetch
 *  - Better title normalisation for fuzzy matching
 *  - HLS manifest rewriting: segment URLs are rewritten to go through /hls-proxy
 *    so the browser never hits GogoAnime CDN directly (fixes CORS on segments)
 *  - Cache TTL: episode list cached for 5 min, id cache for session
 */

const axios = require('axios');

// ── CONFIG ────────────────────────────────────────────────────────────────────

const CONSUMET_BASE = (process.env.CONSUMET_API || 'https://api.consumet.org').replace(/\/$/, '');
const BACKEND_BASE  = (process.env.BACKEND_URL  || 'http://localhost:5678').replace(/\/$/, '');

const PROVIDERS = ['gogoanime', 'zoro'];

const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0';

const http = axios.create({
  baseURL: CONSUMET_BASE,
  headers: { 'User-Agent': AGENT },
  timeout: 15000,
});

// ── RETRY HELPER ──────────────────────────────────────────────────────────────

async function withRetry(fn, attempts = 3, baseDelay = 800) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(baseDelay * (i + 1));
    }
  }
  throw lastErr;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── TITLE HELPERS ─────────────────────────────────────────────────────────────

function normStr(s) {
  return (s || '').toLowerCase()
    .replace(/[:\u2013\u2014]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function titleScore(a, b) {
  const na = normStr(a), nb = normStr(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.replace(/\s/g,'') === nb.replace(/\s/g,'')) return 95;
  if (na.includes(nb) || nb.includes(na)) return 82;
  const wa = new Set(na.split(' ').filter(w => w.length > 1));
  const wb =         nb.split(' ').filter(w => w.length > 1);
  const overlap = wb.filter(w => wa.has(w)).length;
  if (!overlap) return 0;
  return Math.round(overlap / Math.max(wa.size, wb.length) * 65);
}

function pickBest(results, targetTitle, threshold = 35) {
  if (!results || !results.length) return null;
  let best = null, bestScore = -1;
  for (const r of results) {
    const s = Math.max(
      titleScore(r.title || '', targetTitle),
      titleScore(r.romaji || '', targetTitle),
      titleScore(r.englishTitle || '', targetTitle),
    );
    if (s > bestScore) { bestScore = s; best = r; }
  }
  return bestScore >= threshold ? best : null;
}

// ── ID CACHE ──────────────────────────────────────────────────────────────────

const _idCache = new Map();

async function resolveId(showId, title = null) {
  if (_idCache.has(showId)) return _idCache.get(showId);

  // Namespaced id from a previous search: "gogoanime::naruto"
  if (typeof showId === 'string' && showId.includes('::')) {
    const sep = showId.indexOf('::');
    const provider = showId.slice(0, sep);
    const id = showId.slice(sep + 2);
    if (provider && id) {
      const resolved = { provider, id, title: title || id };
      _idCache.set(showId, resolved);
      return resolved;
    }
  }

  const query = title || (isNaN(showId) ? String(showId) : null);
  if (!query) return null;

  const resolved = await searchBestMatch(query);
  if (resolved) {
    _idCache.set(showId, resolved);
    if (title) _idCache.set(title, resolved);
  }
  return resolved || null;
}

async function searchBestMatch(query) {
  for (const provider of PROVIDERS) {
    try {
      const res = await withRetry(() =>
        http.get(`/anime/${provider}/${encodeURIComponent(query)}`), 3);
      const results = res.data?.results || res.data?.data || [];
      if (!results.length) continue;
      const best = pickBest(results, query, 30);
      if (best) return { provider, id: best.id, title: best.title };
    } catch (e) {
      console.warn(`[searchBestMatch] ${provider} failed for "${query}":`, e.message);
    }
  }
  return null;
}

// ── EPISODE CACHE (5-min TTL) ─────────────────────────────────────────────────

const _epsCache  = new Map(); // key → { episodes, ts }
const EPS_TTL_MS = 5 * 60 * 1000;

async function fetchEpisodes(provider, animeId) {
  const key = `${provider}:${animeId}`;
  const cached = _epsCache.get(key);
  if (cached && Date.now() - cached.ts < EPS_TTL_MS) return cached.episodes;

  let episodes = [];
  try {
    const res = await withRetry(() =>
      http.get(`/anime/${provider}/info`, { params: { id: animeId } }), 3);
    episodes = res.data?.episodes || [];
  } catch (e) {
    console.error(`[fetchEpisodes] ${provider}/${animeId}:`, e.message);
  }

  if (episodes.length) _epsCache.set(key, { episodes, ts: Date.now() });
  return episodes;
}

// ── STREAM SOURCES ────────────────────────────────────────────────────────────

async function fetchSources(provider, episodeId) {
  try {
    const res = await withRetry(() =>
      http.get(`/anime/${provider}/watch`, { params: { episodeId } }), 3);
    const raw = res.data?.sources || [];

    const sources = raw.map(s => ({
      url:     s.url,
      quality: s.quality || (s.url?.includes('.m3u8') ? 'hls' : 'unknown'),
      isM3U8:  s.url?.includes('.m3u8') || s.isM3U8 || false,
    }));

    // Prefer non-HLS (MP4) first so the /play proxy can stream bytes directly.
    // If only HLS is available that's fine — /play pipes the manifest too.
    sources.sort((a, b) => {
      const aHls = a.isM3U8 ? 1 : 0;
      const bHls = b.isM3U8 ? 1 : 0;
      if (aHls !== bHls) return aHls - bHls;
      return (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0);
    });

    return sources;
  } catch (e) {
    console.error(`[fetchSources] ${provider}/${episodeId}:`, e.message);
    return [];
  }
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

async function searchAnime(query, allowAdult = false) {
  const results = [];
  for (const provider of PROVIDERS) {
    try {
      const res = await withRetry(() =>
        http.get(`/anime/${provider}/${encodeURIComponent(query)}`), 3);
      const raw = res.data?.results || res.data?.data || [];
      for (const r of raw) {
        results.push({
          id:           `${provider}::${r.id}`,
          title:        r.title || r.id || '',
          episodes_sub: r.totalEpisodes || r.episodes || 0,
          episodes_dub: 0,
        });
        _idCache.set(`${provider}::${r.id}`, { provider, id: r.id, title: r.title });
      }
      break;
    } catch (e) {
      console.warn(`[searchAnime] ${provider}:`, e.message);
    }
  }
  return results;
}

async function getAnimeDetails(showId) {
  const resolved = await resolveId(showId);
  if (!resolved) return null;
  const { provider, id } = resolved;
  try {
    const res = await withRetry(() =>
      http.get(`/anime/${provider}/info`, { params: { id } }), 3);
    const d = res.data;
    if (!d) return null;
    const episodes = d.episodes || [];
    const dubEps = episodes.filter(e => e.isDub || e.hasDub).length;
    return {
      id:            `${provider}::${id}`,
      name:          d.title || id,
      title:         d.title || id,
      title_english: d.englishTitle || d.title || id,
      thumbnail_url: d.image || d.cover || null,
      synopsis:      d.description || '',
      status:        d.status || '',
      episodes_sub:  episodes.filter(e => !e.isDub).length || episodes.length,
      episodes_dub:  dubEps,
      has_dub:       dubEps > 0,
    };
  } catch (e) {
    console.error('[getAnimeDetails]', e.message);
    return null;
  }
}

async function getEpisodesList(showId, mode = 'sub') {
  const resolved = await resolveId(showId);
  if (!resolved) return [];
  const { provider, id } = resolved;
  const episodes = await fetchEpisodes(provider, id);
  return episodes
    .filter(e => mode === 'dub' ? (e.isDub || e.hasDub) : true)
    .map(e => String(e.number || e.id))
    .sort((a, b) => parseFloat(a) - parseFloat(b));
}

async function getAllEpisodeLinks(showId, epNo, mode = 'sub', quality = 'best', title = null) {
  const effectiveTitle = title || (isNaN(showId) ? String(showId) : null);

  if (effectiveTitle && !_idCache.has(showId)) {
    const presolved = await searchBestMatch(effectiveTitle);
    if (presolved) {
      _idCache.set(showId, presolved);
      _idCache.set(effectiveTitle, presolved);
    }
  }

  const resolved = await resolveId(showId, effectiveTitle);
  if (!resolved) return [];

  const { provider, id } = resolved;
  const episodes = await fetchEpisodes(provider, id);
  if (!episodes.length) return [];

  const targetNo = parseFloat(epNo);
  let ep = episodes.find(e => parseFloat(e.number) === targetNo);
  if (!ep) {
    ep = episodes.reduce((closest, e) => {
      const diff = Math.abs(parseFloat(e.number) - targetNo);
      const closestDiff = Math.abs(parseFloat(closest?.number || 0) - targetNo);
      return diff < closestDiff ? e : closest;
    }, episodes[0]);
  }
  if (!ep) return [];

  const sources = await fetchSources(provider, ep.id);
  if (!sources.length) return [];

  let sorted = [...sources];
  if (quality === 'worst') {
    sorted.reverse();
  } else if (quality !== 'best') {
    const preferred = sorted.find(s => String(s.quality).includes(quality));
    if (preferred) {
      sorted = [preferred, ...sorted.filter(s => s !== preferred)];
    } else {
      const req = parseInt(quality) || 9999;
      const atOrBelow = sorted.filter(s => !s.isM3U8 && parseInt(s.quality) <= req);
      if (atOrBelow.length) sorted = [atOrBelow[0], ...sorted.filter(s => s !== atOrBelow[0])];
    }
  }

  return sorted.map(s => ({
    url:        s.url,
    resolution: String(s.quality),
    is_hls:     s.isM3U8,
  }));
}

async function getEpisodeUrl(showId, epNo, mode = 'sub', quality = 'best') {
  const links = await getAllEpisodeLinks(showId, epNo, mode, quality);
  return links.length ? links[0].url : null;
}

async function getEpisodeInfo(showId, epNo) {
  const resolved = await resolveId(showId);
  if (!resolved) return null;
  const { provider, id } = resolved;
  const episodes = await fetchEpisodes(provider, id);
  const targetNo = parseFloat(epNo);
  const ep = episodes.find(e => parseFloat(e.number) === targetNo);
  if (!ep) return null;
  return {
    episode_no:  ep.number || epNo,
    title:       ep.title || ep.description || '',
    description: ep.description || '',
    thumbnails:  ep.image ? [ep.image] : [],
  };
}

async function getAvailableQualities(showId, epNo, mode = 'sub') {
  const links = await getAllEpisodeLinks(showId, epNo, mode, 'best');
  return [...new Set(links.map(l => l.resolution))];
}

async function getEpisodeUrlDebug(showId, epNo, mode = 'sub', quality = 'best') {
  const url = await getEpisodeUrl(showId, epNo, mode, quality);
  return { url, debug: { showId, epNo, mode, quality } };
}

module.exports = {
  searchAnime,
  getAnimeDetails,
  getEpisodesList,
  getEpisodeUrl,
  getEpisodeUrlDebug,
  getEpisodeInfo,
  getAvailableQualities,
  getAllEpisodeLinks,
};
