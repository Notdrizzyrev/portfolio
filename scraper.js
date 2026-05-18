const axios = require('axios');
const crypto = require('crypto');

const AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
const ALLANIME_BASE = "allanime.day";
const ALLANIME_API = `https://api.${ALLANIME_BASE}`;
const ALLANIME_KEY = crypto.createHash('sha256').update('Xot36i3lK3:v1').digest();
const EPISODE_PERSISTED_HASH = 'd405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec';

const axiosInstance = axios.create({
  timeout: 8000,
  maxRedirects: 3,
  headers: {
    'User-Agent': AGENT,
    'Accept': '*/*',
    'Referer': 'https://allanime.day/',
    'Origin': 'https://allanime.day',
  }
});

function decodeTobeparsed(blobB64) {
  try {
    const buf = Buffer.from(blobB64, 'base64');
    if (buf.length <= 29) return null;
    const iv = buf.slice(1, 13);
    const ct = buf.slice(13, buf.length - 16);
    const counter = Buffer.concat([iv, Buffer.from([0x00, 0x00, 0x00, 0x02])]);
    const decipher = crypto.createDecipheriv('aes-256-ctr', ALLANIME_KEY, counter);
    decipher.setAutoPadding(false);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch (e) {
    return null;
  }
}

const decodeMapping = {
  '79':'A','7a':'B','7b':'C','7c':'D','7d':'E','7e':'F','7f':'G','70':'H','71':'I','72':'J','73':'K','74':'L','75':'M','76':'N','77':'O',
  '68':'P','69':'Q','6a':'R','6b':'S','6c':'T','6d':'U','6e':'V','6f':'W','60':'X','61':'Y','62':'Z',
  '59':'a','5a':'b','5b':'c','5c':'d','5d':'e','5e':'f','5f':'g','50':'h','51':'i','52':'j','53':'k','54':'l','55':'m','56':'n','57':'o',
  '48':'p','49':'q','4a':'r','4b':'s','4c':'t','4d':'u','4e':'v','4f':'w','40':'x','41':'y','42':'z',
  '08':'0','09':'1','0a':'2','0b':'3','0c':'4','0d':'5','0e':'6','0f':'7','00':'8','01':'9',
  '15':'-','16':'.','67':'_','46':'~','02':':','17':'/','07':'?','1b':'#','63':'[','65':']','78':'@','19':'!','1c':'$','1e':'&','10':'(','11':')','12':'*','13':'+','14':',','03':';','05':'=','1d':'%'
};

function decodeProviderId(hex) {
  if (!hex) return '';
  let out = '';
  for (let i = 0; i < hex.length; i += 2) {
    out += decodeMapping[hex.substring(i, i + 2)] || '';
  }
  return out.replace('/clock', '/clock.json');
}

function b64urlToHex(b64url) {
  let padded = b64url;
  const mod = padded.length % 4;
  if (mod === 2) padded += '==';
  else if (mod === 3) padded += '=';
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('hex');
}

async function getFilemoonLinks(providerPath) {
  const links = [];
  try {
    const fetchUrl = providerPath.startsWith('http') ? providerPath : `https://${ALLANIME_BASE}${providerPath}`;
    const { data: fmData } = await axiosInstance.get(fetchUrl);
    if (!fmData || !fmData.iv || !fmData.payload || !fmData.key_parts) return links;
    
    const keyHex = b64urlToHex(fmData.key_parts[0]) + b64urlToHex(fmData.key_parts[1]);
    const ivHex = b64urlToHex(fmData.iv) + '00000002';
    let payloadB64 = fmData.payload;
    const pMod = payloadB64.length % 4;
    if (pMod === 2) payloadB64 += '==';
    else if (pMod === 3) payloadB64 += '=';
    payloadB64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    
    const payloadBuf = Buffer.from(payloadB64, 'base64');
    const ct = payloadBuf.slice(0, payloadBuf.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(keyHex, 'hex'), Buffer.from(ivHex, 'hex'));
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    
    for (const part of plain.replace(/[{}\[\]]/g, '\n').split('\n')) {
      const m1 = part.match(/"url":"([^"]*)".*"height":(\d+)/);
      const m2 = part.match(/"height":(\d+).*"url":"([^"]*)"/);
      if (m1) links.push({ resolution: m1[2], url: m1[1].replace(/\\u0026/g, '&').replace(/\\u003D/g, '=') });
      else if (m2) links.push({ resolution: m2[1], url: m2[2].replace(/\\u0026/g, '&').replace(/\\u003D/g, '=') });
    }
  } catch (e) {}
  return links;
}

async function getLinks(providerPath) {
  const links = [];
  try {
    if (!providerPath) return links;
    if (providerPath.includes('tools.fast4speed.rsvp')) {
      links.push({ resolution: 'Yt', url: providerPath });
      return links;
    }
    
    const fetchUrl = providerPath.startsWith('http') ? providerPath : `https://${ALLANIME_BASE}${providerPath}`;
    const { data } = await axiosInstance.get(fetchUrl);
    
    if (Array.isArray(data?.links)) {
      for (const l of data.links) {
        if (l.link) links.push({ resolution: l.resolutionStr || 'unknown', url: l.link });
      }
    }
    if (data?.hls?.url) links.push({ resolution: 'hls', url: data.hls.url });
  } catch (e) {}
  return links;
}

function extractSourceEntries(apiData) {
  const entries = [];
  const sourceUrls = apiData?.data?.episode?.sourceUrls;
  if (Array.isArray(sourceUrls)) {
    for (const s of sourceUrls) {
      if (s && typeof s === 'object' && s.sourceUrl && s.sourceName) {
        entries.push({ sourceName: String(s.sourceName).trim(), raw: String(s.sourceUrl) });
      } else if (typeof s === 'string') {
        const idx = s.indexOf('@');
        if (idx > 0) entries.push({ sourceName: s.slice(0, idx).trim(), raw: s.slice(idx + 1) });
      }
    }
  }
  return entries;
}

function resolveSourcePath(raw) {
  if (!raw) return '';
  if (raw.startsWith('--')) return decodeProviderId(raw.slice(2));
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/')) return raw;
  return '';
}

async function fetchEpisodeApi(showId, mode, epNo) {
  const episodeFormats = [String(epNo), String(parseFloat(epNo)), String(parseInt(epNo, 10)).padStart(2, '0'), parseFloat(epNo).toFixed(1)];

  for (const epString of episodeFormats) {
    try {
      const variables = JSON.stringify({ showId, translationType: mode, episodeString: epString });
      const extensions = JSON.stringify({ persistedQuery: { version: 1, sha256Hash: EPISODE_PERSISTED_HASH } });
      const url = `${ALLANIME_API}/api?variables=${encodeURIComponent(variables)}&extensions=${encodeURIComponent(extensions)}`;
      
      const { data } = await axiosInstance.get(url);
      
      if (data?.data?.tobeparsed) {
        const plain = decodeTobeparsed(data.data.tobeparsed);
        if (plain) {
          try {
            const parsed = JSON.parse(plain);
            if (parsed?.episode?.sourceUrls?.length) return { data: { episode: parsed.episode } };
          } catch (_) {}
        }
      }
      if (Array.isArray(data?.data?.episode?.sourceUrls) && data.data.episode.sourceUrls.length) {
        return data;
      }
    } catch (e) {}
  }
  return null;
}

// ✅ FIXED: Changed from "search" to "fastSearch"
async function searchAnime(query) {
  try {
    const variables = JSON.stringify({ search: { allowAdult: false, query, limit: 15 } });
    const url = `${ALLANIME_API}/api?variables=${encodeURIComponent(variables)}&query=query%20%28%24search%3A%20SearchInput%29%20%7B%20fastSearch%28search%3A%20%24search%29%20%7B%20edges%20%7B%20_id%20name%20englishName%20thumbnail%20description%20status%20%7D%20%7D%20%7D`;
    
    const { data } = await axiosInstance.get(url);
    
    const results = [];
    const edges = data?.data?.fastSearch?.edges || [];
    for (const item of edges) {
      results.push({
        id: item._id,
        title: item.englishName || item.name,
        title_english: item.englishName || item.name,
        thumbnail_url: item.thumbnail,
        synopsis: item.description ? item.description.replace(/<[^>]*>?/gm, '') : '',
        status: item.status,
      });
    }
    return results;
  } catch (e) {
    console.error('[search]', e.message);
    return [];
  }
}

async function getAnimeDetails(showId) {
  try {
    const variables = JSON.stringify({ showId });
    const url = `${ALLANIME_API}/api?variables=${encodeURIComponent(variables)}&query=query%20%28%24showId%3A%20String%21%29%20%7B%20show%28%20_id%3A%20%24showId%20%29%20%7B%20_id%20name%20englishName%20nativeName%20thumbnail%20description%20status%20availableEpisodesDetail%20%7D%20%7D`;
    
    const { data } = await axiosInstance.get(url);
    const show = data?.data?.show;
    if (!show) return null;
    
    return {
      id: show._id,
      title: show.englishName || show.name,
      title_english: show.englishName || show.name,
      thumbnail_url: show.thumbnail,
      synopsis: show.description ? show.description.replace(/<[^>]*>?/gm, '') : '',
      status: show.status,
      episodes_sub: parseInt(show.availableEpisodesDetail?.sub) || 0,
      episodes_dub: parseInt(show.availableEpisodesDetail?.dub) || 0,
    };
  } catch (e) {
    return null;
  }
}

async function getEpisodesList(showId, mode = 'sub') {
  try {
    const variables = JSON.stringify({ showId, translationType: mode });
    const url = `${ALLANIME_API}/api?variables=${encodeURIComponent(variables)}&query=query%20%28%24showId%3A%20String%21%20%24translationType%3A%20VaildTranslationTypeEnumType%21%29%20%7B%20episodes%28%20showId%3A%20%24showId%20translationType%3A%20%24translationType%20%29%20%7B%20episodeString%20episodeIdNum%20%7D%20%7D`;
    
    const { data } = await axiosInstance.get(url);
    return data?.data?.episodes || [];
  } catch (e) {
    return [];
  }
}

async function getEpisodeInfo(showId, epNo) {
  try {
    const variables = JSON.stringify({ showId, epNum: String(epNo) });
    const url = `${ALLANIME_API}/api?variables=${encodeURIComponent(variables)}&query=query%20%28%24showId%3A%20String%21%2C%20%24epNum%3A%20String%21%29%20%7B%20episodeInfos%28%20showId%3A%20%24showId%20episodeNum%3A%20%24epNum%20%29%20%7B%20episodeIdNum%20notes%20description%20thumbnails%20%7D%20%7D`;
    
    const { data } = await axiosInstance.get(url);
    const infos = data?.data?.episodeInfos;
    if (!infos || !infos.length) return null;
    
    const info = infos[0];
    let thumbnails = (info.thumbnails || []).map(t => t.startsWith('/') ? `https://${ALLANIME_BASE}${t}` : t);
    
    return {
      episode_no: info.episodeIdNum,
      title: info.notes || '',
      description: info.description || '',
      thumbnails,
    };
  } catch (e) {
    return null;
  }
}

async function getEpisodeUrl(showId, epNo, mode = 'sub', quality = 'best') {
  try {
    const apiData = await fetchEpisodeApi(showId, mode, epNo);
    if (!apiData) return null;

    const entries = extractSourceEntries(apiData);
    if (!entries.length) return null;

    const linkPromises = entries.map(async (entry) => {
      try {
        const path = resolveSourcePath(entry.raw);
        if (!path) return [];
        const isFm = /^Fm-/i.test(entry.sourceName) || /filemoon/i.test(entry.sourceName);
        return isFm ? await getFilemoonLinks(path) : await getLinks(path);
      } catch (e) {
        return [];
      }
    });

    const allLinks = (await Promise.all(linkPromises)).flat();
    if (!allLinks.length) return null;

    const qualityOrder = quality && quality !== 'best'
      ? [String(quality), '1080', '720', '480', '360', 'hls']
      : ['1080', '720', '480', '360', 'hls'];
    
    let selected = allLinks[0];
    for (const q of qualityOrder) {
      const match = allLinks.find(l => String(l.resolution).includes(q));
      if (match) { selected = match; break; }
    }
    return selected.url;
  } catch (e) {
    return null;
  }
}

async function getAvailableQualities(showId, epNo, mode = 'sub') {
  try {
    const apiData = await fetchEpisodeApi(showId, mode, epNo);
    if (!apiData) return [];
    const entries = extractSourceEntries(apiData);
    if (!entries.length) return [];
    const results = await Promise.all(entries.map(async (entry) => {
      try {
        const path = resolveSourcePath(entry.raw);
        if (!path) return [];
        const isFm = /^Fm-/i.test(entry.sourceName) || /filemoon/i.test(entry.sourceName);
        return isFm ? await getFilemoonLinks(path) : await getLinks(path);
      } catch (e) {
        return [];
      }
    }));
    const allLinks = results.flat();
    return [...new Set(allLinks.map(l => String(l.resolution)))];
  } catch (e) {
    return [];
  }
}

module.exports = {
  searchAnime,
  getAnimeDetails,
  getEpisodesList,
  getEpisodeUrl,
  getEpisodeInfo,
  getAvailableQualities,
};