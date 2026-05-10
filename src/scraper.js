const axios = require('axios');
const crypto = require('crypto');

const AGENT         = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0';
const ALLANIME_REFR = 'https://allmanga.to';
const ALLANIME_BASE = 'allanime.day';
const ALLANIME_KEY  = crypto.createHash('sha256').update('Xot36i3lK3:v1').digest('hex');
const EPISODE_QUERY_HASH = 'd405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec';

// Multiple API hosts tried in order — Vercel's DNS blocks some of these
const API_HOSTS = [
  'https://api.allanime.day',
  'https://api.allanime.to',
  'https://allanime.to/allanimeapi',
];

// Increased timeouts — Vercel cold starts + AllAnime API calls need more headroom
const axiosInstance = axios.create({
  headers: { 'User-Agent': AGENT, 'Referer': ALLANIME_REFR },
  timeout: 12000
});

// Try each API host in sequence, return first that succeeds
async function apiPost(path, body) {
  let lastErr;
  for (const host of API_HOSTS) {
    try {
      const url = `${host}${path}`;
      const resp = await axiosInstance.post(url, body);
      // Treat empty/error-only responses as failures so we try next host
      if (resp.data && !resp.data.errors?.length) return resp.data;
      // If there's a NEED_CAPTCHA error, surface it immediately (no point retrying hosts)
      if (resp.data?.errors?.find(e => e.message === 'NEED_CAPTCHA')) {
        throw new Error('NEED_CAPTCHA');
      }
      lastErr = new Error(`Host ${host} returned errors: ${JSON.stringify(resp.data?.errors)}`);
    } catch (e) {
      if (e.message === 'NEED_CAPTCHA') throw e;
      lastErr = e;
      console.warn(`[apiPost] ${host}${path} failed: ${e.message}`);
    }
  }
  throw lastErr;
}

async function apiGet(url, opts = {}) {
  return axiosInstance.get(url, opts);
}

function decrypt(blob) {
  try {
    const data       = Buffer.from(blob, 'base64');
    const iv         = data.slice(1, 13);
    const ctLen      = data.length - 13 - 16;
    const ciphertext = data.slice(13, 13 + ctLen);
    const ctr        = Buffer.concat([iv, Buffer.from([0, 0, 0, 2])]);
    const decipher   = crypto.createDecipheriv('aes-256-ctr', Buffer.from(ALLANIME_KEY, 'hex'), ctr);
    let decrypted    = decipher.update(ciphertext);
    decrypted        = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch { return null; }
}

function b64urlToHex(b64url) {
  let padded = b64url;
  const mod  = padded.length % 4;
  if (mod === 2) padded += '==';
  else if (mod === 3) padded += '=';
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('hex');
}

async function getFilemoonLinks(providerPath) {
  const allLinks = [];
  const fetchUrl = providerPath.startsWith('http') ? providerPath : `https://${ALLANIME_BASE}${providerPath}`;
  try {
    const response = await apiGet(fetchUrl, { timeout: 10000 });
    const fmData   = response.data;
    if (fmData?.iv && fmData?.payload && fmData?.key_parts) {
      const keyHex     = b64urlToHex(fmData.key_parts[0]) + b64urlToHex(fmData.key_parts[1]);
      const ivHex      = b64urlToHex(fmData.iv) + '00000002';
      let payloadB64   = fmData.payload;
      const pMod       = payloadB64.length % 4;
      if (pMod === 2) payloadB64 += '==';
      else if (pMod === 3) payloadB64 += '=';
      payloadB64       = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      const payloadBuf = Buffer.from(payloadB64, 'base64');
      const ciphertext = payloadBuf.slice(0, payloadBuf.length - 16);
      const decipher   = crypto.createDecipheriv('aes-256-ctr', Buffer.from(keyHex, 'hex'), Buffer.from(ivHex, 'hex'));
      let decrypted    = decipher.update(ciphertext);
      decrypted        = Buffer.concat([decrypted, decipher.final()]);
      const plain      = decrypted.toString('utf8');
      const parts      = plain.replace(/[{}\[\]]/g, '\n').split('\n');
      for (const part of parts) {
        const m1 = part.match(/"url":"([^"]*)".*"height":(\d+)/);
        const m2 = part.match(/"height":(\d+).*"url":"([^"]*)"/);
        if (m1) allLinks.push({ resolution: m1[2], url: m1[1].replace(/\\u0026/g, '&').replace(/\\u003D/g, '=') });
        else if (m2) allLinks.push({ resolution: m2[1], url: m2[2].replace(/\\u0026/g, '&').replace(/\\u003D/g, '=') });
      }
    }
  } catch (e) {
    console.error('[getFilemoonLinks] error:', e.message, 'url:', fetchUrl);
  }
  return allLinks;
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
  let result = '';
  for (let i = 0; i < hex.length; i += 2) result += decodeMapping[hex.substring(i, i + 2)] || '';
  return result.replace('/clock', '/clock.json');
}

async function getLinks(providerPath) {
  const allLinks = [];
  if (providerPath.includes('tools.fast4speed.rsvp')) {
    allLinks.push({ resolution: 'Yt', url: providerPath });
    return allLinks;
  }
  const fetchUrl = providerPath.startsWith('http') ? providerPath : `https://${ALLANIME_BASE}${providerPath}`;
  try {
    const response     = await apiGet(fetchUrl, { timeout: 10000 });
    const providerData = response.data;
    if (providerData.links && Array.isArray(providerData.links)) {
      for (const link of providerData.links) {
        const url = link.link;
        const res = link.resolutionStr || 'unknown';
        if (!url) continue;
        if (url.includes('repackager.wixmp.com')) {
          const cleaned        = url.replace('repackager.wixmp.com/', '').replace(/\.urlset.*/, '');
          const qualitiesMatch = url.match(/\/,([^/]*),\/mp4/);
          if (qualitiesMatch) {
            for (const q of qualitiesMatch[1].split(',')) allLinks.push({ resolution: q, url: cleaned.replace(/,[^/]*/, q) });
          } else { allLinks.push({ resolution: res, url }); }
        } else { allLinks.push({ resolution: res, url }); }
      }
    }
    if (providerData.hls?.url)  allLinks.push({ resolution: 'hls', url: providerData.hls.url });
    if (providerData.mp4?.url)  allLinks.push({ resolution: providerData.mp4.resolutionStr || 'mp4', url: providerData.mp4.url });
  } catch (e) {
    console.error('[getLinks] error:', e.message, 'url:', fetchUrl);
  }
  return allLinks;
}

function parseSourceLines(apiData) {
  const rawJson       = JSON.stringify(apiData);
  const hasTobeparsed = rawJson.includes('"tobeparsed"');
  let respLines       = [];
  if (hasTobeparsed) {
    const data = apiData.data;
    let blobValue = apiData.tobeparsed || (data && data.tobeparsed) || (data && data.episode && data.episode.tobeparsed) || null;
    if (!blobValue) { const m = rawJson.match(/"tobeparsed":"([^"]*)"/); if (m) blobValue = m[1]; }
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
    const raw     = JSON.stringify(apiData.data.episode.sourceUrls);
    const cleaned = raw.replace(/\\u002F/g, '/').replace(/\\/g, '');
    const parts   = cleaned.replace(/[{}]/g, '\n').split('\n');
    for (const part of parts) {
      const m = part.match(/"sourceUrl":"--([^"]*)".*"sourceName":"([^"]*)"/);
      if (m) respLines.push({ sourceName: m[2], hex: m[1] });
    }
  }
  return respLines;
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
    return (data.data.shows.edges || []).map(show => ({
      id: show._id,
      title: show.englishName || show.name.replace(/\\"/g, '"'),
      episodes_sub: parseInt(show.availableEpisodes.sub) || 0,
      episodes_dub: parseInt(show.availableEpisodes.dub) || 0
    }));
  } catch (e) {
    console.error('[searchAnime] error:', e.message);
    return [];
  }
}

async function getAnimeDetails(showId) {
  const gql = `query ($showId: String!) {
    show(_id: $showId) { _id name englishName nativeName thumbnail description status availableEpisodesDetail }
  }`;
  try {
    const data = await apiPost('/api', { variables: { showId }, query: gql });
    const show = data.data.show;
    if (!show) return null;
    return {
      id: show._id, title: show.englishName || show.name, title_english: show.englishName || show.name,
      title_native: show.nativeName,
      thumbnail_url: show.thumbnail ? (show.thumbnail.startsWith('http') ? show.thumbnail : `https://${ALLANIME_BASE}${show.thumbnail}`) : null,
      description: show.description || '',
      status: show.status,
      episodes_sub: show.availableEpisodesDetail.sub ? show.availableEpisodesDetail.sub.length : 0,
      episodes_dub: show.availableEpisodesDetail.dub ? show.availableEpisodesDetail.dub.length : 0
    };
  } catch (e) {
    console.error('[getAnimeDetails] error:', e.message);
    return null;
  }
}

async function getEpisodesList(showId, mode = 'sub') {
  const gql = `query ($showId: String!) { show(_id: $showId) { _id availableEpisodesDetail } }`;
  try {
    const data    = await apiPost('/api', { variables: { showId }, query: gql });
    const details = data.data.show.availableEpisodesDetail;
    return (details[mode] || []).sort((a, b) => parseFloat(a) - parseFloat(b));
  } catch (e) {
    console.error('[getEpisodesList] error:', e.message);
    return [];
  }
}

// Core resolver — returns { url, debug } so both public and debug endpoints work
async function _resolveEpisodeUrl(showId, epNo, mode = 'sub', quality = 'best') {
  const debug = { showId, epNo, mode, quality, steps: [] };
  const episodeGql = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
    episode(showId: $showId translationType: $translationType episodeString: $episodeString) { episodeString sourceUrls }
  }`;

  let apiData = null;

  // Step 1: Try GET with persisted query against each host
  for (const host of API_HOSTS) {
    try {
      const queryVars = JSON.stringify({ showId, translationType: mode, episodeString: String(epNo) });
      const queryExt  = JSON.stringify({ persistedQuery: { version: 1, sha256Hash: EPISODE_QUERY_HASH } });
      const apiUrl    = `${host}/api?variables=${encodeURIComponent(queryVars)}&extensions=${encodeURIComponent(queryExt)}`;
      const getResp   = await axios.get(apiUrl, {
        headers: { 'User-Agent': AGENT, 'Referer': ALLANIME_REFR, 'Origin': 'https://youtu-chan.com' },
        timeout: 12000
      });
      const hasData = JSON.stringify(getResp.data).includes('tobeparsed') || getResp.data?.data?.episode?.sourceUrls;
      if (hasData) {
        apiData = getResp.data;
        debug.steps.push(`GET persisted query (${host}): OK`);
        break;
      } else {
        debug.steps.push(`GET persisted query (${host}): no usable data`);
      }
    } catch (e) {
      debug.steps.push(`GET persisted query (${host}): FAILED (${e.message})`);
    }
  }

  // Step 2: Fallback POST (already tries all hosts via apiPost)
  if (!apiData) {
    try {
      apiData = await apiPost('/api', {
        variables: { showId, translationType: mode, episodeString: String(epNo) },
        query: episodeGql
      });
      debug.steps.push('POST fallback: OK');
    } catch (e) {
      debug.steps.push(`POST fallback: FAILED (${e.message})`);
      return { url: null, debug };
    }
  }

  if (apiData.errors?.length > 0) {
    const msg = apiData.errors.map(e => e.message).join(', ');
    debug.steps.push(`API errors: ${msg}`);
    if (apiData.errors.find(e => e.message === 'NEED_CAPTCHA')) throw new Error('NEED_CAPTCHA');
    return { url: null, debug };
  }

  const respLines = parseSourceLines(apiData);
  debug.steps.push(`Source lines: ${respLines.length} — [${respLines.map(r => r.sourceName).join(', ')}]`);

  if (!respLines.length) return { url: null, debug };

  // Try all known provider names
  const providerDefs = [
    { name: 'Default',  filemoon: false },
    { name: 'Yt-mp4',  filemoon: false },
    { name: 'S-mp4',   filemoon: false },
    { name: 'Luf-Mp4', filemoon: false },
    { name: 'Fm-mp4',  filemoon: true  },
    { name: 'Yt',      filemoon: false },
    { name: 'Cr-Mp4',  filemoon: false },
    { name: 'Ok',      filemoon: false },
  ];

  const results = await Promise.all(providerDefs.map(async prov => {
    const entry = respLines.find(r => r.sourceName === prov.name);
    if (!entry) return [];
    const path  = decodeProviderId(entry.hex);
    if (!path)  return [];
    debug.steps.push(`Provider ${prov.name} path: ${path.substring(0, 80)}`);
    const links = prov.filemoon ? await getFilemoonLinks(path) : await getLinks(path);
    debug.steps.push(`Provider ${prov.name}: ${links.length} links — [${links.map(l=>l.resolution).join(', ')}]`);
    return links;
  }));

  let allLinks = results.flat();
  debug.steps.push(`Total links after all providers: ${allLinks.length}`);

  if (!allLinks.length) return { url: null, debug };

  allLinks.sort((a, b) => (parseInt(b.resolution) || 0) - (parseInt(a.resolution) || 0));

  let selected;
  if (quality === 'best') {
    selected = allLinks[0];
  } else if (quality === 'worst') {
    const num = allLinks.filter(l => /^\d+/.test(l.resolution));
    selected  = num.length ? num[num.length - 1] : allLinks[allLinks.length - 1];
  } else {
    selected = allLinks.find(l => l.resolution.includes(quality));
    if (!selected) {
      const num   = allLinks.filter(l => /^\d+/.test(l.resolution));
      const req   = parseInt(quality) || 9999;
      const below = num.filter(l => parseInt(l.resolution) <= req);
      selected    = below.length ? below[0] : (num.length ? num[num.length - 1] : allLinks[0]);
    }
  }

  const url = selected.url.replace(/([^:])\/{2,}/g, '$1/');
  debug.steps.push(`Selected: res=${selected.resolution} url=${url.substring(0, 100)}`);
  return { url, debug };
}

async function getEpisodeUrl(showId, epNo, mode = 'sub', quality = 'best') {
  try {
    const { url } = await _resolveEpisodeUrl(showId, epNo, mode, quality);
    return url;
  } catch (e) {
    if (e.message?.startsWith('NEED_CAPTCHA')) throw e;
    console.error('[getEpisodeUrl] fatal:', e.message);
    return null;
  }
}

async function getEpisodeUrlDebug(showId, epNo, mode = 'sub', quality = 'best') {
  try {
    return await _resolveEpisodeUrl(showId, epNo, mode, quality);
  } catch (e) {
    return { url: null, debug: { error: e.message } };
  }
}

async function getEpisodeInfo(showId, epNo) {
  const gql = `query ($showId: String!, $epNum: Float!) {
    episodeInfos(showId: $showId episodeNumStart: $epNum episodeNumEnd: $epNum) {
      episodeIdNum notes description thumbnails
    }
  }`;
  try {
    const data  = await apiPost('/api', { variables: { showId, epNum: parseFloat(epNo) }, query: gql });
    const infos = data.data.episodeInfos;
    if (!infos?.length) return null;
    const info = infos[0];
    return {
      episode_no: info.episodeIdNum, title: info.notes || '', description: info.description || '',
      thumbnails: (info.thumbnails || []).map(t => t.startsWith('/') ? `https://${ALLANIME_BASE}${t}` : t)
    };
  } catch (e) {
    console.error('[getEpisodeInfo] error:', e.message);
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

module.exports = { searchAnime, getAnimeDetails, getEpisodesList, getEpisodeUrl, getEpisodeUrlDebug, getEpisodeInfo, getAvailableQualities };