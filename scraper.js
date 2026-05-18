const axios = require('axios');

const JIKAN_API = 'https://api.jikan.moe/v4';

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_DELAY = 300; // 300ms between requests

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
  maxRedirects: 3,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

// Retry logic
async function retryRequest(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await delayIfNeeded();
      return await fn();
    } catch (e) {
      if (e.response?.status === 429 && i < maxRetries - 1) {
        const delay = 1000 * (i + 1);
        console.log(`[retry] 429 Rate Limited, waiting ${delay}ms before retry ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (e.response?.status === 500 && i < maxRetries - 1) {
        const delay = 500 * (i + 1);
        console.log(`[retry] 500 Server Error, waiting ${delay}ms before retry ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw e;
      }
    }
  }
}

async function searchAnime(query) {
  try {
    if (!query || query.trim().length === 0) {
      console.log('[searchAnime] Empty query');
      return [];
    }
    
    const trimmedQuery = query.trim();
    console.log('[searchAnime] Searching for:', trimmedQuery);
    
    const response = await retryRequest(() => 
      axiosInstance.get(`${JIKAN_API}/anime`, {
        params: {
          query: trimmedQuery,
          limit: 15
        }
      })
    );

    console.log('[searchAnime] API Response status:', response.status);
    
    const items = response.data?.data;
    
    if (!items || !Array.isArray(items)) {
      console.log('[searchAnime] No items found or invalid format');
      return [];
    }

    console.log('[searchAnime] Found', items.length, 'results');
    
    const results = [];
    for (const item of items) {
      results.push({
        id: String(item.mal_id),
        title: item.title || item.title_english || 'Unknown',
        title_english: item.title_english || item.title || 'Unknown',
        thumbnail_url: item.images?.jpg?.image_url || '',
        synopsis: item.synopsis || '',
        status: item.status || 'Unknown',
        year: item.year || null,
        score: item.score || 0
      });
    }
    
    console.log('[searchAnime] Returning', results.length, 'formatted results');
    return results;
  } catch (e) {
    console.error('[searchAnime] ERROR:', e.message);
    return [];
  }
}

async function getAnimeDetails(malId) {
  try {
    if (!malId) return null;
    
    console.log('[getAnimeDetails] Fetching ID:', malId);
    const response = await retryRequest(() =>
      axiosInstance.get(`${JIKAN_API}/anime/${malId}`)
    );
    
    if (!response.data?.data) return null;
    
    const anime = response.data.data;
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
    console.error('[getAnimeDetails] ERROR:', e.message);
    return null;
  }
}

async function getEpisodesList(malId, mode = 'sub') {
  try {
    console.log('[getEpisodesList] Fetching episodes for ID:', malId);
    const response = await retryRequest(() =>
      axiosInstance.get(`${JIKAN_API}/anime/${malId}/episodes`)
    );
    
    if (!response.data?.data || !Array.isArray(response.data.data)) {
      console.log('[getEpisodesList] No episodes found');
      return [];
    }
    
    const episodes = response.data.data.map((ep, idx) => ({
      episodeString: String(ep.mal_id || idx + 1),
      episodeIdNum: idx + 1,
      title: ep.title || `Episode ${idx + 1}`
    }));
    
    console.log('[getEpisodesList] Returning', episodes.length, 'episodes');
    return episodes;
  } catch (e) {
    console.error('[getEpisodesList] ERROR:', e.message);
    return [];
  }
}

async function getEpisodeInfo(malId, epNo) {
  try {
    console.log('[getEpisodeInfo] Fetching info for ID:', malId, 'EP:', epNo);
    const response = await retryRequest(() =>
      axiosInstance.get(`${JIKAN_API}/anime/${malId}/episodes/${epNo}`)
    );
    
    if (!response.data?.data) return null;
    
    const ep = response.data.data;
    return {
      episode_no: ep.mal_id || epNo,
      title: ep.title || `Episode ${epNo}`,
      description: ep.synopsis || '',
      thumbnails: []
    };
  } catch (e) {
    console.error('[getEpisodeInfo] ERROR:', e.message);
    return null;
  }
}

async function getEpisodeUrl(malId, epNo, mode = 'sub', quality = 'best') {
  try {
    console.log('[getEpisodeUrl] Streaming not available via Jikan API for ID:', malId, 'EP:', epNo);
    return null;
  } catch (e) {
    console.error('[getEpisodeUrl] ERROR:', e.message);
    return null;
  }
}

async function getAvailableQualities(malId, epNo, mode = 'sub') {
  try {
    return ['720p', '480p', '360p'];
  } catch (e) {
    console.error('[getAvailableQualities] ERROR:', e.message);
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
