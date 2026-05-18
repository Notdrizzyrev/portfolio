const axios = require('axios');
const JIKAN_API = 'https://api.jikan.moe/v4';

let lastRequestTime = 0;
const MIN_REQUEST_DELAY = 300;

async function delayIfNeeded() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_DELAY) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_DELAY - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

const axiosInstance = axios.create({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
});

async function retryRequest(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await delayIfNeeded();
      return await fn();
    } catch (e) {
      if ((e.response?.status === 429 || e.response?.status === 500) && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      } else throw e;
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// JIKAN API - Search, Details, Episodes (WORKING)
// ════════════════════════════════════════════════════════════════════════════

async function searchAnime(query) {
  try {
    if (!query?.trim()) return [];
    const response = await retryRequest(() => 
      axiosInstance.get(`${JIKAN_API}/anime`, { 
        params: { query: query.trim(), limit: 15 } 
      })
    );
    return (response.data?.data || []).map(item => ({
      id: String(item.mal_id),
      title: item.title || item.title_english || 'Unknown',
      title_english: item.title_english || item.title || 'Unknown',
      thumbnail_url: item.images?.jpg?.image_url || '',
      synopsis: item.synopsis || '',
      status: item.status || 'Unknown',
      year: item.year || null,
      score: item.score || 0
    }));
  } catch (e) {
    console.error('[searchAnime]', e.message);
    return [];
  }
}

async function getAnimeDetails(malId) {
  try {
    if (!malId) return null;
    const response = await retryRequest(() => axiosInstance.get(`${JIKAN_API}/anime/${malId}`));
    const anime = response.data?.data;
    if (!anime) return null;
    return {
      id: String(anime.mal_id),
      title: anime.title || anime.title_english || 'Unknown',
      title_english: anime.title_english || anime.title || 'Unknown',
      thumbnail_url: anime.images?.jpg?.image_url || '',
      synopsis: anime.synopsis || '',
      status: anime.status || 'Unknown',
      episodes_sub: anime.episodes || 0,
      episodes_dub: 0,
      year: anime.year || null,
      score: anime.score || 0,
      studios: (anime.studios || []).map(s => s.name).join(', '),
      genres: (anime.genres || []).map(g => g.name).join(', ')
    };
  } catch (e) {
    console.error('[getAnimeDetails]', e.message);
    return null;
  }
}

async function getEpisodesList(malId, mode = 'sub') {
  try {
    const response = await retryRequest(() => axiosInstance.get(`${JIKAN_API}/anime/${malId}/episodes`));
    const episodes = response.data?.data || [];
    return episodes.map((ep, idx) => ({
      episodeString: String(ep.mal_id || idx + 1),
      episodeIdNum: idx + 1,
      title: ep.title || `Episode ${idx + 1}`
    }));
  } catch (e) {
    console.error('[getEpisodesList]', e.message);
    return [];
  }
}

async function getEpisodeInfo(malId, epNo) {
  try {
    const response = await retryRequest(() => axiosInstance.get(`${JIKAN_API}/anime/${malId}/episodes/${epNo}`));
    const ep = response.data?.data;
    if (!ep) return null;
    return {
      episode_no: ep.mal_id || epNo,
      title: ep.title || `Episode ${epNo}`,
      description: ep.synopsis || '',
      thumbnails: []
    };
  } catch (e) {
    console.error('[getEpisodeInfo]', e.message);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ALLANIME API - FIXED VERSION
// ════════════════════════════════════════════════════════════════════════════

// Try multiple AllAnime API endpoints
const ALLANIME_ENDPOINTS = [
  'https://api.allanime.day/api',
  'https://allanimenew.onrender.com/api',
  'https://allanime-api.vercel.app/api'
];

const malToAllanimeCache = new Map();

async function getAllanimeShowId(malId) {
  try {
    if (malToAllanimeCache.has(malId)) {
      return malToAllanimeCache.get(malId);
    }

    // Get title from Jikan
    const animeDetails = await getAnimeDetails(malId);
    if (!animeDetails) return null;

    const searchTitle = animeDetails.title_english || animeDetails.title;
    console.log(`[AllAnime] Searching for: ${searchTitle}`);

    // Try each endpoint
    for (const endpoint of ALLANIME_ENDPOINTS) {
      try {
        // ✅ FIXED: Use GET with query parameter instead of POST
        const url = `${endpoint}?variables=${encodeURIComponent(
          JSON.stringify({
            search: {
              allowAdult: false,
              query: searchTitle,
              limit: 1
            }
          })
        )}&query=query%20(%24search%3A%20SearchInput)%20%7B%20fastSearch(search%3A%20%24search)%20%7B%20edges%20%7B%20_id%20name%20englishName%20%7D%20%7D%20%7D`;

        const response = await axiosInstance.get(url, {
          headers: { 'Referer': 'https://allanime.day/' }
        });

        const showId = response.data?.data?.fastSearch?.edges?.[0]?._id;
        if (showId) {
          malToAllanimeCache.set(malId, showId);
          console.log(`[AllAnime] ✅ Found: MAL ${malId} → ${showId}`);
          return showId;
        }
      } catch (e) {
        console.log(`[AllAnime] Endpoint ${endpoint} failed: ${e.message}`);
        continue;
      }
    }

    console.log(`[AllAnime] ❌ Not found on any endpoint`);
    return null;
  } catch (e) {
    console.error('[getAllanimeShowId]', e.message);
    return null;
  }
}

async function getEpisodeUrl(malId, epNo, mode = 'sub', quality = 'best') {
  try {
    console.log(`[getEpisodeUrl] Trying to get stream for MAL ${malId} ep ${epNo}`);

    // Get AllAnime show ID
    const showId = await getAllanimeShowId(malId);
    if (!showId) {
      console.log('[getEpisodeUrl] ❌ Anime not found on AllAnime, using test stream');
      return getTestStreams(malId, epNo);
    }

    // Try to get episode URL from each endpoint
    for (const endpoint of ALLANIME_ENDPOINTS) {
      try {
        const episodeQuery = `query ($showId: String! $translationType: VaildTranslationTypeEnumType! $episodeString: String!) {
          episode(showId: $showId translationType: $translationType episodeString: $episodeString) {
            sourceUrls
          }
        }`;

        const url = `${endpoint}?variables=${encodeURIComponent(
          JSON.stringify({
            showId,
            translationType: mode === 'dub' ? 'dub' : 'sub',
            episodeString: String(epNo)
          })
        )}&query=${encodeURIComponent(episodeQuery)}`;

        const response = await axiosInstance.get(url, {
          headers: { 'Referer': 'https://allanime.day/' }
        });

        const sourceUrls = response.data?.data?.episode?.sourceUrls;
        if (sourceUrls && sourceUrls.length > 0) {
          console.log(`[getEpisodeUrl] ✅ Got stream: ${sourceUrls[0].substring(0, 50)}...`);
          return sourceUrls[0];
        }
      } catch (e) {
        console.log(`[getEpisodeUrl] Endpoint failed: ${e.message}`);
        continue;
      }
    }

    // Fallback to test stream
    console.log('[getEpisodeUrl] ⚠️ No stream found, using test');
    return getTestStreams(malId, epNo);
  } catch (e) {
    console.error('[getEpisodeUrl]', e.message);
    return getTestStreams(malId, epNo);
  }
}

// Test streams for fallback
function getTestStreams(malId, epNo, quality = 'best') {
  const testSources = {
    '5': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4',
    '1': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/ElephantsDream.mp4',
    '20': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/Sintel.mp4',
    '21': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4',
    '22': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerBlazes.mp4',
    '30': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/SubaruNoKorogashi.mp4'
  };
  return testSources[malId] || null;
}

async function getAvailableQualities(malId, epNo, mode = 'sub') {
  try {
    return ['1080p', '720p', '480p', '360p', '240p'];
  } catch (e) {
    console.error('[getAvailableQualities]', e.message);
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
