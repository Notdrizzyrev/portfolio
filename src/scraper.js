const axios = require('axios');
const crypto = require('crypto');

const AGENT         = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0';
const ALLANIME_REFR = 'https://allmanga.to';
const ALLANIME_BASE = 'allanime.day';
const EPISODE_QUERY_HASH = 'd405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec';

// Lazy-init so a crypto error doesn't crash the module at require() time
let _KEY = null;
function getKey() {
  if (!_KEY) _KEY = crypto.createHash('sha256').update('Xot36i3lK3:v1').digest('hex');
  return _KEY;
}

const API_HOSTS = [
  'https://api.allanime.day',
  'https://api.allanime.to',
];

const axiosInstance = axios.create({
  headers: { 'User-Agent': AGENT, 'Referer': ALLANIME_REFR },
  timeout: 8000
});

// POST to first API host that responds successfully
async function apiPost(path, body) {
  let lastErr;
  for (const host of API_HOSTS) {
    try {
      const resp = await axiosInstance.post(`${host}${path}`, body);
      if (resp.data?.errors?.find(e => e.message === 'NEED_CAPTCHA')) throw new Error('NEED_CAPTCHA');
      if (resp.data && !resp.data.errors?.length) return resp.data;
      lastErr = new Error(`${host} errors: ${JSON.stringify(resp.data?.errors)}`);
    } catch (e) {
      if (e.message === 'NEED_CAPTCHA') throw e;
      lastErr = e;
      console.warn(`[apiPost] ${host} failed: ${e.message}`);
    }
  }
  throw lastErr;
}

function decrypt(blob) {
  try {
    const key        = getKey();
    const data       = Buffer.from(blob, 'base64');
    const iv         = data.slice(1, 13);
    const ctLen      = data.length - 13 - 16;
    const ciphertext = data.slice(13, 13 + ctLen);
    const ctr        = Buffer.concat([iv, Buffer.from([0, 0, 0, 2])]);
    const decipher   = crypto.createDecipheriv('aes-256-ctr', Buffer.from(key, 'hex'), ctr);
    let dec = decipher.update(ciphertext);
    dec = Buffer.concat([dec, decipher.final()]);
    return dec.toString('utf8');
  } catch { return null; }
}

function b64urlToHex(s) {
  let p = s;
  const m = p.length % 4;
  if (m === 2) p += '=='; else if (m === 3) p += '=';
  return Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('hex');
}

const decodeMapping = {
  '79':'A','7a':'B','7b':'C','7c':'D','7d':'E','7e':'F','7f':'G','70':'H','71':'I','72':'J','73':'K','74':'L','75':'M','76':'N','77':'O',
  '68':'P','69':'Q','6a':'R','6b':'S','6c':'T','6d':'U','6e':'V','6f':'W','60':'X','61':'Y','62':'Z',
  '59':'a','5a':'b','5b':'c','5c':'d','5d':'e','5e':'f','5f':'g','50':'h','51':'i','52':'j','53':'k','54':'l','55':'m','56':'n','57':'o',
  '48':'p','49':'q','4a':'r','4b':'s','4c':'t','4d':'u','4e':'v','4f':'w','40':'x','41':'y','42':'z',
  '08':'0','09':'1','0a':'2','0b':'3','0c':'4','0d':'5','0e':'6','0f':'7','00':'8','01':'9',
  '15':'-','16':'.','67':'_','46':'~','02':':','17':'/','07':'?','1b':'#','63':'[','65':']','78':'@',
  '19':'!','1c':'$','1e':'&','10':'(','11':')','12':'*','13':'+','14':',','03':';','05':'=','1d':'%'
};

function decodeProviderId(hex) {
  let r = '';
  for (let i = 0; i < hex.length; i += 2) r += decodeMapping[hex.substring(i, i + 2)] || '';
  return r.replace('/clock', '/clock.json');
}

async function resolveFast4Speed(wrapperUrl) {
  // fast4speed URLs redirect to a page containing real MP4/HLS links — follow and extract them
  try {
    const resp = await axiosInstance.get(wrapperUrl, {
      timeout: 5000,
      maxRedirects: 5,
      headers: { 'User-Agent': AGENT, 'Referer': ALLANIME_REFR }
    });
    const body = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    const links = [];
    // Try JSON response first
    if (resp.data?.links) {
      for (const l of resp.data.links) {
        if (l.link) links.push({ resolution: l.resolutionStr || 'unknown', url: l.link });
      }
    }
    if (resp.data?.hls?.url) links.push({ resolution: 'hls', url: resp.data.hls.url });
    if (resp.data?.mp4?.url) links.push({ resolution: resp.data.mp4.resolutionStr || 'mp4', url: resp.data.mp4.url });
    if (links.length) return links;
    // Scrape MP4/M3U8 URLs from HTML body
    const mp4s = [...body.matchAll(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g)].map(m => m[0]);
    const m3u8s = [...body.matchAll(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g)].map(m => m[0]);
    for (const u of m3u8s) links.push({ resolution: 'hls', url: u });
    for (const u of mp4s) links.push({ resolution: 'mp4', url: u });
    return links;
  } catch (e) {
    console.error('[resolveFast4Speed]', e.message);
    return [];
  }
}

async function getLinks(providerPath) {
  const url = providerPath.startsWith('http') ? providerPath : `https://${ALLANIME_BASE}${providerPath}`;
  if (providerPath.includes('tools.fast4speed.rsvp')) return resolveFast4Speed(url);
  try {
    const { data } = await axiosInstance.get(url, { timeout: 5000 });
    const links = [];
    if (Array.isArray(data.links)) {
      for (const link of data.links) {
        if (!link.link) continue;
        if (link.link.includes('repackager.wixmp.com')) {
          const cleaned = link.link.replace('repackager.wixmp.com/', '').replace(/\.urlset.*/, '');
          const qm = link.link.match(/\/,([^/]*),\/mp4/);
          if (qm) { for (const q of qm[1].split(',')) links.push({ resolution: q, url: cleaned.replace(/,[^/]*/, q) }); }
          else links.push({ resolution: link.resolutionStr || 'unknown', url: link.link });
        } else {
          links.push({ resolution: link.resolutionStr || 'unknown', url: link.link });
        }
      }
    }
    if (data.hls?.url) links.push({ resolution: 'hls', url: data.hls.url });
    if (data.mp4?.url) links.push({ resolution: data.mp4.resolutionStr || 'mp4', url: data.mp4.url });
    return links;
  } catch (e) {
    throw new Error(`getLinks fetch failed: ${e.message}`);
  }
}

async function getFilemoonLinks(providerPath) {
  const url = providerPath.startsWith('http') ? providerPath : `https://${ALLANIME_BASE}${providerPath}`;
  try {
    const { data } = await axiosInstance.get(url, { timeout: 5000 });
    if (!data?.iv || !data?.payload || !data?.key_parts) return [];
    const keyHex = b64urlToHex(data.key_parts[0]) + b64urlToHex(data.key_parts[1]);
    const ivHex  = b64urlToHex(data.iv) + '00000002';
    let p = data.payload;
    const pm = p.length % 4;
    if (pm === 2) p += '=='; else if (pm === 3) p += '=';
    p = p.replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(p, 'base64');
    const dec = crypto.createDecipheriv('aes-256-ctr', Buffer.from(keyHex, 'hex'), Buffer.from(ivHex, 'hex'));
    let plain = dec.update(buf.slice(0, buf.length - 16));
    plain = Buffer.concat([plain, dec.final()]).toString('utf8');
    const links = [];
    for (const part of plain.replace(/[{}\[\]]/g, '\n').split('\n')) {
      const m1 = part.match(/"url":"([^"]*)".*"height":(\d+)/);
      const m2 = part.match(/"height":(\d+).*"url":"([^"]*)"/);
      if (m1) links.push({ resolution: m1[2], url: m1[1].replace(/\\u0026/g, '&').replace(/\\u003D/g, '=') });
      else if (m2) links.push({ resolution: m2[1], url: m2[2].replace(/\\u0026/g, '&').replace(/\\u003D/g, '=') });
    }
    return links;
  } catch (e) {
    console.error('[getFilemoonLinks]', e.message, url);
    return [];
  }
}

function parseSourceLines(apiData) {
  const raw = JSON.stringify(apiData);
  const lines = [];
  if (raw.includes('"tobeparsed"')) {
    const d = apiData.data;
    let blob = apiData.tobeparsed || d?.tobeparsed || d?.episode?.tobeparsed || null;
    if (!blob) { const m = raw.match(/"tobeparsed":"([^"]*)"/); if (m) blob = m[1]; }
    if (blob) {
      const plain = decrypt(blob);
      if (plain) {
        for (const part of plain.replace(/[{}]/g, '\n').split('\n')) {
          const m = part.match(/"sourceUrl":"--([^"]*)".*"sourceName":"([^"]*)"/);
          if (m) lines.push({ sourceName: m[2], hex: m[1] });
        }
      }
    }
  } else if (apiData.data?.episode?.sourceUrls) {
    const cleaned = JSON.stringify(apiData.data.episode.sourceUrls).replace(/\\u002F/g, '/').replace(/\\/g, '');
    for (const part of cleaned.replace(/[{}]/g, '\n').split('\n')) {
      const m = part.match(/"sourceUrl":"--([^"]*)".*"sourceName":"([^"]*)"/);
      if (m) lines.push({ sourceName: m[2], hex: m[1] });
    }
  }
  return lines;
}

// Tried sequentially — stops at first provider that yields links (avoids parallel timeout)
const PROVIDERS = [
  { name: 'Default',  filemoon: false },
  { name: 'Luf-Mp4', filemoon: false },
  { name: 'S-mp4',   filemoon: false },
  { name: 'Yt-mp4',  filemoon: false },
  { name: 'Cr-Mp4',  filemoon: false },
  { name: 'Fm-mp4',  filemoon: true  },
  { name: 'Yt',      filemoon: false },
  { name: 'Ok',      filemoon: false },
];

async function _resolveEpisodeUrl(showId, epNo, mode, quality) {
  const debug = { showId, epNo, mode, quality, steps: [] };
  const episodeGql = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
    episode(showId: $showId translationType: $translationType episodeString: $episodeString) { episodeString sourceUrls }
  }`;

  let apiData = null;

  // Step 1: GET with persisted query
  for (const host of API_HOSTS) {
    try {
      const vars = encodeURIComponent(JSON.stringify({ showId, translationType: mode, episodeString: String(epNo) }));
      const ext  = encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: EPISODE_QUERY_HASH } }));
      const { data } = await axios.get(`${host}/api?variables=${vars}&extensions=${ext}`, {
        headers: { 'User-Agent': AGENT, 'Referer': ALLANIME_REFR, 'Origin': 'https://youtu-chan.com' },
        timeout: 8000
      });
      const ok = JSON.stringify(data).includes('tobeparsed') || data?.data?.episode?.sourceUrls;
      if (ok) { apiData = data; debug.steps.push(`GET (${host}): OK`); break; }
      debug.steps.push(`GET (${host}): no usable data`);
    } catch (e) {
      debug.steps.push(`GET (${host}): FAILED — ${e.message}`);
    }
  }

  // Step 2: POST fallback
  if (!apiData) {
    try {
      apiData = await apiPost('/api', {
        variables: { showId, translationType: mode, episodeString: String(epNo) },
        query: episodeGql
      });
      debug.steps.push('POST fallback: OK');
    } catch (e) {
      debug.steps.push(`POST fallback: FAILED — ${e.message}`);
      return { url: null, debug };
    }
  }

  if (apiData.errors?.length) {
    const msg = apiData.errors.map(e => e.message).join(', ');
    debug.steps.push(`API errors: ${msg}`);
    if (apiData.errors.find(e => e.message === 'NEED_CAPTCHA')) throw new Error('NEED_CAPTCHA');
    return { url: null, debug };
  }

  const sourceLines = parseSourceLines(apiData);
  debug.steps.push(`Source lines: ${sourceLines.length} — [${sourceLines.map(r => r.sourceName).join(', ')}]`);
  if (!sourceLines.length) return { url: null, debug };

  // Fetch all providers in parallel with a 6s per-provider deadline
  // Collect from ALL providers so we can pick the best quality overall
  const providerResults = await Promise.all(
    PROVIDERS.map(async prov => {
      const entry = sourceLines.find(r => r.sourceName === prov.name);
      if (!entry) return [];
      const path = decodeProviderId(entry.hex);
      if (!path) return [];
      debug.steps.push(`Trying ${prov.name}: ${path.substring(0, 80)}`);
      try {
        const links = await Promise.race([
          prov.filemoon ? getFilemoonLinks(path) : getLinks(path),
          new Promise(resolve => setTimeout(() => resolve([]), 6000))
        ]);
        debug.steps.push(`${prov.name}: ${links.length} links — [${links.map(l => l.resolution).join(', ')}]`);
        return links;
      } catch (e) {
        debug.steps.push(`${prov.name}: ERROR — ${e.message}`);
        return [];
      }
    })
  );
  let allLinks = providerResults.flat();

  debug.steps.push(`Total links: ${allLinks.length}`);
  if (!allLinks.length) return { url: null, debug };

  allLinks.sort((a, b) => (parseInt(b.resolution) || 0) - (parseInt(a.resolution) || 0));

  let selected;
  if (quality === 'best') {
    selected = allLinks[0];
  } else if (quality === 'worst') {
    const num = allLinks.filter(l => /^\d+/.test(l.resolution));
    selected = num.length ? num[num.length - 1] : allLinks[allLinks.length - 1];
  } else {
    selected = allLinks.find(l => l.resolution.includes(quality));
    if (!selected) {
      const num = allLinks.filter(l => /^\d+/.test(l.resolution));
      const req = parseInt(quality) || 9999;
      const below = num.filter(l => parseInt(l.resolution) <= req);
      selected = below.length ? below[0] : (num.length ? num[num.length - 1] : allLinks[0]);
    }
  }

  const url = selected.url.replace(/([^:])\/{2,}/g, '$1/');
  debug.steps.push(`Selected: res=${selected.resolution} url=${url.substring(0, 100)}`);
  return { url, debug };
}

async function searchAnime(query) {
  const gql = `query($search: SearchInput $limit: Int $page: Int $countryOrigin: VaildCountryOriginEnumType) {
    shows(search: $search limit: $limit page: $page countryOrigin: $countryOrigin) {
      edges { _id name englishName nativeName availableEpisodes __typename }
    }
  }`;
  try {
    const data = await apiPost('/api', {
      variables: { search: { allowAdult: false, allowUnknown: false, query }, limit: 40, page: 1, countryOrigin: 'ALL' },
      query: gql
    });
    return (data.data.shows.edges || []).map(s => ({
      id: s._id,
      title: s.englishName || s.name.replace(/\\"/g, '"'),
      episodes_sub: parseInt(s.availableEpisodes.sub) || 0,
      episodes_dub: parseInt(s.availableEpisodes.dub) || 0
    }));
  } catch (e) {
    console.error('[searchAnime]', e.message);
    return [];
  }
}

async function getAnimeDetails(showId) {
  const gql = `query ($showId: String!) {
    show(_id: $showId) { _id name englishName nativeName thumbnail description status availableEpisodesDetail }
  }`;
  try {
    const data = await apiPost('/api', { variables: { showId }, query: gql });
    const s = data.data.show;
    if (!s) return null;
    return {
      id: s._id, title: s.englishName || s.name, title_english: s.englishName || s.name,
      title_native: s.nativeName,
      thumbnail_url: s.thumbnail ? (s.thumbnail.startsWith('http') ? s.thumbnail : `https://${ALLANIME_BASE}${s.thumbnail}`) : null,
      description: s.description || '', status: s.status,
      episodes_sub: s.availableEpisodesDetail.sub?.length || 0,
      episodes_dub: s.availableEpisodesDetail.dub?.length || 0
    };
  } catch (e) {
    console.error('[getAnimeDetails]', e.message);
    return null;
  }
}

async function getEpisodesList(showId, mode = 'sub') {
  const gql = `query ($showId: String!) { show(_id: $showId) { _id availableEpisodesDetail } }`;
  try {
    const data = await apiPost('/api', { variables: { showId }, query: gql });
    return (data.data.show.availableEpisodesDetail[mode] || []).sort((a, b) => parseFloat(a) - parseFloat(b));
  } catch (e) {
    console.error('[getEpisodesList]', e.message);
    return [];
  }
}

async function getEpisodeUrl(showId, epNo, mode = 'sub', quality = 'best') {
  try {
    const { url } = await _resolveEpisodeUrl(showId, epNo, mode, quality);
    return url;
  } catch (e) {
    if (e.message?.startsWith('NEED_CAPTCHA')) throw e;
    console.error('[getEpisodeUrl]', e.message);
    return null;
  }
}

async function getEpisodeUrlDebug(showId, epNo, mode = 'sub', quality = 'best') {
  try {
    return await _resolveEpisodeUrl(showId, epNo, mode, quality);
  } catch (e) {
    return { url: null, debug: { error: e.message, stack: e.stack } };
  }
}

async function getEpisodeInfo(showId, epNo) {
  const gql = `query ($showId: String!, $epNum: Float!) {
    episodeInfos(showId: $showId episodeNumStart: $epNum episodeNumEnd: $epNum) {
      episodeIdNum notes description thumbnails
    }
  }`;
  try {
    const data = await apiPost('/api', { variables: { showId, epNum: parseFloat(epNo) }, query: gql });
    const infos = data.data.episodeInfos;
    if (!infos?.length) return null;
    const info = infos[0];
    return {
      episode_no: info.episodeIdNum, title: info.notes || '', description: info.description || '',
      thumbnails: (info.thumbnails || []).map(t => t.startsWith('/') ? `https://${ALLANIME_BASE}${t}` : t)
    };
  } catch (e) {
    console.error('[getEpisodeInfo]', e.message);
    return null;
  }
}

async function getAvailableQualities(showId, epNo, mode = 'sub') {
  try {
    const { debug } = await _resolveEpisodeUrl(showId, epNo, mode, 'best');
    const resSet = new Set();
    debug.steps.forEach(s => {
      const m = s.match(/\[([^\]]+)\]/);
      if (m) m[1].split(', ').forEach(r => { if (/^\d+$/.test(r)) resSet.add(r); });
    });
    return [...resSet];
  } catch { return []; }
}

module.exports = {
  searchAnime, getAnimeDetails, getEpisodesList,
  getEpisodeUrl, getEpisodeUrlDebug, getEpisodeInfo, getAvailableQualities
};
