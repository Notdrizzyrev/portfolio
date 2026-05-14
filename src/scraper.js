/**
 * AnimeVault Scraper v7.0 — AllAnime Edition (title-aware)
 *
 * Uses AllAnime (allanime.day) directly — no Consumet dependency.
 * Accepts both AllAnime internal IDs AND plain titles as show_id,
 * so the new frontend (which passes titles) works out of the box.
 */

const axios = require('axios');
const crypto = require('crypto');

// ── CONFIG ────────────────────────────────────────────────────────────────────

const AGENT       = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0';
const ALLANIME_REFR = 'https://allmanga.to';
const ALLANIME_BASE = 'allanime.day';
const ALLANIME_API  = `https://api.${ALLANIME_BASE}`;
const ALLANIME_KEY  = crypto.createHash('sha256').update('Xot36i3lK3:v1').digest('hex');

// Persisted query hash for episode embeds (from ani-cli)
const EPISODE_QUERY_HASH = 'd405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec';

const axiosInstance = axios.create({
  headers: { 'User-Agent': AGENT, 'Referer': ALLANIME_REFR },
  timeout: 8000,
});

// ── HELPERS ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry(fn, attempts = 3, baseDelay = 600) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(baseDelay * (i + 1));
    }
  }
  throw lastErr;
}

// ── DECRYPTION ────────────────────────────────────────────────────────────────

function decrypt(blob) {
  try {
    const data = Buffer.from(blob, 'base64');
    const iv = data.slice(1, 13);
    const ctLen = data.length - 13 - 16;
    const ciphertext = data.slice(13, 13 + ctLen);
    const ctr = Buffer.concat([iv, Buffer.from([0, 0, 0, 2])]);
    const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(ALLANIME_KEY, 'hex'), ctr);
    let dec = decipher.update(ciphertext);
    dec = Buffer.concat([dec, decipher.final()]);
    return dec.toString('utf8');
  } catch { return null; }
}

// ── PROVIDER DECODE ───────────────────────────────────────────────────────────

const decodeMapping = {
  '79':'A','7a':'B','7b':'C','7c':'D','7d':'E','7e':'F','7f':'G','70':'H','71':'I','72':'J','73':'K','74':'L','75':'M','76':'N','77':'O',
  '68':'P','69':'Q','6a':'R','6b':'S','6c':'T','6d':'U','6e':'V','6f':'W','60':'X','61':'Y','62':'Z',
  '59':'a','5a':'b','5b':'c','5c':'d','5d':'e','5e':'f','5f':'g','50':'h','51':'i','52':'j','53':'k','54':'l','55':'m','56':'n','57':'o',
  '48':'p','49':'q','4a':'r','4b':'s','4c':'t','4d':'u','4e':'v','4f':'w','40':'x','41':'y','42':'z',
  '08':'0','09':'1','0a':'2','0b':'3','0c':'4','0d':'5','0e':'6','0f':'7','00':'8','01':'9',
  '15':'-','16':'.','67':'_','46':'~','02':':','17':'/','07':'?','1b':'#','63':'[','65':']','78':'@',
  '19':'!','1c':'$','1e':'&','10':'(','11':')','12':'*','13':'+','14':',','03':';','05':'=','1d':'%',
};

function decodeProviderId(hex) {
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    const part = hex.substring(i, i + 2);
    result += decodeMapping[part] || '';
  }
  return result.replace('/clock', '/clock.json');
}

// ── TITLE MATCHING ────────────────────────────────────────────────────────────

function normTitle(s) {
  return (s || '').toLowerCase()
    .replace(/[:\u2013\u2014]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function titleScore(a, b) {
  const na = normTitle(a), nb = normTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.replace(/\s/g, '') === nb.replace(/\s/g, '')) return 95;
  if (na.includes(nb) || nb.includes(na)) return 82;
  const wa = new Set(na.split(' ').filter(w => w.length > 1));
  const wb = nb.split(' ').filter(w => w.length > 1);
  const overlap = wb.filter(w => wa.has(w)).length;
  if (!overlap) return 0;
  return Math.round(overlap / Math.max(wa.size, wb.length) * 65);
}

// ── ID RESOLUTION CACHE ───────────────────────────────────────────────────────

const _idCache = new Map();

/**
 * Accepts either:
 *  - A real AllAnime ID  (alphanumeric, no spaces)  → used directly
 *  - A title string                                  → searched on AllAnime
 */
async function resolveShowId(showId, title = null) {
  const cacheKey = title ? `${showId}::${title}` : showId;
  if (_idCache.has(cacheKey)) return _idCache.get(cacheKey);

  // Looks like a proper AllAnime internal ID
  const looksLikeId = /^[a-zA-Z0-9]{8,30}$/.test(showId) && !showId.includes(' ');
  if (looksLikeId) {
    _idCache.set(cacheKey, showId);
    return showId;
  }

  // It's a title — search AllAnime
  const query = title || showId;
  const results = await searchAnime(query);
  if (!results.length) return null;

  // Score each result against query and title
  let best = null, bestScore = -1;
  for (const r of results) {
    const s = Math.max(
      titleScore(r.title || '', query),
      titleScore(r.title || '', title || ''),
    );
    if (s > bestScore) { bestScore = s; best = r; }
  }

  if (!best || bestScore < 25) return null;

  _idCache.set(cacheKey, best.id);
  if (title) _idCache.set(title, best.id);
  return best.id;
}

// ── SOURCE PARSING ────────────────────────────────────────────────────────────

function parseSourceLines(apiData) {
  const rawJson = JSON.stringify(apiData);
  let respLines = [];

  if (rawJson.includes('"tobeparsed"')) {
    const data = apiData.data;
    let blobValue = apiData.tobeparsed ||
      (data && data.tobeparsed) ||
      (data && data.episode && data.episode.tobeparsed) || null;

    if (!blobValue) {
      const m = rawJson.match(/"tobeparsed":"([^"]*)"/);
      if (m) blobValue = m[1];
    }

    if (blobValue) {
      const plain = decrypt(blobValue);
      if (plain) {
        const parts = plain.replace(/[{}]/g, '\n').split('\n');
        for (const part of parts) {
          const m = part.match(/"sourceUrl":"--([^"]*)".*"sourceName":"([^"]*)"/);
          if (m) respLines.push({ sourceName: m[2], hex: m[1] });
        }
      }
    }
  } else if (apiData.data?.episode?.sourceUrls) {
    const cleaned = JSON.stringify(apiData.data.episode.sourceUrls)
      .replace(/\\u002F/g, '/').replace(/\\/g, '');
    const parts = cleaned.replace(/[{}]/g, '\n').split('\n');
    for (const part of parts) {
      const m = part.match(/"sourceUrl":"--([^"]*)".*"sourceName":"([^"]*)"/);
      if (m) respLines.push({ sourceName: m[2], hex: m[1] });
    }
  }

  return respLines;
}

// ── LINK FETCHERS ─────────────────────────────────────────────────────────────

async function getLinks(providerPath) {
  const allLinks = [];
  if (providerPath.includes('tools.fast4speed.rsvp')) {
    return [{ resolution: 'Yt', url: providerPath }];
  }

  const fetchUrl = providerPath.startsWith('http')
    ? providerPath : `https://${ALLANIME_BASE}${providerPath}`;

  try {
    const res = await axiosInstance.get(fetchUrl, { timeout: 5000 });
    const data = res.data;

    if (data.links && Array.isArray(data.links)) {
      for (const link of data.links) {
        const url = link.link;
        const res = link.resolutionStr || 'unknown';

        if (url && url.includes('repackager.wixmp.com')) {
          const cleaned = url.replace('repackager.wixmp.com/', '').replace(/\.urlset.*/, '');
          const qm = url.match(/\/,([^/]*),\/mp4/);
          if (qm) {
            for (const q of qm[1].split(',')) {
              const qUrl = cleaned.replace(/,[^/]*/, q);
              allLinks.push({ resolution: q, url: qUrl, is_hls: false });
            }
          } else {
            allLinks.push({ resolution: res, url, is_hls: false });
          }
        } else if (url) {
          allLinks.push({ resolution: res, url, is_hls: url.includes('.m3u8') });
        }
      }
    }

    if (data.hls?.url) {
      allLinks.push({ resolution: 'hls', url: data.hls.url, is_hls: true });
    }
  } catch { /* provider timed out */ }

  return allLinks;
}

function b64urlToHex(b64url) {
  let padded = b64url;
  const mod = padded.length % 4;
  if (mod === 2) padded += '=='; else if (mod === 3) padded += '=';
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('hex');
}

async function getFilemoonLinks(providerPath) {
  const allLinks = [];
  const fetchUrl = providerPath.startsWith('http')
    ? providerPath : `https://${ALLANIME_BASE}${providerPath}`;

  try {
    const res = await axiosInstance.get(fetchUrl, { timeout: 5000 });
    const fmData = res.data;

    if (fmData?.iv && fmData?.payload && fmData?.key_parts) {
      const keyHex = b64urlToHex(fmData.key_parts[0]) + b64urlToHex(fmData.key_parts[1]);
      const ivHex  = b64urlToHex(fmData.iv) + '00000002';

      let pB64 = fmData.payload;
      const pMod = pB64.length % 4;
      if (pMod === 2) pB64 += '=='; else if (pMod === 3) pB64 += '=';
      pB64 = pB64.replace(/-/g, '+').replace(/_/g, '/');
      const payloadBuf = Buffer.from(pB64, 'base64');
      const ciphertext = payloadBuf.slice(0, payloadBuf.length - 16);

      const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(keyHex, 'hex'), Buffer.from(ivHex, 'hex'));
      let dec = decipher.update(ciphertext);
      dec = Buffer.concat([dec, decipher.final()]);
      const plain = dec.toString('utf8');

      const parts = plain.replace(/[{}\[\]]/g, '\n').split('\n');
      for (const part of parts) {
        const m1 = part.match(/"url":"([^"]*)".*"height":(\d+)/);
        const m2 = part.match(/"height":(\d+).*"url":"([^"]*)"/);
        if (m1) allLinks.push({ resolution: m1[2], url: m1[1].replace(/\\u0026/g,'&').replace(/\\u003D/g,'='), is_hls: true });
        else if (m2) allLinks.push({ resolution: m2[1], url: m2[2].replace(/\\u0026/g,'&').replace(/\\u003D/g,'='), is_hls: true });
      }
    }
  } catch { /* filemoon fetch failed */ }

  return allLinks;
}

// ── EPISODE API CALL ──────────────────────────────────────────────────────────

async function fetchEpisodeSources(showId, epNo, mode = 'sub') {
  const episodeGql = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
    episode( showId: $showId translationType: $translationType episodeString: $episodeString ) {
      episodeString sourceUrls
    }
  }`;

  let apiData = null;

  // Try persisted-query GET first (faster, bypasses captcha)
  try {
    const vars = JSON.stringify({ showId, translationType: mode, episodeString: String(epNo) });
    const ext  = JSON.stringify({ persistedQuery: { version: 1, sha256Hash: EPISODE_QUERY_HASH } });
    const url  = `${ALLANIME_API}/api?variables=${encodeURIComponent(vars)}&extensions=${encodeURIComponent(ext)}`;
    const r    = await withRetry(() => axios.get(url, {
      headers: { 'User-Agent': AGENT, 'Referer': ALLANIME_REFR, 'Origin': 'https://youtu-chan.com' },
      timeout: 6000,
    }));
    if (JSON.stringify(r.data).includes('tobeparsed')) apiData = r.data;
  } catch { /* fall through to POST */ }

  if (!apiData) {
    const r = await withRetry(() => axiosInstance.post(`${ALLANIME_API}/api`, {
      variables: { showId, translationType: mode, episodeString: String(epNo) },
      query: episodeGql,
    }));
    apiData = r.data;
  }

  if (apiData?.errors?.length) {
    const cap = apiData.errors.find(e => e.message === 'NEED_CAPTCHA');
    if (cap) throw new Error('NEED_CAPTCHA');
    throw new Error(apiData.errors.map(e => e.message).join(', '));
  }

  return parseSourceLines(apiData);
}

async function resolveAllLinks(respLines) {
  const providerDefs = [
    { name: 'Default',  filemoon: false },
    { name: 'Yt-mp4',  filemoon: false },
    { name: 'S-mp4',   filemoon: false },
    { name: 'Luf-Mp4', filemoon: false },
    { name: 'Fm-mp4',  filemoon: true  },
  ];

  const results = await Promise.all(providerDefs.map(async prov => {
    const entry = respLines.find(r => r.sourceName === prov.name);
    if (!entry) return [];
    const decodedPath = decodeProviderId(entry.hex);
    if (!decodedPath) return [];
    return prov.filemoon ? getFilemoonLinks(decodedPath) : getLinks(decodedPath);
  }));

  return results.flat();
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

async function searchAnime(query, nsfw = false) {
  const gql = `query($search: SearchInput $limit: Int $page: Int $countryOrigin: VaildCountryOriginEnumType) {
    shows( search: $search limit: $limit page: $page countryOrigin: $countryOrigin ) {
      edges { _id name englishName availableEpisodes __typename }
    }
  }`;

  try {
    const r = await withRetry(() => axiosInstance.post(`${ALLANIME_API}/api`, {
      variables: { search: { allowAdult: !!nsfw, allowUnknown: false, query }, limit: 40, page: 1, countryOrigin: 'ALL' },
      query: gql,
    }));
    const shows = r.data?.data?.shows?.edges || [];
    return shows.map(s => ({
      id:           s._id,
      title:        s.englishName || s.name.replace(/\\"/g, '"'),
      episodes_sub: parseInt(s.availableEpisodes?.sub)  || 0,
      episodes_dub: parseInt(s.availableEpisodes?.dub)  || 0,
    }));
  } catch { return []; }
}

async function getAnimeDetails(showId, title = null) {
  const resolvedId = await resolveShowId(showId, title);
  if (!resolvedId) return null;

  const gql = `query ($showId: String!) {
    show( _id: $showId ) {
      _id name englishName nativeName thumbnail description status availableEpisodesDetail
    }
  }`;

  try {
    const r = await withRetry(() => axiosInstance.post(`${ALLANIME_API}/api`, {
      variables: { showId: resolvedId }, query: gql,
    }));
    const s = r.data?.data?.show;
    if (!s) return null;

    const subEps = s.availableEpisodesDetail?.sub?.length || 0;
    const dubEps = s.availableEpisodesDetail?.dub?.length || 0;
    return {
      id:            resolvedId,
      title:         s.englishName || s.name,
      title_english: s.englishName || s.name,
      thumbnail_url: s.thumbnail,
      synopsis:      (s.description || '').replace(/<[^>]*>/g, ''),
      status:        s.status,
      episodes_sub:  subEps,
      episodes_dub:  dubEps,
      has_dub:       dubEps > 0,
    };
  } catch { return null; }
}

async function getEpisodesList(showId, mode = 'sub', title = null) {
  const resolvedId = await resolveShowId(showId, title);
  if (!resolvedId) return [];

  const gql = `query ($showId: String!) {
    show( _id: $showId ) { _id availableEpisodesDetail }
  }`;

  try {
    const r = await withRetry(() => axiosInstance.post(`${ALLANIME_API}/api`, {
      variables: { showId: resolvedId }, query: gql,
    }));
    const details = r.data?.data?.show?.availableEpisodesDetail;
    const eps = details?.[mode] || [];
    return eps.sort((a, b) => parseFloat(a) - parseFloat(b));
  } catch { return []; }
}

async function getAllEpisodeLinks(showId, epNo, mode = 'sub', quality = 'best', title = null) {
  const resolvedId = await resolveShowId(showId, title);
  if (!resolvedId) return [];

  const respLines = await fetchEpisodeSources(resolvedId, epNo, mode).catch(() => null);
  if (!respLines || !respLines.length) return [];

  let allLinks = await resolveAllLinks(respLines);
  if (!allLinks.length) return [];

  // Sort: non-HLS (MP4) first, then by resolution descending
  allLinks.sort((a, b) => {
    const aHls = a.is_hls ? 1 : 0, bHls = b.is_hls ? 1 : 0;
    if (aHls !== bHls) return aHls - bHls;
    return (parseInt(b.resolution) || 0) - (parseInt(a.resolution) || 0);
  });

  // Apply quality preference
  if (quality === 'worst') {
    allLinks.reverse();
  } else if (quality !== 'best') {
    const pref = allLinks.find(l => String(l.resolution).includes(quality));
    if (pref) {
      allLinks = [pref, ...allLinks.filter(l => l !== pref)];
    } else {
      const req = parseInt(quality) || 9999;
      const below = allLinks.filter(l => !l.is_hls && parseInt(l.resolution) <= req);
      if (below.length) allLinks = [below[0], ...allLinks.filter(l => l !== below[0])];
    }
  }

  return allLinks.map(l => ({
    url:        l.url.replace(/([^:])\/\//g, '$1/'),
    resolution: String(l.resolution),
    is_hls:     l.is_hls,
  }));
}

async function getEpisodeUrl(showId, epNo, mode = 'sub', quality = 'best', title = null) {
  const links = await getAllEpisodeLinks(showId, epNo, mode, quality, title);
  return links.length ? links[0].url : null;
}

async function getEpisodeInfo(showId, epNo, title = null) {
  const resolvedId = await resolveShowId(showId, title);
  if (!resolvedId) return null;

  const epNum = parseFloat(epNo);
  const gql = `query ($showId: String!, $epNum: Float!) {
    episodeInfos( showId: $showId episodeNumStart: $epNum episodeNumEnd: $epNum ) {
      episodeIdNum notes description thumbnails
    }
  }`;

  try {
    const r = await withRetry(() => axiosInstance.post(`${ALLANIME_API}/api`, {
      variables: { showId: resolvedId, epNum }, query: gql,
    }));
    const infos = r.data?.data?.episodeInfos;
    if (!infos?.length) return null;
    const info = infos[0];
    const thumbnails = (info.thumbnails || []).map(t =>
      t.startsWith('/') ? `https://${ALLANIME_BASE}${t}` : t);
    return { episode_no: info.episodeIdNum, title: info.notes || '', description: info.description || '', thumbnails };
  } catch { return null; }
}

async function getAvailableQualities(showId, epNo, mode = 'sub', title = null) {
  const links = await getAllEpisodeLinks(showId, epNo, mode, 'best', title);
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
