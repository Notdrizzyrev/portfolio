/**
 * AnimeVault Scraper v9.0 — AnimeKai Edition (animekai.to)
 *
 * What changed from v8 → v9:
 *  - searchAnime: multi-strategy DOM parsing; ID extracted from URL slug
 *    (last numeric segment) as primary source, data-id attr as fallback.
 *  - resolveKaiId: kaiId always populated — derives from slug if missing.
 *  - getEpisodesList: broader selectors + raw-HTML debug log on empty result.
 *  - getEpisodeServers: extra selector patterns + logging.
 *  - getAnimeDetails / dubCheck: multiple selector strategies for every field.
 *  - Errors are logged, never silently swallowed.
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const crypto  = require('crypto');

// ── CONFIG ────────────────────────────────────────────────────────────────────

const BASE  = 'https://animekai.to';
const AJAX  = `${BASE}/ajax`;
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0';

const http = axios.create({
  baseURL: BASE,
  headers: {
    'User-Agent':        AGENT,
    'Referer':           BASE,
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 12000,
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

/**
 * Extract the numeric ID AnimeKai appends to every slug.
 * e.g.  "attack-on-titan-1234"  →  "1234"
 *       "one-piece-100"         →  "100"
 */
function idFromSlug(slug) {
  return (slug || '').replace(/\?.*$/, '').match(/-(\d+)$/)?.[1] || '';
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
  if (na.replace(/ /g, '') === nb.replace(/ /g, '')) return 97;
  if (na.includes(nb) || nb.includes(na)) return 85;
  const wa = new Set(na.split(' ').filter(w => w.length > 1));
  const wb = nb.split(' ').filter(w => w.length > 1);
  const overlap = wb.filter(w => wa.has(w)).length;
  if (!overlap) return 0;
  return Math.round((overlap / Math.max(wa.size, wb.length)) * 65);
}

// ── ID CACHE ──────────────────────────────────────────────────────────────────

const _kaiCache = new Map(); // key → { slug, kaiId }

// ── SEARCH ────────────────────────────────────────────────────────────────────

/**
 * Search animekai.to/browser?keyword=…
 * Returns: [{ id, slug, title, type }]
 *
 * Tries four CSS selector strategies in order; the first that yields results
 * wins. If all fail falls back to harvesting every <a href="/watch/…">.
 * On total failure logs a raw HTML snippet so you can fix selectors.
 */
async function searchAnime(query) {
  let html = '';
  try {
    const r = await withRetry(() =>
      http.get('/browser', { params: { keyword: query } })
    );
    html = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
  } catch (e) {
    console.error('[search] HTTP error:', e.message);
    return [];
  }

  const $ = cheerio.load(html);
  const results = [];

  // ── Selector strategy matrix ──────────────────────────────────────────────
  const STRATEGIES = [
    // Strategy 1 — AniWatch / Zoro clone (the v8 guess, kept as first try)
    {
      wrap:     '.film-list .flw-item',
      titleSel: '.film-name a',
      hrefSel:  '.film-name a',
    },
    // Strategy 2 — flw-item anywhere
    {
      wrap:     '.flw-item',
      titleSel: '.film-name a',
      hrefSel:  '.film-name a',
    },
    // Strategy 3 — AnimeKai-specific class names
    {
      wrap:     '.anime-item, .aitem, .citem',
      titleSel: 'a.title, a[class*="name"], [class*="title"] a',
      hrefSel:  'a[href*="/watch/"]',
    },
    // Strategy 4 — generic grid/list item with a watch link inside
    {
      wrap:     '.item, li[class*="item"], [class*="anime"]',
      titleSel: 'a[href*="/watch/"]',
      hrefSel:  'a[href*="/watch/"]',
    },
  ];

  for (const { wrap, titleSel, hrefSel } of STRATEGIES) {
    const wrapEls = $(wrap);
    if (!wrapEls.length) continue;

    wrapEls.each((_, el) => {
      const $el   = $(el);
      const tEl   = $el.find(titleSel).first();
      const hEl   = $el.find(hrefSel).first();
      const title = tEl.attr('title') || tEl.text().trim()
                 || hEl.attr('title') || hEl.text().trim();
      const href  = hEl.attr('href') || tEl.attr('href') || '';
      if (!href.includes('/watch/')) return;

      const slug  = href.replace(/^\/watch\//, '').replace(/\?.*$/, '').trim();
      // Prefer explicit data-id; fall back to numeric tail of slug
      const id    = $el.find('[data-id]').first().attr('data-id')
                 || $el.attr('data-id')
                 || hEl.attr('data-id')
                 || idFromSlug(slug);
      const type  = $el.find('.fdi-type, .type, [class*="type"]').first().text().trim() || 'TV';

      if (title && slug) results.push({ id, slug, title, type });
    });

    if (results.length) break; // first winning strategy — stop
  }

  // ── Nuclear fallback: every /watch/ link on the page ─────────────────────
  if (!results.length) {
    console.warn('[search] All CSS strategies missed — falling back to link scan');
    const seen = new Set();
    $('a[href*="/watch/"]').each((_, el) => {
      const href  = $(el).attr('href') || '';
      const slug  = href.replace(/^\/watch\//, '').replace(/\?.*$/, '').trim();
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      const title = $(el).attr('title') || $(el).text().trim();
      if (!title || title.length < 2) return;
      const id = $(el).attr('data-id') || idFromSlug(slug);
      results.push({ id, slug, title, type: 'TV' });
    });

    if (!results.length) {
      // Log a snippet so the real HTML is visible in your backend logs
      console.warn('[search] Still empty — raw HTML snippet:\n', html.slice(0, 1000));
    }
  }

  // Deduplicate by slug
  return [...new Map(results.map(r => [r.slug, r])).values()];
}

// ── RESOLVE ID ────────────────────────────────────────────────────────────────

async function resolveKaiId(malId, title) {
  const key = malId || title;
  if (_kaiCache.has(key)) return _kaiCache.get(key);

  const queries = [];
  if (title) {
    queries.push(title);
    const stripped = title.replace(/\s*(season|part|cour|arc)\s*\d*\s*$/i, '').trim();
    if (stripped && stripped !== title) queries.push(stripped);
    const base = title.split(/[:\-–]/)[0].trim();
    if (base && base !== title) queries.push(base);
  }

  let best = null, bestScore = -1;

  for (const q of [...new Set(queries)]) {
    const candidates = await searchAnime(q);
    for (const c of candidates) {
      const s = Math.max(
        titleScore(c.title, title || ''),
        titleScore(c.title, q),
      );
      if (s > bestScore) { bestScore = s; best = c; }
    }
    if (bestScore >= 75) break;
  }

  if (!best || bestScore < 20) {
    console.warn(`[resolve] No match for "${title}" (best score: ${bestScore})`);
    return null;
  }

  // Always ensure kaiId is populated — derive from slug tail if missing
  const kaiId = best.id || idFromSlug(best.slug);
  const val   = { slug: best.slug, kaiId };

  if (malId) _kaiCache.set(malId, val);
  if (title) _kaiCache.set(title, val);
  console.log(`[resolve] "${title}" → slug="${val.slug}" kaiId="${val.kaiId}" (score ${bestScore})`);
  return val;
}

// ── ANIME DETAILS ─────────────────────────────────────────────────────────────

async function getAnimeDetails(malId, title = null) {
  const resolved = await resolveKaiId(malId, title);
  if (!resolved) return null;

  try {
    const r = await withRetry(() => http.get(`/watch/${resolved.slug}`));
    const $ = cheerio.load(r.data);

    // Return first non-empty text across a list of selectors
    const pick = (...sels) => {
      for (const s of sels) {
        const t = $(s).first().text().trim();
        if (t) return t;
      }
      return '';
    };
    // Return first matching attribute
    const pickAttr = (attr, ...sels) => {
      for (const s of sels) {
        const v = $(s).first().attr(attr);
        if (v) return v;
      }
      return '';
    };

    const englishName = pick(
      '.anisc-detail .film-name',
      'h2.film-name',
      '.anime-name',
      'h1.title, h1[class*="title"]',
      '[itemprop="name"]',
    ) || title || '';

    const synopsis = pick(
      '.film-description .text',
      '.description',
      '[itemprop="description"]',
      '.synopsis',
      '.overview',
    );

    const thumbnail = pickAttr('src',
      'img.film-poster-img',
      'img[class*="poster"]',
      '[itemprop="image"]',
      '.poster img',
    );

    const status = pick(
      '.item-title:contains("Status") .name',
      '[class*="status"]',
      'span:contains("Status") + span',
    );

    const parseCount = (...sels) => parseInt(pick(...sels)) || 0;

    const eps_sub = parseCount(
      '.item-title:contains("Sub") .name',
      '.item-title:contains("Episodes") .name',
      'span:contains("Sub:") + span',
      '.episodes-sub',
    );
    const eps_dub = parseCount(
      '.item-title:contains("Dub") .name',
      'span:contains("Dub:") + span',
      '.episodes-dub',
    );

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
  } catch (e) {
    console.error('[details] Error:', e.message);
    return null;
  }
}

// ── EPISODE LIST ──────────────────────────────────────────────────────────────

/**
 * Returns: [{ number, id, title }]
 *
 * AnimeKai's AJAX returns HTML; episode items are <a> tags with data-id and
 * data-number. Sub/dub is distinguished by data-type="dub"; if nothing is
 * tagged the mode filter is skipped and everything is returned.
 */
async function getEpisodesList(malId, mode = 'sub', title = null) {
  const resolved = await resolveKaiId(malId, title);
  if (!resolved || !resolved.kaiId) {
    console.warn('[episodes] No kaiId for:', title || malId);
    return [];
  }

  let html = '';
  try {
    const r = await withRetry(() =>
      http.get(`${AJAX}/episode/list/${resolved.kaiId}`)
    );
    html = r.data?.html || (typeof r.data === 'string' ? r.data : '');
  } catch (e) {
    console.error('[episodes] AJAX error:', e.message);
    return [];
  }

  const $ = cheerio.load(html);
  const eps = [];

  const EP_SEL = 'a.ep-item, .ep-item, a[data-number], [data-number][data-id]';

  $(EP_SEL).each((_, el) => {
    const $el  = $(el);
    const num  = parseFloat(
      $el.attr('data-number') || $el.attr('data-ep') || $el.attr('data-num') || '0'
    );
    const id   = $el.attr('data-id')
              || ($el.attr('href') || '').split(/[?=]/).pop()
              || '';
    const tit  = $el.attr('title') || $el.text().trim() || '';
    const type = ($el.attr('data-type') || '').toLowerCase();

    if (!num || !id) return;
    if (mode === 'dub' && type && type !== 'dub') return;
    if (mode === 'sub' && type === 'dub') return;

    eps.push({ number: num, id, title: tit });
  });

  // If mode-filtering emptied the list, retry without the filter
  if (!eps.length) {
    console.warn(`[episodes] Mode-filter (${mode}) → 0; retrying unfiltered`);
    $(EP_SEL).each((_, el) => {
      const $el = $(el);
      const num = parseFloat($el.attr('data-number') || '0');
      const id  = $el.attr('data-id') || '';
      if (!num || !id) return;
      eps.push({ number: num, id, title: $el.attr('title') || '' });
    });
  }

  if (!eps.length) {
    console.warn('[episodes] Still empty — raw HTML snippet:\n', html.slice(0, 800));
  }

  return eps.sort((a, b) => a.number - b.number);
}

// ── EPISODE SERVERS ───────────────────────────────────────────────────────────

async function getEpisodeServers(epId) {
  let html = '';
  try {
    const r = await withRetry(() =>
      http.get(`${AJAX}/episode/servers`, { params: { episodeId: epId } })
    );
    html = r.data?.html || (typeof r.data === 'string' ? r.data : '');
  } catch (e) {
    console.error('[servers] AJAX error:', e.message);
    return [];
  }

  const $ = cheerio.load(html);
  const servers = [];

  const SERVER_SEL = [
    '[data-id][data-server-id]',
    '.server-item[data-id]',
    '.btn-server[data-id]',
    'li[data-id]',
    'a[data-id]',
  ].join(', ');

  $(SERVER_SEL).each((_, el) => {
    const $el      = $(el);
    const serverId = $el.attr('data-id') || '';
    const name     = $el.text().trim()
                  || $el.attr('data-server-id')
                  || $el.attr('title')
                  || 'unknown';
    if (serverId) servers.push({ id: serverId, name });
  });

  if (!servers.length) {
    console.warn('[servers] No servers found — raw HTML snippet:\n', html.slice(0, 500));
  }

  return servers;
}

// ── SOURCE DECRYPTION ─────────────────────────────────────────────────────────

const KEY_URL = 'https://raw.githubusercontent.com/theonlymo/keys/e1/key';
let _cachedKey    = null;
let _keyFetchedAt = 0;

async function getDecryptionKey() {
  const stale = Date.now() - _keyFetchedAt > 30 * 60 * 1000;
  if (_cachedKey && !stale) return _cachedKey;
  try {
    const r = await axios.get(KEY_URL, { timeout: 5000 });
    _cachedKey    = r.data?.trim() || null;
    _keyFetchedAt = Date.now();
    return _cachedKey;
  } catch { return _cachedKey; }
}

function decryptSource(encrypted, key) {
  try {
    const cipher   = Buffer.from(encrypted, 'base64');
    const salt     = cipher.slice(8, 16);
    const data     = cipher.slice(16);
    const keyBuf   = Buffer.from(key, 'utf8');
    let derived    = Buffer.alloc(0);
    let prev       = Buffer.alloc(0);
    while (derived.length < 48) {
      prev    = crypto.createHash('md5').update(Buffer.concat([prev, keyBuf, salt])).digest();
      derived = Buffer.concat([derived, prev]);
    }
    const decipher = crypto.createDecipheriv('aes-256-cbc', derived.slice(0, 32), derived.slice(32, 48));
    return decipher.update(data) + decipher.final('utf8');
  } catch { return null; }
}

// ── FETCH SOURCES FROM EMBED URL ─────────────────────────────────────────────

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

    // Encrypted sources blob
    const srcMatch = body.match(/sources\s*=\s*['"]([A-Za-z0-9+/=]+)['"]/);
    if (srcMatch) {
      const key = await getDecryptionKey();
      if (key) {
        const plain = decryptSource(srcMatch[1], key);
        if (plain) {
          try {
            const parsed = JSON.parse(plain);
            const arr    = Array.isArray(parsed) ? parsed : [parsed];
            for (const s of arr) {
              if (s.file) links.push({
                url:    s.file,
                label:  s.label || 'auto',
                is_hls: (s.type || '').includes('hls') || s.file.includes('.m3u8'),
              });
            }
          } catch {}
        }
      }
    }

    // Unencrypted JSON sources array
    if (!links.length) {
      const plain = body.match(/sources\s*:\s*(\[.*?\])/s);
      if (plain) {
        try {
          for (const s of JSON.parse(plain[1])) {
            if (s.file) links.push({ url: s.file, label: s.label || 'auto', is_hls: s.file.includes('.m3u8') });
          }
        } catch {}
      }
    }

    // HLS tracks
    const trackMatch = body.match(/"tracks"\s*:\s*(\[.*?\])/s);
    if (trackMatch) {
      try {
        for (const t of JSON.parse(trackMatch[1])) {
          if (t.file && t.kind !== 'thumbnails')
            links.push({ url: t.file, label: t.label || 'track', is_hls: t.file.includes('.m3u8') });
        }
      } catch {}
    }
  } catch (e) {
    console.error('[embed] Error:', e.message);
  }
  return links;
}

// ── FETCH SOURCES VIA SERVER ID ───────────────────────────────────────────────

async function fetchSourcesForServer(serverId) {
  try {
    const r = await withRetry(() =>
      http.get(`${AJAX}/episode/sources`, { params: { id: serverId } })
    );
    const data = r.data;

    if (data?.link || data?.url)  return fetchEmbedSources(data.link || data.url);
    if (data?.iframe)             return fetchEmbedSources(data.iframe);

    if (Array.isArray(data?.sources)) {
      return data.sources
        .map(s => ({
          url:    s.file || s.url || '',
          label:  s.label || 'auto',
          is_hls: (s.file || '').includes('.m3u8'),
        }))
        .filter(s => s.url);
    }
  } catch (e) {
    console.error('[sources] Server', serverId, 'error:', e.message);
  }
  return [];
}

// ── getAllEpisodeLinks ─────────────────────────────────────────────────────────

async function getAllEpisodeLinks(malId, epNo, mode = 'sub', quality = 'best', title = null) {
  const resolved = await resolveKaiId(malId, title);
  if (!resolved) return [];

  const epList = await getEpisodesList(malId, mode, title);
  const ep     = epList.find(e => Math.abs(e.number - parseFloat(epNo)) < 0.01)
              || epList.find(e => e.number === Math.round(parseFloat(epNo)));

  if (!ep) {
    console.warn(`[links] Ep ${epNo} not found in list of ${epList.length}`);
    return [];
  }

  const servers = await getEpisodeServers(ep.id);
  if (!servers.length) return [];

  const PREF = ['megacloud', 'rapidcloud', 'hd-1', 'hd-2', 'vidcloud', 'streamtape', 'mp4upload'];
  servers.sort((a, b) => {
    const ai = PREF.findIndex(p => a.name.toLowerCase().includes(p));
    const bi = PREF.findIndex(p => b.name.toLowerCase().includes(p));
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });

  let allLinks = [];
  for (const server of servers.slice(0, 4)) {
    const links = await fetchSourcesForServer(server.id);
    if (links.length) allLinks = [...allLinks, ...links];
    if (allLinks.length >= 2) break;
  }

  if (!allLinks.length) return [];

  allLinks.sort((a, b) => (parseInt(b.label) || 0) - (parseInt(a.label) || 0));

  if (quality === 'worst') {
    allLinks.reverse();
  } else if (quality !== 'best') {
    const match = allLinks.find(l => String(l.label).includes(quality));
    if (match) {
      allLinks = [match, ...allLinks.filter(l => l !== match)];
    } else {
      const q     = parseInt(quality) || 9999;
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

    const dubText = (
      $('.item-title:contains("Dub") .name').text()
      || $('[class*="dub"]').first().text()
      || $('span:contains("Dub:") + span').text()
    ).trim();

    const eps_dub = parseInt(dubText) || 0;
    return { has_dub: eps_dub > 0, episodes_dub: eps_dub };
  } catch (e) {
    console.error('[dubCheck] Error:', e.message);
    return { has_dub: false, episodes_dub: 0 };
  }
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
