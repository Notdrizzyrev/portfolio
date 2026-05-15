const axios = require('axios');
const crypto = require('crypto');

const AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0";
const ALLANIME_REFR = "https://allmanga.to";
const ALLANIME_BASE = "allanime.day";
const ALLANIME_API = `https://api.${ALLANIME_BASE}`;
const ALLANIME_KEY = crypto.createHash('sha256').update('Xot36i3lK3:v1').digest('hex');

// Persisted query hash for episode embeds (from ani-cli v4.14.0)
const EPISODE_QUERY_HASH = "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec";

const axiosInstance = axios.create({
    headers: {
        'User-Agent': AGENT,
        'Referer': ALLANIME_REFR
    },
    timeout: 15000,
    maxRedirects: 5,
    httpAgent: require('http').globalAgent,
    httpsAgent: require('https').globalAgent
});

// Request concurrency limiter
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
    } catch (e) {
        // Filemoon provider fetch failed
    }

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
    } catch (e) {
        // Provider fetch failed
    }

    return allLinks;
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
            variables: {
                search: {
                    allowAdult: false,
                    allowUnknown: false,
                    query: query
                },
                limit: 20,
                page: 1,
                countryOrigin: "ALL"
            },
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
            episodes_sub: show.availableEpisodesDetail.sub ? show.availableEpisodesDetail.sub.length : 0,
            episodes_dub: show.availableEpisodesDetail.dub ? show.availableEpisodesDetail.dub.length : 0
        };
    } catch (e) {
        return null;
    }
}

async function getEpisodesList(showId, mode = 'sub') {
    const episodesListGql = `query ($showId: String!) {
        show( _id: $showId ) {
            _id
            availableEpisodesDetail
        }
    }`;

    try {
        const response = await axiosInstance.post(`${ALLANIME_API}/api`, {
            variables: { showId },
            query: episodesListGql
        });

        const details = response.data.data.show.availableEpisodesDetail;
        const episodes = details[mode] || [];
        return episodes.sort((a, b) => parseFloat(a) - parseFloat(b));
    } catch (e) {
        return [];
    }
}

// IMPROVED: Better source line parsing for old AND new anime
function parseSourceLines(apiData) {
    const rawJson = JSON.stringify(apiData);
    let respLines = [];

    // CASE 1: Encrypted data (old anime format)
    if (rawJson.includes('"tobeparsed"')) {
        const data = apiData.data;
        const blob = apiData.tobeparsed ||
            (data && data.tobeparsed) ||
            (data && data.episode && data.episode.tobeparsed) ||
            null;

        let blobValue = blob;
        if (!blobValue) {
            const tbpMatch = rawJson.match(/"tobeparsed":"([^"]*)"/);
            if (tbpMatch) blobValue = tbpMatch[1];
        }

        if (blobValue) {
            const plain = decrypt(blobValue);
            if (plain) {
                const parts = plain.replace(/[{}]/g, '\n').split('\n');
                for (const part of parts) {
                    const m1 = part.match(/"sourceUrl":"--([^"]*)".*"sourceName":"([^"]*)"/);
                    const m2 = part.match(/"sourceName":"([^"]*)".*"sourceUrl":"--([^"]*)"/);
                    if (m1) {
                        respLines.push({ sourceName: m1[2], hex: m1[1] });
                    } else if (m2) {
                        respLines.push({ sourceName: m2[1], hex: m2[2] });
                    }
                }
            }
        }
    }
    
    // CASE 2: Direct sourceUrls (new anime format)
    if (apiData.data && apiData.data.episode && apiData.data.episode.sourceUrls) {
        const sourceUrls = apiData.data.episode.sourceUrls;
        if (Array.isArray(sourceUrls)) {
            for (const source of sourceUrls) {
                if (source.sourceUrl && source.sourceName) {
                    const hex = source.sourceUrl.replace(/^--/, '');
                    respLines.push({ sourceName: source.sourceName, hex });
                }
            }
        } else if (typeof sourceUrls === 'string') {
            const raw = sourceUrls;
            const cleaned = raw.replace(/\\u002F/g, '/').replace(/\\/g, '');
            const parts = cleaned.replace(/[{}[\]]/g, '\n').split('\n');
            for (const part of parts) {
                const m1 = part.match(/"sourceUrl":"--([^"]*)".*"sourceName":"([^"]*)"/);
                const m2 = part.match(/"sourceName":"([^"]*)".*"sourceUrl":"--([^"]*)"/);
                if (m1) {
                    respLines.push({ sourceName: m1[2], hex: m1[1] });
                } else if (m2) {
                    respLines.push({ sourceName: m2[1], hex: m2[2] });
                }
            }
        }
    }

    return respLines;
}

// IMPROVED: Better episode URL fetching for new anime
async function getEpisodeUrl(showId, epNo, mode = 'sub', quality = 'best') {
    const episodeEmbedGql = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
        episode( showId: $showId translationType: $translationType episodeString: $episodeString ) {
            episodeString
            sourceUrls
        }
    }`;

    // Try multiple episode string formats
    const episodeFormats = [
        epNo,
        String(parseFloat(epNo)),
        String(parseInt(epNo)).padStart(2, '0'),
        parseFloat(epNo).toFixed(1)
    ];

    let apiData = null;

    for (const epString of episodeFormats) {
        try {
            // POST request to get episode data  
            const postResp = await axiosInstance.post(`${ALLANIME_API}/api`, {
                variables: {
                    showId: showId,
                    translationType: mode,
                    episodeString: epString
                },
                query: episodeEmbedGql
            });
            
            const rawText = JSON.stringify(postResp.data);
            if (rawText && (rawText.includes('tobeparsed') || rawText.includes('sourceUrls'))) {
                apiData = postResp.data;
                console.log(`[Episode] Got data for ep=${epString}`);
                break;
            }
        } catch (e) {
            console.log(`[Episode] Format ${epString} failed: ${e.message}`);
            continue;
        }
    }

    if (!apiData) {
        console.log(`[Episode] No API data found for ${showId} ep${epNo} ${mode}`);
        return null;
    }

    // Check for NEED_CAPTCHA or other errors
    if (apiData.errors && apiData.errors.length > 0) {
        const err = apiData.errors[0]?.message || 'Unknown API error';
        console.log(`[Episode] API error: ${err}`);
        return null;
    }

    let respLines = parseSourceLines(apiData);

    if (respLines.length === 0) {
        console.log(`[Episode] No sources found`);
        return null;
    }

    // Provider order: 1=Default, 2=Yt-mp4, 3=S-mp4, 4=Luf-Mp4, 5=Fm-mp4
    const providerDefs = [
        { name: 'Default', filemoon: false },
        { name: 'Yt-mp4', filemoon: false },
        { name: 'S-mp4', filemoon: false },
        { name: 'Luf-Mp4', filemoon: false },
        { name: 'Fm-mp4', filemoon: true }
    ];

    // Try each provider
    for (const prov of providerDefs) {
        const entry = respLines.find(r => r.sourceName === prov.name);
        if (!entry) continue;
        
        const decodedPath = decodeProviderId(entry.hex);
        if (!decodedPath) continue;

        try {
            let links = [];
            if (prov.filemoon) {
                links = await getFilemoonLinks(decodedPath);
            } else {
                links = await getLinks(decodedPath);
            }
            
            if (links.length > 0) {
                // Sort by quality
                links.sort((a, b) => (parseInt(b.resolution) || 0) - (parseInt(a.resolution) || 0));
                
                if (quality === 'best') {
                    return links[0].url;
                } else if (quality === 'worst') {
                    return links[links.length - 1].url;
                } else {
                    const match = links.find(l => l.resolution === quality);
                    return match ? match.url : links[0].url;
                }
            }
        } catch (e) {
            console.log(`[Episode] Provider ${prov.name} failed:`, e.message);
            continue;
        }
    }

    // Fallback: Try direct extraction from sourceUrls if available
    if (apiData.data?.episode?.sourceUrls) {
        const sourceUrls = apiData.data.episode.sourceUrls;
        if (typeof sourceUrls === 'string' && sourceUrls.length > 0) {
            // Try to extract direct URLs
            const urlMatch = sourceUrls.match(/https?:\/\/[^\s"'<>]+/);
            if (urlMatch) {
                console.log(`[Episode] Using direct URL from sourceUrls`);
                return urlMatch[0];
            }
        }
    }

    console.log(`[Episode] No playable links found`);
    return null;
}

async function getEpisodeInfo(showId, epNo) {
    const epNum = parseFloat(epNo);
    const query = `query ($showId: String!, $epNum: Float!) {
        episodeInfos( showId: $showId episodeNumStart: $epNum episodeNumEnd: $epNum ) {
            episodeIdNum
            notes
            description
            thumbnails
        }
    }`;

    try {
        const response = await axiosInstance.post(`${ALLANIME_API}/api`, {
            variables: { showId, epNum },
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
            thumbnails: thumbnails
        };
    } catch (e) {
        return null;
    }
}

async function getAvailableQualities(showId, epNo, mode = 'sub') {
    try {
        const episodeFormats = [
            epNo,
            String(parseFloat(epNo)),
            String(parseInt(epNo)).padStart(2, '0'),
            parseFloat(epNo).toFixed(1)
        ];

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
                if (rawText && (rawText.includes('tobeparsed') || rawText.includes('sourceUrls'))) {
                    apiData = postResp.data;
                    break;
                }
            } catch (e) { }
        }

        if (!apiData) return [];
        if (apiData.errors && apiData.errors.length > 0) return [];

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
            const decodedPath = decodeProviderId(entry.hex);
            if (!decodedPath) return [];
            try {
                if (prov.filemoon) return await getFilemoonLinks(decodedPath);
                return await getLinks(decodedPath);
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
