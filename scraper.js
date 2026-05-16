const axios = require('axios');
const crypto = require('crypto');

const AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0";
const ALLANIME_REFR = "https://allmanga.to";
const ALLANIME_BASE = "allanime.day";
const ALLANIME_API = `https://api.${ALLANIME_BASE}`;
const ALLANIME_KEY = crypto.createHash('sha256').update('Xot36i3lK3:v1').digest('hex');

const axiosInstance = axios.create({
    headers: {
        'User-Agent': AGENT,
        'Referer': ALLANIME_REFR
    },
    timeout: 15000,
    maxRedirects: 5
});

let activeRequests = 0;
const MAX_CONCURRENT = 10;
const requestQueue = [];

async function executeWithLimit(fn) {
    while (activeRequests >= MAX_CONCURRENT) {
        await new Promise(r => requestQueue.push(r));
    }
    activeRequests++;
    try {
        return await fn();
    } finally {
        activeRequests--;
        const next = requestQueue.shift();
        if (next) next();
    }
}

function decrypt(blob) {
    try {
        const data = Buffer.from(blob, 'base64');
        const iv = data.slice(1, 13);
        const ctLen = data.length - 13 - 16;
        const ciphertext = data.slice(13, 13 + ctLen);
        const ctr = Buffer.concat([iv, Buffer.from([0, 0, 0, 2])]);
        const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(ALLANIME_KEY, 'hex'), ctr);
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    } catch (e) {
        return null;
    }
}

function b64urlToHex(b64url) {
    let padded = b64url;
    const mod = padded.length % 4;
    if (mod === 2) padded += '==';
    else if (mod === 3) padded += '=';
    const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(b64, 'base64').toString('hex');
}

async function getFilemoonLinks(providerPath) {
    const allLinks = [];
    const fetchUrl = providerPath.startsWith('http') ? providerPath : `https://${ALLANIME_BASE}${providerPath}`;
    try {
        const response = await axiosInstance.get(fetchUrl, { timeout: 7000 });
        const fmData = response.data;
        if (fmData && fmData.iv && fmData.payload && fmData.key_parts) {
            const kp1 = fmData.key_parts[0];
            const kp2 = fmData.key_parts[1];
            const keyHex = b64urlToHex(kp1) + b64urlToHex(kp2);
            const ivHex = b64urlToHex(fmData.iv) + '00000002';
            let payloadB64 = fmData.payload;
            const pMod = payloadB64.length % 4;
            if (pMod === 2) payloadB64 += '==';
            else if (pMod === 3) payloadB64 += '=';
            payloadB64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
            const payloadBuf = Buffer.from(payloadB64, 'base64');
            const ctLen = payloadBuf.length - 16;
            const ciphertext = payloadBuf.slice(0, ctLen);
            const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(keyHex, 'hex'), Buffer.from(ivHex, 'hex'));
            let decrypted = decipher.update(ciphertext);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            const plain = decrypted.toString('utf8');
            const parts = plain.replace(/[{}\[\]]/g, '\n').split('\n');
            for (const part of parts) {
                const m1 = part.match(/"url":"([^"]*)".*"height":(\d+)/);
                const m2 = part.match(/"height":(\d+).*"url":"([^"]*)"/);
                if (m1) {
                    let url = m1[1].replace(/\\u0026/g, '&').replace(/\\u003D/g, '=');
                    allLinks.push({ resolution: m1[2], url });
                } else if (m2) {
                    let url = m2[2].replace(/\\u0026/g, '&').replace(/\\u003D/g, '=');
                    allLinks.push({ resolution: m2[1], url });
                }
            }
        }
    } catch (e) {}
    return allLinks;
}

const decodeMapping = {
    '79': 'A', '7a': 'B', '7b': 'C', '7c': 'D', '7d': 'E', '7e': 'F', '7f': 'G', '70': 'H', '71': 'I', '72': 'J', '73': 'K', '74': 'L', '75': 'M', '76': 'N', '77': 'O',
    '68': 'P', '69': 'Q', '6a': 'R', '6b': 'S', '6c': 'T', '6d': 'U', '6e': 'V', '6f': 'W', '60': 'X', '61': 'Y', '62': 'Z',
    '59': 'a', '5a': 'b', '5b': 'c', '5c': 'd', '5d': 'e', '5e': 'f', '5f': 'g', '50': 'h', '51': 'i', '52': 'j', '53': 'k', '54': 'l', '55': 'm', '56': 'n', '57': 'o',
    '48': 'p', '49': 'q', '4a': 'r', '4b': 's', '4c': 't', '4d': 'u', '4e': 'v', '4f': 'w', '40': 'x', '41': 'y', '42': 'z',
    '08': '0', '09': '1', '0a': '2', '0b': '3', '0c': '4', '0d': '5', '0e': '6', '0f': '7', '00': '8', '01': '9',
    '15': '-', '16': '.', '67': '_', '46': '~', '02': ':', '17': '/', '07': '?', '1b': '#', '63': '[', '65': ']', '78': '@', '19': '!', '1c': '$', '1e': '&', '10': '(', '11': ')', '12': '*', '13': '+', '14': ',', '03': ';', '05': '=', '1d': '%'
};

function decodeProviderId(hex) {
    let result = '';
    for (let i = 0; i < hex.length; i += 2) {
        const part = hex.substring(i, i + 2);
        result += decodeMapping[part] || '';
    }
    return result.replace('/clock', '/clock.json');
}

async function getLinks(providerPath) {
    let allLinks = [];
    if (providerPath.includes('tools.fast4speed.rsvp')) {
        allLinks.push({ resolution: 'Yt', url: providerPath });
        return allLinks;
    }
    const fetchUrl = providerPath.startsWith('http') ? providerPath : `https://${ALLANIME_BASE}${providerPath}`;
    try {
        const response = await axiosInstance.get(fetchUrl, { timeout: 7000 });
        const providerData = response.data;
        if (providerData.links && Array.isArray(providerData.links)) {
            for (const link of providerData.links) {
                const url = link.link;
                const res = link.resolutionStr || 'unknown';
                if (url && url.includes('repackager.wixmp.com')) {
                    const cleaned = url.replace('repackager.wixmp.com/', '').replace(/\.urlset.*/, '');
                    const qualitiesMatch = url.match(/\/,([^/]*),\/mp4/);
                    if (qualitiesMatch) {
                        const qualities = qualitiesMatch[1].split(',');
                        for (const q of qualities) {
                            const qUrl = cleaned.replace(/,[^/]*/, q);
                            allLinks.push({ resolution: q, url: qUrl });
                        }
                    } else {
                        allLinks.push({ resolution: res, url });
                    }
                } else if (url) {
                    allLinks.push({ resolution: res, url });
                }
            }
        }
        if (providerData.hls && providerData.hls.url) {
            allLinks.push({ resolution: 'hls', url: providerData.hls.url });
        }
    } catch (e) {}
    return allLinks;
}

function parseSourceLines(apiData) {
    console.log('\n[PARSE] ✓ parseSourceLines called');
    const respLines = [];
    
    if (!apiData) {
        console.log('[PARSE] ✗ apiData is null');
        return respLines;
    }

    try {
        const sourceUrls = apiData?.data?.episode?.sourceUrls;
        console.log('[PARSE] sourceUrls found:', !!sourceUrls, 'count:', sourceUrls?.length || 0);
        
        if (!sourceUrls || sourceUrls.length === 0) {
            console.log('[PARSE] ✗ No sourceUrls found');
            return respLines;
        }

        for (const url of sourceUrls) {
            if (!url) continue;
            const [sourceName, ...pathParts] = url.split('@');
            const path = pathParts.join('@');
            console.log(`[PARSE]   → Found source: "${sourceName}" | path: "${path.substring(0, 50)}..."`);
            respLines.push({ sourceName: sourceName.trim(), path: path.trim() });
        }
        console.log('[PARSE] ✓ Parsed', respLines.length, 'sources');
    } catch (e) {
        console.log('[PARSE] ✗ Error parsing:', e.message);
    }
    
    return respLines;
}

async function getEpisodeUrl(showId, epNo, mode = 'sub', quality = 'best') {
    console.log(`\n[EPISODE] Getting URL for show=${showId} ep=${epNo} mode=${mode} quality=${quality}`);
    
    try {
        const episodeFormats = [epNo, String(parseFloat(epNo)), String(parseInt(epNo)).padStart(2, '0'), parseFloat(epNo).toFixed(1)];
        let apiData = null;
        const episodeEmbedGql = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
            episode( showId: $showId translationType: $translationType episodeString: $episodeString ) { 
                episodeString 
                sourceUrls 
            }
        }`;

        console.log('[EPISODE] Trying episode formats:', episodeFormats);
        for (const epString of episodeFormats) {
            try {
                const postResp = await axiosInstance.post(`${ALLANIME_API}/api`, {
                    variables: { showId, translationType: mode, episodeString: epString },
                    query: episodeEmbedGql
                });
                const rawText = JSON.stringify(postResp.data);
                console.log(`[EPISODE]   Testing format "${epString}": ${rawText.includes('sourceUrls') ? '✓ has sources' : '✗ no sources'}`);
                if (rawText.includes('sourceUrls')) {
                    apiData = postResp.data;
                    console.log('[EPISODE] ✓ API response received');
                    break;
                }
            } catch (e) {
                console.log(`[EPISODE]   Format "${epString}" failed:`, e.message);
            }
        }

        if (!apiData) {
            console.log('[EPISODE] ✗ No API response found');
            return null;
        }

        let respLines = parseSourceLines(apiData);
        if (respLines.length === 0) {
            console.log('[EPISODE] ✗ parseSourceLines returned empty');
            return null;
        }

        const providerDefs = [
            { name: 'Default', filemoon: false },
            { name: 'Yt-mp4', filemoon: false },
            { name: 'S-mp4', filemoon: false },
            { name: 'Luf-Mp4', filemoon: false },
            { name: 'Fm-mp4', filemoon: true }
        ];

        console.log('[EPISODE] Fetching from', respLines.length, 'providers...');
        const linkPromises = providerDefs.map(async (prov) => {
            const entry = respLines.find(r => r.sourceName === prov.name);
            if (!entry) {
                console.log(`[EPISODE]   ${prov.name}: ✗ not found`);
                return [];
            }
            try {
                console.log(`[EPISODE]   ${prov.name}: fetching...`);
                const links = prov.filemoon ? 
                    await getFilemoonLinks(entry.path) : 
                    await getLinks(entry.path);
                console.log(`[EPISODE]   ${prov.name}: ✓ got ${links.length} links`);
                return links;
            } catch (e) {
                console.log(`[EPISODE]   ${prov.name}: ✗ error -`, e.message);
                return [];
            }
        });

        const results = await Promise.all(linkPromises);
        let allLinks = results.flat();
        console.log('[EPISODE] ✓ Total links found:', allLinks.length);
        
        if (allLinks.length === 0) {
            console.log('[EPISODE] ✗ No playable links found');
            return null;
        }

        const qualityOrder = ['1080', '720', '480', '360', 'hls'];
        let selected = allLinks[0];
        for (const q of qualityOrder) {
            const match = allLinks.find(l => l.resolution.includes(q));
            if (match) {
                selected = match;
                break;
            }
        }
        
        console.log('[EPISODE] ✓ Selected:', selected.resolution);
        return selected.url;
    } catch (e) {
        console.log('[EPISODE] ✗ Fatal error:', e.message);
        return null;
    }
}

async function searchAnime(query) {
    const searchGql = `query($search: SearchInput $limit: Int $page: Int $countryOrigin: VaildCountryOriginEnumType) {
        shows( search: $search limit: $limit page: $page countryOrigin: $countryOrigin ) {
            edges {
                _id
                name
                englishName
                nativeName
                availableEpisodes
                __typename
            }
        }
    }`;
    try {
        const response = await executeWithLimit(async () => axiosInstance.post(`${ALLANIME_API}/api`, {
            variables: { search: { allowAdult: false, allowUnknown: false, query: query }, limit: 20, page: 1, countryOrigin: "ALL" },
            query: searchGql
        }, { timeout: 12000 }));
        const shows = response.data.data.shows.edges || [];
        return shows.slice(0, 15).map(show => ({
            id: show._id,
            title: show.englishName || show.name.replace(/\\"/g, '"'),
            episodes_sub: parseInt(show.availableEpisodes.sub) || 0,
            episodes_dub: parseInt(show.availableEpisodes.dub) || 0
        }));
    } catch (e) {
        console.error('Search error:', e.message);
        return [];
    }
}

async function getAnimeDetails(showId) {
    const query = `query ($showId: String!) {
        show( _id: $showId ) {
            _id
            name
            englishName
            nativeName
            thumbnail
            description
            status
            availableEpisodesDetail
        }
    }`;
    try {
        const response = await axiosInstance.post(`${ALLANIME_API}/api`, {
            variables: { showId },
            query: query
        });
        const show = response.data.data.show;
        if (!show) return null;
        return {
            id: show._id,
            title: show.englishName || show.name,
            title_english: show.englishName || show.name,
            thumbnail_url: show.thumbnail,
            synopsis: show.description ? show.description.replace(/<[^>]*>?/gm, '') : '',
            status: show.status,
            episodes_sub: parseInt(show.availableEpisodesDetail?.sub) || 0,
            episodes_dub: parseInt(show.availableEpisodesDetail?.dub) || 0
        };
    } catch (e) {
        return null;
    }
}

async function getEpisodesList(showId, mode = 'sub') {
    const query = `query ($showId: String! $translationType: VaildTranslationTypeEnumType!) {
        episodes( showId: $showId translationType: $translationType ) {
            episodeString
            episodeIdNum
        }
    }`;
    try {
        const response = await axiosInstance.post(`${ALLANIME_API}/api`, {
            variables: { showId, translationType: mode },
            query: query
        });
        return response.data.data.episodes || [];
    } catch (e) {
        return [];
    }
}

async function getEpisodeInfo(showId, epNo) {
    const query = `query ($showId: String!, $epNum: String!) {
        episodeInfos( showId: $showId episodeNum: $epNum ) {
            episodeIdNum
            notes
            description
            thumbnails
        }
    }`;
    try {
        const response = await axiosInstance.post(`${ALLANIME_API}/api`, {
            variables: { showId, epNum: epNo },
            query: query
        });
        const infos = response.data.data.episodeInfos;
        if (!infos || infos.length === 0) return null;
        const info = infos[0];
        let thumbnails = info.thumbnails || [];
        thumbnails = thumbnails.map(t => t.startsWith('/') ? `https://${ALLANIME_BASE}${t}` : t);
        return {
            episode_no: info.episodeIdNum,
            title: info.notes || '',
            description: info.description || '',
            thumbnails
        };
    } catch (e) {
        return null;
    }
}

async function getAvailableQualities(showId, epNo, mode = 'sub') {
    try {
        const episodeFormats = [epNo, String(parseFloat(epNo)), String(parseInt(epNo)).padStart(2, '0'), parseFloat(epNo).toFixed(1)];
        let apiData = null;
        const episodeEmbedGql = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
            episode( showId: $showId translationType: $translationType episodeString: $episodeString ) { 
                episodeString 
                sourceUrls 
            }
        }`;

        for (const epString of episodeFormats) {
            try {
                const postResp = await axiosInstance.post(`${ALLANIME_API}/api`, {
                    variables: { showId, translationType: mode, episodeString: epString },
                    query: episodeEmbedGql
                });
                const rawText = JSON.stringify(postResp.data);
                if (rawText.includes('sourceUrls')) {
                    apiData = postResp.data;
                    break;
                }
            } catch (e) { }
        }

        if (!apiData) return [];
        let respLines = parseSourceLines(apiData);
        if (respLines.length === 0) return [];

        const providerDefs = [
            { name: 'Default', filemoon: false },
            { name: 'Yt-mp4', filemoon: false },
            { name: 'S-mp4', filemoon: false },
            { name: 'Luf-Mp4', filemoon: false },
            { name: 'Fm-mp4', filemoon: true }
        ];

        const linkPromises = providerDefs.map(async (prov) => {
            const entry = respLines.find(r => r.sourceName === prov.name);
            if (!entry) return [];
            try {
                if (prov.filemoon) return await getFilemoonLinks(entry.path);
                return await getLinks(entry.path);
            } catch (e) { return []; }
        });

        const results = await Promise.all(linkPromises);
        let allLinks = results.flat();
        if (allLinks.length === 0) return [];

        const resolutions = [...new Set(allLinks.map(l => l.resolution))];
        return resolutions;
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
    getAvailableQualities
};
