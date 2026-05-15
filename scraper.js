/**
 * AnimeVault Scraper v8.0 — AnimeKai Edition (animekai.to)
 *
 * Sources: animekai.to (search + episode list + stream sources)
 * Providers supported: MegaCloud / RapidCloud / StreamTape / Mp4Upload
 *
 * Flow:
 *   1. searchAnime(query)          → fuzzy search animekai.to
 *   2. resolveKaiId(malId, title)  → MAL id → animekai slug (cached)
 *   3. getEpisodesList(id, mode)   → list of episode objects {id, number}
 *   4. fetchSources(epId)          → encrypted embed → decrypted m3u8/mp4 URLs
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const crypto  = require('crypto');

// ── CONFIG ────────────────────────────────────────────────────────────────────

const BASE     = 'https://animekai.to';
const AJAX     = `${BASE}/ajax`;
const AGENT    = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0';

const http = axios.create({
  baseURL: BASE,
  headers: {
    'User-Agent': AGENT,
    'Referer':    BASE,
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 10000,
});

// ── HELPERS ───────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, tries = 3, base = 700) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (i < tries - 1) await sleep(base * (i + 1));
    }
  }
  throw last;
}

// ── TITLE HELPERS ─────────────────────────────────────────────────────────────

function norm(s) {
  return (s || '').toLowerCase()
    .replace(/[:\u2013\u2014!?'"]/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function titleScore(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.replace(/ /g,'') === nb.replace(/ /g,'')) return 97;
  if (na.includes(nb) || nb.includes(na)) return 85;
  const wa = new Set(na.split(' ').filter(w => w.length > 1));
  const wb = nb.split(' ').filter(w => w.length > 1);
  const overlap = wb.filter(w => wa.has(w)).length;
  if (!overlap) return 0;
  const ratio = overlap / Math.max(wa.size, wb.length);
  return Math.round(ratio * 65);
}

// ── ID CACHE ──────────────────────────────────────────────────────────────────

const _kaiCache = new Map(); // malId → { slug, kaiId }

// ── SEARCH ────────────────────────────────────────────────────────────────────

/**
 * Search animekai.to — returns [{id, slug, title, type, episodes_sub, episodes_dub}]
 * id   = numeric animekai show ID (used for episode list)
 * slug = URL slug (e.g. "one-piece-100")
 */
async function searchAnime(query) {
  try {
    const r = await withRetry(() =>
      http.get('/browser', { params: { keyword: query } })
    );
    const $ = cheerio.load(r.data);
    const results = [];

    $('.film-list .flw-item').each((_, el) => {
      const a     = $(el).find('.film-name a');
      const title = a.text().trim();
      const href  = a.attr('href') || '';           // e.g. /watch/one-piece-100
      const slug  = href.replace(/^\/watch\//, '').replace(/\?.*$/, '');
      const idEl  = $(el).find('[data-id]');
      const id    = idEl.attr('data-id') || $(el).attr('data-id') || '';
      const type  = $(el).find('.fdi-type').text().trim() || 'TV';

      if (title && slug) {
        results.push({ id, slug, title, type });
      }
    });

    return results;
  } catch {
    return [];
  }
}

// ── RESOLVE ID ────────────────────────────────────────────────────────────────

async function resolveKaiId(malId, title) {
  const key = malId || title;
  if (_kaiCache.has(key)) return _kaiCache.get(key);

  const queries = [];
  if (title) queries.push(title);

  // Also try stripping season suffixes
  if (title) {
    const stripped = title.replace(/\s*(season|part|cour|arc)\s*\d*\s*$/i, '').trim();
    if (stripped && stripped !== title) queries.push(stripped);
    queries.push(title.split(/[:\-–]/)[0].trim());
  }

  let best = null, bestScore = -1;

  for (const q of [...new Set(queries)]) {
    const results = await searchAnime(q);
    for (const r of results) {
      const s = Math.max(
        titleScore(r.title, title || ''),
        titleScore(r.title, q),
      );
      if (s > bestScore) { bestScore = s; best = r; }
    }
    if (bestScore >= 75) break;
  }

  if (!best || bestScore < 20) return null;

  const val = { slug: best.slug, kaiId: best.id };
  if (malId) _kaiCache.set(malId, val);
  if (title) _kaiCache.set(title, val);
  return val;
}

// ── ANIME DETAILS ─────────────────────────────────────────────────────────────

async function getAnimeDetails(malId, title = null) {
  const resolved = await resolveKaiId(malId, title);
  if (!resolved) return null;

  try {
    const r = await withRetry(() => http.get(`/watch/${resolved.slug}`));
    const $ = cheerio.load(r.data);

    const englishName = $('.anisc-detail .film-name').text().trim()
      || $('h2.film-name').text().trim() || title || '';
    const synopsis  = $('.film-description .text').text().trim()
      || $('[itemprop="description"]').text().trim() || '';
    const thumbnail = $('img.film-poster-img').attr('src')
      || $('[itemprop="image"]').attr('src') || '';
    const status    = $('.item-title:contains("Status") .name').text().trim() || '';

    // Episode counts shown on detail page
    const subText = $('.item-title:contains("Sub") .name').text().trim();
    const dubText = $('.item-title:contains("Dub") .name').text().trim();
    const eps_sub = parseInt(subText) || 0;
    const eps_dub = parseInt(dubText) || 0;

    return {
      id:            resolved.slug,
      kaiId:         resolved.kaiId,
      title:         englishName,
      title_english: englishName,
      thumbnail_url: thumbnail,
      synopsis:      synopsis.replace(/<[^>]*>/g, ''),
      status,
      episodes_sub:  eps_sub,
      episodes_dub:  eps_dub,
      has_dub:       eps_dub > 0,
    };
  } catch { return null; }
}

// ── EPISODE LIST ──────────────────────────────────────────────────────────────

/**
 * Returns an array of episode objects:
 * [{ number: 1, id: 'ep-id-string', title: 'Episode Title' }, …]
 */
async function getEpisodesList(malId, mode = 'sub', title = null) {
  const resolved = await resolveKaiId(malId, title);
  if (!resolved || !resolved.kaiId) return [];

  try {
    const r = await withRetry(() =>
      http.get(`${AJAX}/episode/list/${resolved.kaiId}`)
    );

    const html = r.data?.html || r.data;
    const $    = cheerio.load(html);
    const eps  = [];

    $('a.ep-item, .ep-item a, [data-number]').each((_, el) => {
      const $el   = $(el);
      const num   = parseFloat($el.attr('data-number') || $el.attr('data-ep') || '0');
      const id    = $el.attr('data-id') || $el.attr('href')?.split('=').pop() || '';
      const tit   = $el.attr('title') || $el.text().trim() || '';
      const isDub = ($el.attr('data-type') || '').toLowerCase() === 'dub';

      if (!num || !id) return;
      if (mode === 'dub' && !isDub) return;
      if (mode === 'sub' && isDub) return;

      eps.push({ number: num, id, title: tit });
    });

    // If mode filtering returned nothing, return all (site may not separate)
    if (!eps.length) {
      $('a.ep-item, [data-number]').each((_, el) => {
        const $el = $(el);
        const num = parseFloat($el.attr('data-number') || '0');
        const id  = $el.attr('data-id') || '';
        if (!num || !id) return;
        eps.push({ number: num, id, title: $el.attr('title') || '' });
      });
    }

    return eps.sort((a, b) => a.number - b.number);
  } catch { return []; }
}

// ── EPISODE SERVERS ───────────────────────────────────────────────────────────

async function getEpisodeServers(epId) {
  try {
    const r = await withRetry(() =>
      http.get(`${AJAX}/episode/servers`, { params: { episodeId: epId } })
    );
    const html = r.data?.html || r.data;
    const $    = cheerio.load(html);
    const servers = [];

    $('[data-id][data-server-id], .server-item[data-id]').each((_, el) => {
      const $el      = $(el);
      const serverId = $el.attr('data-id') || '';
      const name     = $el.text().trim() || $el.attr('data-server-id') || 'unknown';
      if (serverId) servers.push({ id: serverId, name });
    });

    return servers;
  } catch { return []; }
}

// ── SOURCE DECRYPTION (MegaCloud / RapidCloud) ────────────────────────────────

// These keys are periodically updated by the site.
// Key source: https://raw.githubusercontent.com/theonlymo/keys/e1/key (community-maintained)
const KEY_URL = 'https://raw.githubusercontent.com/theonlymo/keys/e1/key';
let _cachedKey = null;
let _keyFetchedAt = 0;

async function getDecryptionKey() {
  const stale = Date.now() - _keyFetchedAt > 30 * 60 * 1000; // refresh every 30 min
  if (_cachedKey && !stale) return _cachedKey;
  try {
    const r = await axios.get(KEY_URL, { timeout: 5000 });
    _cachedKey     = r.data?.trim() || null;
    _keyFetchedAt  = Date.now();
    return _cachedKey;
  } catch { return _cachedKey; } // use stale key on failure
}

function decryptSource(encrypted, key) {
  try {
    const cipher = Buffer.from(encrypted, 'base64');
    const salt   = cipher.slice(8, 16);
    const data   = cipher.slice(16);

    // OpenSSL EVP_BytesToKey with MD5
    const keyBuf = Buffer.from(key, 'utf8');
    let derived = Buffer.alloc(0);
    let prev    = Buffer.alloc(0);
    while (derived.length < 48) {
      prev = crypto.createHash('md5').update(Buffer.concat([prev, keyBuf, salt])).digest();
      derived = Buffer.concat([derived, prev]);
    }
    const aesKey = derived.slice(0, 32);
    const iv     = derived.slice(32, 48);

    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    return decipher.update(data) + decipher.final('utf8');
  } catch { return null; }
}

// ── FETCH SOURCES FROM EMBED ──────────────────────────────────────────────────

async function fetchEmbedSources(embedUrl) {
  const links = [];
  try {
    const r = await withRetry(() =>
      axios.get(embedUrl, {
        headers: { 'User-Agent': AGENT, 'Referer': BASE },
        timeout: 8000,
      })
    );
    const body = r.data;

    // Extract encrypted sources blob
    const srcMatch = body.match(/sources\s*=\s*['"]([A-Za-z0-9+/=]+)['"]/);
    if (srcMatch) {
      const key = await getDecryptionKey();
      if (key) {
        const plain = decryptSource(srcMatch[1], key);
        if (plain) {
          try {
            const parsed = JSON.parse(plain);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            for (const s of arr) {
              if (s.file) {
                links.push({
                  url:    s.file,
                  label:  s.label || 'auto',
                  is_hls: (s.type || '').includes('hls') || s.file.includes('.m3u8'),
                });
              }
            }
          } catch {}
        }
      }
    }

    // Fallback: plain JSON sources array (not encrypted)
    if (!links.length) {
      const plain = body.match(/sources\s*:\s*(\[.*?\])/s);
      if (plain) {
        try {
          const arr = JSON.parse(plain[1]);
          for (const s of arr) {
            if (s.file) links.push({ url: s.file, label: s.label || 'auto', is_hls: s.file.includes('.m3u8') });
          }
        } catch {}
      }
    }

    // HLS tracks array
    const trackMatch = body.match(/"tracks"\s*:\s*(\[.*?\])/s);
    if (trackMatch) {
      try {
        const tracks = JSON.parse(trackMatch[1]);
        for (const t of tracks) {
          if (t.file && t.kind !== 'thumbnails') {
            links.push({ url: t.file, label: t.label || 'track', is_hls: t.file.includes('.m3u8') });
          }
        }
      } catch {}
    }
  } catch {}
  return links;
}

// ── FETCH SOURCES VIA SERVER ID ───────────────────────────────────────────────

async function fetchSourcesForServer(serverId) {
  try {
    const r = await withRetry(() =>
      http.get(`${AJAX}/episode/sources`, { params: { id: serverId } })
    );
    const data = r.data;

    // Direct link returned
    if (data?.link || data?.url) {
      const url = data.link || data.url;
      return await fetchEmbedSources(url);
    }

    // Embed iframe URL
    if (data?.iframe) return await fetchEmbedSources(data.iframe);

    // Sources array returned directly
    if (Array.isArray(data?.sources)) {
      return data.sources.map(s => ({
        url:    s.file || s.url || '',
        label:  s.label || 'auto',
        is_hls: (s.file||'').includes('.m3u8'),
      })).filter(s => s.url);
    }
  } catch {}
  return [];
}

// ── getAllEpisodeLinks ─────────────────────────────────────────────────────────

async function getAllEpisodeLinks(malId, epNo, mode = 'sub', quality = 'best', title = null) {
  const resolved = await resolveKaiId(malId, title);
  if (!resolved) return [];

  // Get episode list → find matching episode
  const epList = await getEpisodesList(malId, mode, title);
  const target  = epList.find(e => Math.abs(e.number - parseFloat(epNo)) < 0.01)
                || epList.find(e => e.number === Math.round(parseFloat(epNo)));

  if (!target) return [];

  // Get servers for this episode
  const servers = await getEpisodeServers(target.id);
  if (!servers.length) return [];

  // Preferred server order: megacloud → rapidcloud → streamsb → streamtape
  const PREF = ['megacloud','rapidcloud','hd-1','hd-2','vidcloud','streamtape','mp4upload'];
  servers.sort((a, b) => {
    const ai = PREF.findIndex(p => a.name.toLowerCase().includes(p));
    const bi = PREF.findIndex(p => b.name.toLowerCase().includes(p));
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });

  let allLinks = [];
  for (const server of servers.slice(0, 4)) { // try up to 4 servers
    const links = await fetchSourcesForServer(server.id);
    if (links.length) { allLinks = [...allLinks, ...links]; }
    if (allLinks.length >= 2) break; // have enough, stop
  }

  if (!allLinks.length) return [];

  // Sort: HLS first, then by quality label desc
  allLinks.sort((a, b) => {
    const qa = parseInt(a.label) || 0;
    const qb = parseInt(b.label) || 0;
    return qb - qa;
  });

  if (quality === 'worst') allLinks.reverse();
  else if (quality !== 'best') {
    const q = parseInt(quality) || 9999;
    const match = allLinks.find(l => String(l.label).includes(quality));
    if (match) allLinks = [match, ...allLinks.filter(l => l !== match)];
    else {
      const below = allLinks.filter(l => parseInt(l.label) <= q);
      if (below.length) allLinks = [below[0], ...allLinks.filter(l => l !== below[0])];
    }
  }

  return allLinks.map(l => ({
    url:        l.url,
    resolution: String(l.label),
    is_hls:     !!l.is_hls,
  }));
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

async function getEpisodeUrl(malId, epNo, mode = 'sub', quality = 'best', title = null) {
  const links = await getAllEpisodeLinks(malId, epNo, mode, quality, title);
  return links.length ? links[0].url : null;
}

async function getAvailableQualities(malId, epNo, mode = 'sub', title = null) {
  const links = await getAllEpisodeLinks(malId, epNo, mode, 'best', title);
  return [...new Set(links.map(l => l.resolution))];
}

async function dubCheck(malId, title = null) {
  const resolved = await resolveKaiId(malId, title);
  if (!resolved) return { has_dub: false, episodes_dub: 0 };
  try {
    const r = await withRetry(() => http.get(`/watch/${resolved.slug}`));
    const $ = cheerio.load(r.data);
    const dubText = $('.item-title:contains("Dub") .name').text().trim();
    const eps_dub = parseInt(dubText) || 0;
    return { has_dub: eps_dub > 0, episodes_dub: eps_dub };
  } catch { return { has_dub: false, episodes_dub: 0 }; }
}

module.exports = {
  searchAnime,
  getAnimeDetails,
  getEpisodesList,
  getEpisodeUrl,
  getAllEpisodeLinks,
  getAvailableQualities,
  dubCheck,
  resolveKaiId,
};
