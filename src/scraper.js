/**
 * AnimeVault Scraper v6.0 — Consumet Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces AllAnime (blocked by CAPTCHA) with the Consumet API which wraps
 * GogoAnime, Zoro/AniWatch, and AnimePahe — no captcha, no domain hunting.
 *
 * Public Consumet instance:  https://api.consumet.org
 * Self-host docs:            https://docs.consumet.org
 *
 * All exported function signatures are identical to the old scraper so
 * server.js requires NO changes.
 *
 * Exported:
 *   searchAnime(query, allowAdult)
 *   getAnimeDetails(showId)
 *   getEpisodesList(showId, mode)
 *   getEpisodeUrl(showId, epNo, mode, quality)
 *   getAllEpisodeLinks(showId, epNo, mode, quality, title)
 *   getEpisodeInfo(showId, epNo)
 *   getAvailableQualities(showId, epNo, mode)
 *   getEpisodeUrlDebug(showId, epNo, mode, quality)
 */

const axios = require('axios');

// ── CONFIG ────────────────────────────────────────────────────────────────────

// Primary: official public Consumet instance.
// Override with env var if you self-host: CONSUMET_API=https://your-instance.com
const CONSUMET_BASE = (process.env.CONSUMET_API || 'https://api.consumet.org').replace(/\/$/, '');

// Provider priority order.  We try each in turn until one returns a result.
//   gogoanime  – most complete, fast, MP4 + HLS
//   zoro       – HLS only, good for newer simulcasts
//   animefox   – fallback
const PROVIDERS = ['gogoanime', 'zoro'];

const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0';

const http = axios.create({
  baseURL: CONSUMET_BASE,
  headers: { 'User-Agent': AGENT },
  timeout: 15000,
});

// ── TINY HELPERS ──────────────────────────────────────────────────────────────

function normStr(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Simple title similarity 0-100.
 * Shared words / max(words) * 100.
 */
function titleScore(a, b) {
  const wa = new Set(normStr(a).split(' ').filter(Boolean));
  const wb = new Set(normStr(b).split(' ').filter(Boolean));
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  wa.forEach(w => { if (wb.has(w)) shared++; });
  return Math.round(shared / Math.max(wa.size, wb.size) * 100);
}

/**
 * Pick the best match from a Consumet search result list against a known title.
 * Returns the result object or null.
 */
function pickBest(results, targetTitle, threshold = 40) {
  if (!results || !results.length) return null;
  let best = null, bestScore = -1;
  for (const r of results) {
    const s = Math.max(
      titleScore(r.title,         targetTitle),
      titleScore(r.romaji || '',  targetTitle),
      titleScore(r.englishTitle || '', targetTitle),
    );
    if (s > bestScore) { bestScore = s; best = r; }
  }
  return bestScore >= threshold ? best : null;
}

// ── ID CACHE ─────────────────────────────────────────────────────────────────
// Maps MAL/internal showId → { provider, id } so we don't re-search every call.
const _idCache = new Map();

/**
 * Resolve an AnimeVault showId (which may be a MAL id, a title string, or
 * already a Consumet provider id) to a { provider, id } pair.
 *
 * Strategy:
 *  1. If it's already cached, return cache hit.
 *  2. Try searchAnimeOnProvider() with the raw id as a query (catches numeric
 *     MAL ids if the title isn't known).
 *  3. Caller can also pass `title` to seed the search — used by getAllEpisodeLinks.
 */
async function resolveId(showId, title = null) {
  if (_idCache.has(showId)) return _idCache.get(showId);

  const query = title || String(showId);
  const resolved = await searchBestMatch(query);
  if (resolved) {
    _idCache.set(showId, resolved);
    return resolved;
  }
  return null;
}

/**
 * Search all providers in priority order and return { provider, id, title }
 * for the best match, or null if nothing found.
 */
async function searchBestMatch(query) {
  for (const provider of PROVIDERS) {
    try {
      const res = await http.get(`/anime/${provider}/${encodeURIComponent(query)}`);
      const results = res.data?.results || res.data?.data || [];
      if (!results.length) continue;

      // For gogoanime the result id is the slug (e.g. "naruto-episode-220")
      // but the search result id is the show slug (e.g. "naruto").
      const best = pickBest(results, query, 35);
      if (best) return { provider, id: best.id, title: best.title };
    } catch (e) {
      console.warn(`[searchBestMatch] ${provider} failed for "${query}":`, e.message);
    }
  }
  return null;
}

// ── EPISODE LIST CACHE ────────────────────────────────────────────────────────
const _epsCache = new Map(); // key: `${provider}:${id}` → episodes array

async function fetchEpisodes(provider, animeId) {
  const cacheKey = `${provider}:${animeId}`;
  if (_epsCache.has(cacheKey)) return _epsCache.get(cacheKey);

  let episodes = [];

  try {
    // Consumet info endpoint: /anime/<provider>/info?id=<animeId>
    const res = await http.get(`/anime/${provider}/info`, { params: { id: animeId } });
    episodes = res.data?.episodes || [];
  } catch (e) {
    console.error(`[fetchEpisodes] ${provider}/${animeId}:`, e.message);
  }

  if (episodes.length) _epsCache.set(cacheKey, episodes);
  return episodes;
}

// ── STREAM SOURCES ────────────────────────────────────────────────────────────

/**
 * Fetch stream sources for a given Consumet episode id.
 * Returns array of { url, quality, isM3U8 } sorted best-first.
 */
async function fetchSources(provider, episodeId) {
  try {
    const res = await http.get(`/anime/${provider}/watch`, { params: { episodeId } });
    const raw = res.data?.sources || [];

    // Normalise quality labels
    const sources = raw.map(s => ({
      url:     s.url,
      quality: s.quality || (s.url?.includes('.m3u8') ? 'hls' : 'unknown'),
      isM3U8:  s.url?.includes('.m3u8') || s.isM3U8 || false,
    }));

    // Sort: non-HLS (MP4) first, then by numeric quality desc
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

/**
 * Search for anime by title.
 * Returns array of { id, title, episodes_sub, episodes_dub }
 */
async function searchAnime(query, allowAdult = false) {
  const results = [];

  for (const provider of PROVIDERS) {
    try {
      const res = await http.get(`/anime/${provider}/${encodeURIComponent(query)}`);
      const raw = res.data?.results || res.data?.data || [];
      for (const r of raw) {
        results.push({
          id:           `${provider}::${r.id}`,  // namespaced so resolveId works later
          title:        r.title || r.id || '',
          episodes_sub: r.totalEpisodes || r.episodes || 0,
          episodes_dub: 0,  // Consumet search doesn't expose dub count at this level
        });
        // Pre-populate id cache with the resolved provider+id
        _idCache.set(`${provider}::${r.id}`, { provider, id: r.id, title: r.title });
      }
      break; // first provider that succeeds is enough for search
    } catch (e) {
      console.warn(`[searchAnime] ${provider}:`, e.message);
    }
  }

  return results;
}

/**
 * Get anime details by showId.
 * showId may be:
 *   - A namespaced id like "gogoanime::naruto"
 *   - A title string
 *   - A MAL numeric id (will trigger a title search)
 */
async function getAnimeDetails(showId) {
  const resolved = await resolveId(showId);
  if (!resolved) return null;

  const { provider, id } = resolved;

  try {
    const res = await http.get(`/anime/${provider}/info`, { params: { id } });
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

/**
 * Get list of episode numbers for a show.
 * mode: 'sub' | 'dub'
 */
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

/**
 * Get all stream links for an episode.
 * Returns array of { url, resolution, is_hls }
 */
async function getAllEpisodeLinks(showId, epNo, mode = 'sub', quality = 'best', title = null) {
  // If title provided, seed the cache with it for better matching
  if (title && !_idCache.has(showId)) {
    const resolved = await searchBestMatch(title);
    if (resolved) _idCache.set(showId, resolved);
  }

  const resolved = await resolveId(showId, title);
  if (!resolved) return [];

  const { provider, id } = resolved;
  const episodes = await fetchEpisodes(provider, id);

  if (!episodes.length) return [];

  // Find the matching episode
  const targetNo = parseFloat(epNo);
  let ep = episodes.find(e => parseFloat(e.number) === targetNo);

  // Fallback: nearest episode number
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

  // Sort by quality preference
  let sorted = [...sources];
  if (quality === 'worst') {
    sorted.reverse();
  } else if (quality !== 'best') {
    const req = parseInt(quality) || 9999;
    const preferred = sorted.find(s => String(s.quality).includes(quality));
    if (preferred) {
      sorted = [preferred, ...sorted.filter(s => s !== preferred)];
    } else {
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

/**
 * Get a single stream URL (best quality by default).
 */
async function getEpisodeUrl(showId, epNo, mode = 'sub', quality = 'best') {
  const links = await getAllEpisodeLinks(showId, epNo, mode, quality);
  return links.length ? links[0].url : null;
}

/**
 * Episode metadata (title, description, thumbnail).
 * Consumet doesn't always provide per-episode metadata; we return what we can.
 */
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

/**
 * Return available quality strings for an episode.
 */
async function getAvailableQualities(showId, epNo, mode = 'sub') {
  const links = await getAllEpisodeLinks(showId, epNo, mode, 'best');
  return [...new Set(links.map(l => l.resolution))];
}

/**
 * Debug wrapper — same as getEpisodeUrl but returns an object.
 */
async function getEpisodeUrlDebug(showId, epNo, mode = 'sub', quality = 'best') {
  const url = await getEpisodeUrl(showId, epNo, mode, quality);
  return { url, debug: { showId, epNo, mode, quality } };
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────

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
