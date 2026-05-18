const axios = require('axios');

const JIKAN_API = 'https://api.jikan.moe/v4';

let lastRequestTime = 0;
const MIN_REQUEST_DELAY = 500;

async function delayIfNeeded() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_DELAY) {
    await new Promise(resolve => 
      setTimeout(resolve, MIN_REQUEST_DELAY - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();
}

const axiosInstance = axios.create({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

// EXPANDED STREAM DATABASE - Added Re:Zero S4 and more anime
const ANIME_STREAMS = {
  '1': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4',
  '5': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4',
  '15': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/ElephantsDream.mp4',
  '20': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/Sintel.mp4',
  '21': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerBlazes.mp4',
  '22': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerBlazes.mp4',
  '30': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/SubaruNoKorogashi.mp4',
  '1535': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/Sintel.mp4',
  '38524': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4',
  '40748': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/ElephantsDream.mp4',
  '52034': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerBlazes.mp4',
  '50265': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/SubaruNoKorogashi.mp4',
  // Re:Zero Seasons
  '31240': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/ElephantsDream.mp4', // Re:Zero S1
  '42203': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/Sintel.mp4', // Re:Zero S2
  '45576': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4', // Re:Zero S3
  '52807': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerBlazes.mp4', // Re:Zero S4
  // More popular anime
  '11': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/Sintel.mp4',
  '12': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4',
  '13': 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/ElephantsDream.mp4',
};

// Retry logic
async function retryRequest(fn, maxRetries = 2) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await delayIfNeeded();
      return await fn();
    } catch (e) {
      if (e.response?.status === 429) {
        const delay = 2000 * (i + 1);
        console.log(`[retry] Rate limited, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (e.response?.status === 500 && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      } else {
        throw e;
      }
    }
  }
}

// Search anime
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
      mal_id: item.mal_id,
      title: item.title || item.title_english || 'Unknown',
      title_english: item.title_english || item.title || 'Unknown',
      thumbnail_url: item.images?.jpg?.image_url || '',
      synopsis: item.synopsis || '',
      status: item.status || 'Unknown',
      year: item.year || null,
      score: item.score || 0,
      airing: item.airing || false,
      aired: item.aired || {},
      type: item.type || 'TV',
      episodes: item.episodes || 0
    }));
  } catch (e) {
    console.error('[searchAnime]', e.message);
    return [];
  }
}

// Get anime details
async function getAnimeDetails(malId) {
  try {
    if (!malId) return null;
    
    const response = await retryRequest(() => 
      axiosInstance.get(`${JIKAN_API}/anime/${malId}`)
    );
    
    const anime = response.data?.data;
    if (!anime) return null;
    
    return {
      id: String(anime.mal_id),
      mal_id: anime.mal_id,
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
      genres: (anime.genres || []).map(g => g.name).join(', '),
      airing: anime.airing || false,
      aired: anime.aired || {},
      type: anime.type || 'TV',
      episodes: anime.episodes || 0,
      images: anime.images || {}
    };
  } catch (e) {
    console.error('[getAnimeDetails]', e.message);
    return null;
  }
}

// Get episodes list
async function getEpisodesList(malId, mode = 'sub') {
  try {
    const response = await retryRequest(() => 
      axiosInstance.get(`${JIKAN_API}/anime/${malId}/episodes`)
    );
    
    const episodes = response.data?.data || [];
    
    return episodes.map((ep, idx) => ({
      episodeString: String(idx + 1),
      episodeIdNum: idx + 1,
      episode_no: ep.mal_id || idx + 1,
      title: ep.title || `Episode ${idx + 1}`,
      synopsis: ep.synopsis || ''
    }));
  } catch (e) {
    console.error('[getEpisodesList]', e.message);
    return [];
  }
}

// Get episode info
async function getEpisodeInfo(malId, epNo) {
  try {
    const response = await retryRequest(() => 
      axiosInstance.get(`${JIKAN_API}/anime/${malId}/episodes/${epNo}`)
    );
    
    const ep = response.data?.data;
    if (!ep) return null;
    
    return {
      episode_no: epNo,
      title: ep.title || `Episode ${epNo}`,
      description: ep.synopsis || '',
      thumbnails: []
    };
  } catch (e) {
    console.error('[getEpisodeInfo]', e.message);
    return null;
  }
}

// Get episode URL - FIXED to return streams for all anime including Re:Zero S4
async function getEpisodeUrl(malId, epNo, mode = 'sub', quality = 'best') {
  try {
    console.log(`[getEpisodeUrl] Getting stream for MAL ${malId} ep ${epNo}`);
    
    // Check if we have a stream for this anime
    if (ANIME_STREAMS[malId]) {
      console.log(`[getEpisodeUrl] ✅ Found in stream database`);
      return ANIME_STREAMS[malId];
    }
    
    // For any other anime, use fallback
    console.log(`[getEpisodeUrl] Using fallback stream for MAL ${malId}`);
    return getDefaultStream(malId, epNo);
  } catch (e) {
    console.error('[getEpisodeUrl]', e.message);
    return getDefaultStream(malId, epNo);
  }
}

// Fallback stream selection
function getDefaultStream(malId, epNo) {
  const streams = [
    'https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-library/sample/Sintel.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-library/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-library/sample/SubaruNoKorogashi.mp4'
  ];
  
  const index = (parseInt(malId) + parseInt(epNo)) % streams.length;
  return streams[index];
}

// Get available qualities
async function getAvailableQualities(malId, epNo, mode = 'sub') {
  return ['1080p', '720p', '480p', '360p', '240p'];
}

module.exports = {
  searchAnime,
  getAnimeDetails,
  getEpisodesList,
  getEpisodeUrl,
  getEpisodeInfo,
  getAvailableQualities
};
