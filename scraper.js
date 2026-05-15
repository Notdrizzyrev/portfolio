const axios = require('axios');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

const AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0";
const ALLANIME_BASE = "allanime.day";
const ALLANIME_API = `https://api.${ALLANIME_BASE}`;
const ALLANIME_KEY = crypto.createHash('sha256').update('Xot36i3lK3:v1').digest('hex');
const EPISODE_QUERY_HASH = "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec";

// ⚡ Connection pooling
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

// ⚡ Reuse axios instance
const axiosInstance = axios.create({
    httpAgent,
    httpsAgent,
    headers: { 'User-Agent': AGENT, 'Referer': 'https://allmanga.to' },
    timeout: 6000
});

// ⚡ Provider cache (avoid repeated fetches)
const providerCache = new Map();
const PROVIDER_TTL = 900000; // 15 mins

function decodeMapping() {
    const map = {};
    const data = '79:A,7a:B,7b:C,7c:D,7d:E,7e:F,7f:G,70:H,71:I,72:J,73:K,74:L,75:M,76:N,77:O,68:P,69:Q,6a:R,6b:S,6c:T,6d:U,6e:V,6f:W,60:X,61:Y,62:Z,59:a,5a:b,5b:c,5c:d,5d:e,5e:f,5f:g,50:h,51:i,52:j,53:k,54:l,55:m,56:n,57:o,48:p,49:q,4a:r,4b:s,4c:t,4d:u,4e:v,4f:w,40:x,41:y,42:z,08:0,09:1,0a:2,0b:3,0c:4,0d:5,0e:6,0f:7,00:8,01:9,15:-,16:.,67:_,46:~,02::,17:/,07:?,1b:#,63:[,65:],78:@,19:!,1c:$,1e:&,10:(,11:),12:*,13:+,14:,,03:;,05:=,1d:%';
    data.split(',').forEach(p => {
        const [k, v] = p.split(':');
        map[k] = v;
    });
    return map;
}

const DECODE_MAP = decodeMapping();

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

function decodeProviderId(hex) {
    let result = '';
    for (let i = 0; i < hex.length; i += 2) {
        result += DECODE_MAP[hex.substring(i, i + 2)] || '';
    }
    return result.replace('/clock', '/clock.json');
}

async function getFilemoonLinks(providerPath) {
    const cacheKey = `filemoon:${providerPath}`;
    const cached = providerCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < PROVIDER_TTL) return cached.data;

    const fetchUrl = providerPath.startsWith('http') ? providerPath : `https://${ALLANIME_BASE}${providerPath}`;
    const allLinks = [];

    try {
        const response = await axiosInstance.get(fetchUrl);
        const fmData = response.data;

        if (fmData?.iv && fmData?.payload && fmData?.key_parts) {
            const keyHex = b64urlToHex(fmData.key_parts[0]) + b64urlToHex(fmData.key_parts[1]);
            const ivHex = b64urlToHex(fmData.iv) + '00000002';
            let payloadB64 = fmData.payload;
            const pMod = payloadB64.length % 4;
            if (pMod === 2) payloadB64 += '==';
            else if (pMod === 3) payloadB64 += '=';
            payloadB64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
            const payloadBuf = Buffer.from(payloadB64, 'base64');
            const ciphertext = payloadBuf.slice(0, payloadBuf.length - 16);
            const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(keyHex, 'hex'), Buffer.from(ivHex, 'hex'));
            let decrypted = decipher.update(ciphertext);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            const plain = decrypted.toString('utf8');
            
            plain.replace(/[{}\[\]]/g, '\n').split('\n').forEach(part => {
                const m1 = part.match(/"url":"([^"]*)".*"height":(\d+)/);
                const m2 = part.match(/"height":(\d+).*"url":"([^"]*)"/);
                if (m1) {
                    allLinks.push({ resolution: m1[2], url: m1[1].replace(/\\u0026/g, '&').replace(/\\u003D/g, '=') });
                } else if (m2) {
                    allLinks.push({ resolution: m2[1], url: m2[2].replace(/\\u0026/g, '&').replace(/\\u003D/g, '=') });
                }
            });
        }
    } catch (e) {}

    providerCache.set(cacheKey, { data: allLinks, ts: Date.now() });
    return allLinks;
}

async function getLinks(providerPath) {
    const cacheKey = `links:${providerPath}`;
    const cached = providerCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < PROVIDER_TTL) return cached.data;

    let allLinks = [];
    if (providerPath.includes('tools.fast4speed.rsvp')) {
        allLinks.push({ resolution: 'Yt', url: providerPath });
        providerCache.set(cacheKey, { data: allLinks, ts: Date.now() });
        return allLinks;
    }

    const fetchUrl = providerPath.startsWith('http') ? providerPath : `https://${ALLANIME_BASE}${providerPath}`;

    try {
        const response = await axiosInstance.get(fetchUrl);
        const providerData = response.data;

        if (providerData?.links?.length) {
            providerData.links.forEach(link => {
                const { link: url, resolutionStr: res = 'unknown' } = link;
                if (!url) return;
                
                if (url.includes('repackager.wixmp.com')) {
                    const qualitiesMatch = url.match(/\/,([^/]*),\/mp4/);
                    if (qualitiesMatch) {
                        const cleaned = url.replace('repackager.wixmp.com/', '').replace(/\.urlset.*/, '');
                        qualitiesMatch[1].split(',').forEach(q => {
                            allLinks.push({ resolution: q, url: cleaned.replace(/,[^/]*/, q) });
                        });
                    } else {
                        allLinks.push({ resolution: res, url });
                    }
                } else {
                    allLinks.push({ resolution: res, url });
                }
            });
        }
        if (providerData?.hls?.url) allLinks.push({ resolution: 'hls', url: providerData.hls.url });
    } catch (e) {}

    providerCache.set(cacheKey, { data: allLinks, ts: Date.now() });
    return allLinks;
}

function parseSourceLines(apiData) {
    const respLines = [];
    if (!apiData?.data?.episode?.sourceUrls) return respLines;

    apiData.data.episode.sourceUrls.forEach(source => {
        const sourceName = source.sourceName || source.sourceUrl;
        const sourceUrl = source.sourceUrl || source.sourceName;
        if (sourceName && sourceUrl) {
            respLines.push({ sourceName, hex: sourceUrl });
        }
    });
    return respLines;
}

async function searchAnime(query) {
    const gql = `query($search: SearchInput $limit: Int $page: Int $countryOrigin: VaildCountryOriginEnumType) {
        shows( search: $search limit: $limit page: $page countryOrigin: $countryOrigin ) {
            edges { _id name englishName nativeName availableEpisodes __typename }
        }
    }`;

    try {
        const response = await axiosInstance.post(`${ALLANIME_API}/api`, {
            variables: {
                search: { allowAdult: false, allowUnknown: false, query },
                limit: 40,
                page: 1,
                countryOrigin: "ALL"
            },
            query: gql
        });

        return (response.data?.data?.shows?.edges || []).map(show => ({
            id: show._id,
            title: show.englishName || show.name.replace(/\\"/g, '"'),
            episodes_sub: parseInt(show.availableEpisodes.sub) || 0,
            episodes_dub: parseInt(show.availableEpisodes.dub) || 0
        }));
    } catch (e) {
        return [];
    }
}

async function getAnimeDetails(showId) {
    const query = `query ($showId: String!) {
        show( _id: $showId ) {
            _id name englishName nativeName thumbnail description status availableEpisodesDetail
        }
    }`;

    try {
        const response = await axiosInstance.post(`${ALLANIME_API}/api`, {
            variables: { showId },
            query
        });

        const show = response.data?.data?.show;
        if (!show) return null;

        return {
            id: show._id,
            title: show.englishName || show.name,
            description: show.description || '',
            thumbnail_url: show.thumbnail ? `https://${ALLANIME_BASE}${show.thumbnail}` : null,
            status: show.status || 'unknown',
            episodes_sub: parseInt(show.availableEpisodesDetail?.sub) || 0,
            episodes_dub: parseInt(show.availableEpisodesDetail?.dub) || 0
        };
    } catch (e) {
        return null;
    }
}

async function getEpisodesList(showId, mode = 'sub') {
    const query = `query ($showId: String!) {
        show( _id: $showId ) { episodeListData }
    }`;

    try {
        const response = await axiosInstance.post(`${ALLANIME_API}/api`, {
            variables: { showId },
            query
        });

        const episodeData = response.data?.data?.show?.episodeListData;
        if (!episodeData) return [];

        const decrypted = decrypt(episodeData);
        if (!decrypted) return [];

        const eps = JSON.parse(decrypted);
        return (eps.episodes || []).map((ep, idx) => ({
            number: ep.episodeIdNum || (idx + 1),
            title: ep.notes || `Episode ${idx + 1}`,
            isFiller: ep.filler || false
        }));
    } catch (e) {
        return [];
    }
}

async function getEpisodeUrl(showId, epNo, mode = 'sub', quality = 'best') {
    const epFormats = [epNo, String(parseFloat(epNo)), String(parseInt(epNo)).padStart(2, '0'), parseFloat(epNo).toFixed(1)];
    let apiData = null;

    for (const epString of epFormats) {
        try {
            const queryVars = JSON.stringify({ showId, translationType: mode, episodeString: epString });
            const queryExt = JSON.stringify({ persistedQuery: { version: 1, sha256Hash: EPISODE_QUERY_HASH } });
            const apiUrl = `${ALLANIME_API}/api?variables=${encodeURIComponent(queryVars)}&extensions=${encodeURIComponent(queryExt)}`;

            let response = await axiosInstance.get(apiUrl);
            if (JSON.stringify(response.data).includes('tobeparsed')) {
                apiData = response.data;
                break;
            }
        } catch (e) {}

        if (!apiData) {
            try {
                const gql = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
                    episode( showId: $showId translationType: $translationType episodeString: $episodeString ) { episodeString sourceUrls }
                }`;
                const response = await axiosInstance.post(`${ALLANIME_API}/api`, {
                    variables: { showId, translationType: mode, episodeString: epString },
                    query: gql
                });
                if (JSON.stringify(response.data).includes('tobeparsed')) {
                    apiData = response.data;
                    break;
                }
            } catch (e) {}
        }
    }

    if (!apiData?.data?.episode?.sourceUrls) return null;
    if (apiData.errors?.some(e => e.message === 'NEED_CAPTCHA')) throw new Error('NEED_CAPTCHA');

    const respLines = parseSourceLines(apiData);
    if (!respLines.length) return null;

    // ⚡ Fetch providers in parallel (race condition - first to respond wins)
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
        const decodedPath = decodeProviderId(entry.hex);
        if (!decodedPath) return [];
        try {
            return prov.filemoon ? await getFilemoonLinks(decodedPath) : await getLinks(decodedPath);
        } catch (e) {
            return [];
        }
    });

    const results = await Promise.all(linkPromises);
    let allLinks = results.flat();
    if (!allLinks.length) return null;

    allLinks.sort((a, b) => (parseInt(b.resolution) || 0) - (parseInt(a.resolution) || 0));

    let selected = allLinks[0];
    if (quality !== 'best') {
        if (quality === 'worst') {
            const numeric = allLinks.filter(l => /^\d+/.test(l.resolution));
            selected = numeric.length ? numeric[numeric.length - 1] : allLinks[allLinks.length - 1];
        } else {
            const requestedRes = parseInt(quality) || 9999;
            selected = allLinks.find(l => l.resolution.includes(quality)) || allLinks[0];
        }
    }

    return selected.url.replace(/([^:])\/\//g, '$1/');
}

async function getEpisodeInfo(showId, epNo) {
    const epNum = parseFloat(epNo);
    const query = `query ($showId: String!, $epNum: Float!) {
        episodeInfos( showId: $showId episodeNumStart: $epNum episodeNumEnd: $epNum ) {
            episodeIdNum notes description thumbnails
        }
    }`;

    try {
        const response = await axiosInstance.post(`${ALLANIME_API}/api`, {
            variables: { showId, epNum },
            query
        });

        const info = response.data?.data?.episodeInfos?.[0];
        if (!info) return null;

        return {
            episode_no: info.episodeIdNum,
            title: info.notes || '',
            description: info.description || '',
            thumbnails: (info.thumbnails || []).map(t => t.startsWith('/') ? `https://${ALLANIME_BASE}${t}` : t)
        };
    } catch (e) {
        return null;
    }
}

async function getAvailableQualities(showId, epNo, mode = 'sub') {
    try {
        const epFormats = [epNo, String(parseFloat(epNo)), String(parseInt(epNo)).padStart(2, '0'), parseFloat(epNo).toFixed(1)];
        let apiData = null;

        for (const epString of epFormats) {
            try {
                const queryVars = JSON.stringify({ showId, translationType: mode, episodeString: epString });
                const queryExt = JSON.stringify({ persistedQuery: { version: 1, sha256Hash: EPISODE_QUERY_HASH } });
                const response = await axiosInstance.get(
                    `${ALLANIME_API}/api?variables=${encodeURIComponent(queryVars)}&extensions=${encodeURIComponent(queryExt)}`
                );
                if (JSON.stringify(response.data).includes('tobeparsed')) {
                    apiData = response.data;
                    break;
                }
            } catch (e) {}

            if (!apiData) {
                const gql = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
                    episode( showId: $showId translationType: $translationType episodeString: $episodeString ) { episodeString sourceUrls }
                }`;
                const response = await axiosInstance.post(`${ALLANIME_API}/api`, {
                    variables: { showId, translationType: mode, episodeString: epString },
                    query: gql
                });
                if (JSON.stringify(response.data).includes('tobeparsed')) {
                    apiData = response.data;
                    break;
                }
            }
        }

        if (!apiData?.data?.episode?.sourceUrls) return [];

        const respLines = parseSourceLines(apiData);
        if (!respLines.length) return [];

        const providerDefs = [
            { name: 'Default', filemoon: false },
            { name: 'Yt-mp4', filemoon: false },
            { name: 'S-mp4', filemoon: false },
            { name: 'Luf-Mp4', filemoon: false },
            { name: 'Fm-mp4', filemoon: true }
        ];

        const results = await Promise.all(providerDefs.map(async (prov) => {
            const entry = respLines.find(r => r.sourceName === prov.name);
            if (!entry) return [];
            const decodedPath = decodeProviderId(entry.hex);
            if (!decodedPath) return [];
            try {
                return prov.filemoon ? await getFilemoonLinks(decodedPath) : await getLinks(decodedPath);
            } catch (e) {
                return [];
            }
        }));

        const allLinks = results.flat();
        return [...new Set(allLinks.map(l => l.resolution))];
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
