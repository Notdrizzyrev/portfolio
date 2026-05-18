const axios = require('axios');

const JIKAN_API = 'https://api.jikan.moe/v4';
const ALLANIME_API = 'https://api.allanime.day/api';

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
  headers: { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://allanime.day'
  }
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

// ═══════════════════════════════════════════════════════════════════════════
// JIKAN SEARCH (MAL metadata)
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// ALLANIME INTEGRATION - REAL STREAMS
// ═══════════════════════════════════════════════════════════════════════════

// Cache MAL ID → AllAnime ID mapping
const malToAllanimeCache = new Map();

async function getAllanimeShowId(malId) {
  try {
    // Check cache first
    if (malToAllanimeCache.has(malId)) {
      return malToAllanimeCache.get(malId);
    }

    // Get title from Jikan
    const animeDetails = await getAnimeDetails(malId);
    if (!animeDetails) return null;

    const searchTitle = animeDetails.title_english || animeDetails.title;
    
    // Search AllAnime by title
    const variables = JSON.stringify({ 
      search: { 
        allowAdult: false, 
        query: searchTitle, 
        limit: 1 
      } 
    });
    
    const query = `query ($search: SearchInput) { 
      fastSearch(search: $search) { 
        edges { 
          _id name englishName 
        } 
      } 
    }`;

    const response = await retryRequest(() =>
      axiosInstance.post(ALLANIME_API, {
        variables,
        query
      })
    );

    const showId = response.data?.data?.fastSearch?.edges?.[0]?._id;
    if (showId) {
      malToAllanimeCache.set(malId, showId);
      console.log(`[AllAnime] Mapped MAL ${malId} → AllAnime ${showId}`);
      return showId;
    }

    return null;
  } catch (e) {
    console.error('[getAllanimeShowId]', e.message);
    return null;
  }
}

async function getEpisodeUrl(malId, epNo, mode = 'sub', quality = 'best') {
  try {
    console.log(`[getEpisodeUrl] Getting stream for MAL ${malId} ep ${epNo}`);

    // Get AllAnime show ID from MAL ID
    const allanimeShowId = await getAllanimeShowId(malId);
    if (!allanimeShowId) {
      console.log('[getEpisodeUrl] Could not find anime on AllAnime');
      return null;
    }

    // Query AllAnime for episode sources
    const query = `query ($showId: String! $translationType: VaildTranslationTypeEnumType! $episodeString: String!) {
      episode(showId: $showId translationType: $translationType episodeString: $episodeString) {
        sourceUrls
      }
    }`;

    const variables = {
      showId: allanimeShowId,
      translationType: mode === 'dub' ? 'dub' : 'sub',
      episodeString: String(epNo)
    };

    const response = await retryRequest(() =>
      axiosInstance.post(ALLANIME_API, {
        variables,
        query
      })
    );

    const sourceUrls = response.data?.data?.episode?.sourceUrls;
    
    if (!sourceUrls || sourceUrls.length === 0) {
      console.log('[getEpisodeUrl] No sources found on AllAnime');
      return null;
    }

    // Return first available source
    const url = sourceUrls[0];
    console.log(`[getEpisodeUrl] ✅ Found stream: ${url.substring(0, 50)}...`);
    return url;

  } catch (e) {
    console.error('[getEpisodeUrl]', e.message);
    return null;
  }
}

async function getAvailableQualities(malId, epNo, mode = 'sub') {
  try {
    // AllAnime typically offers these qualities
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