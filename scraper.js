const axios = require('axios');

const JIKAN_API = 'https://api.jikan.moe/v4';
const ALLANIME_BASE = 'allanime.day';
const ALLANIME_API = `https://api.${ALLANIME_BASE}`;

// Timeout and headers
const axiosInstance = axios.create({
  timeout: 8000,
  maxRedirects: 3,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

// ── SEARCH ANIME (using Jikan) ────────────────────────────────────────────
async function searchAnime(query) {
  try {
    if (!query || query.trim().length === 0) return [];
    
    const { data } = await axiosInstance.get(`${JIKAN_API}/anime`, {
      params: {
        query: query.trim(),
        limit: 15,
        type: 'tv,movie,special'
      }
    });

    const results = [];
    if (data?.data && Array.isArray(data.data)) {
      for (const item of data.data) {
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
    }
    return results;
  } catch (e) {
    console.error('[searchAnime]', e.message);
    return [];
  }
}

// ── GET ANIME DETAILS ─────────────────────────────────────────────────────
async function getAnimeDetails(malId) {
  try {
    if (!malId) return null;
    
    const { data } = await axiosInstance.get(`${JIKAN_API}/anime/${malId}`);
    
    if (!data?.data) return null;
    
    const anime = data.data;
    return {
      id: String(anime.mal_id),
      title: anime.title || anime.title_english || 'Unknown',
      title_english: anime.title_english || anime.title || 'Unknown',
      thumbnail_url: anime.images?.jpg?.image_url || '',
      synopsis: anime.synopsis || '',
      status: anime.status || 'Unknown',
      episodes_sub: anime.episodes || 0,
      episodes_dub: 0, // Jikan doesn't track dub info
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

// ── GET EPISODES LIST ─────────────────────────────────────────────────────
async function getEpisodesList(malId, mode = 'sub') {
  try {
    const { data } = await axiosInstance.get(`${JIKAN_API}/anime/${malId}/episodes`);
    
    if (!data?.data || !Array.isArray(data.data)) return [];
    
    return data.data.map((ep, idx) => ({
      episodeString: String(ep.mal_id || idx + 1),
      episodeIdNum: idx + 1,
      title: ep.title || `Episode ${idx + 1}`
    }));
  } catch (e) {
    console.error('[getEpisodesList]', e.message);
    return [];
  }
}

// ── GET EPISODE INFO ──────────────────────────────────────────────────────
async function getEpisodeInfo(malId, epNo) {
  try {
    const { data } = await axiosInstance.get(`${JIKAN_API}/anime/${malId}/episodes/${epNo}`);
    
    if (!data?.data) return null;
    
    const ep = data.data;
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

// ── GET EPISODE URL (placeholder) ─────────────────────────────────────────
// For now, returns null since Jikan doesn't provide streaming links
async function getEpisodeUrl(malId, epNo, mode = 'sub', quality = 'best') {
  try {
    // Jikan API doesn't provide streaming links
    // This would need integration with AllAnime or another source
    console.warn('[getEpisodeUrl] Streaming integration not available via Jikan API');
    return null;
  } catch (e) {
    console.error('[getEpisodeUrl]', e.message);
    return null;
  }
}

// ── GET AVAILABLE QUALITIES ──────────────────────────────────────────────
async function getAvailableQualities(malId, epNo, mode = 'sub') {
  try {
    // Jikan doesn't provide quality info
    return ['720p', '480p', '360p']; // Default fallback
  } catch (e) {
    console.error('[getAvailableQualities]', e.message);
    return [];
  }
}

// ── EXPORTS ──────────────────────────────────────────────────────────────
module.exports = {
  searchAnime,
  getAnimeDetails,
  getEpisodesList,
  getEpisodeUrl,
  getEpisodeInfo,
  getAvailableQualities
};
