const axios = require('axios');

const AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
const ALLANIME_API = `https://api.allanime.day`;

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

async function searchAnime(query) {
  try {
    console.log('[SEARCH] Starting search for:', query);
    
    const variables = JSON.stringify({ search: { allowAdult: false, query, limit: 15 } });
    const url = `${ALLANIME_API}/api?variables=${encodeURIComponent(variables)}&query=query%20%28%24search%3A%20SearchInput%29%20%7B%20search%28search%3A%20%24search%29%20%7B%20edges%20%7B%20_id%20name%20englishName%20thumbnail%20description%20status%20%7D%20%7D%20%7D`;
    
    console.log('[SEARCH] URL:', url.substring(0, 100) + '...');
    
    const response = await axiosInstance.get(url);
    console.log('[SEARCH] Status:', response.status);
    console.log('[SEARCH] Response keys:', Object.keys(response.data));
    
    const data = response.data;
    console.log('[SEARCH] data.data exists:', !!data?.data);
    console.log('[SEARCH] data.data.search exists:', !!data?.data?.search);
    console.log('[SEARCH] edges:', JSON.stringify(data?.data?.search?.edges).substring(0, 200));
    
    const edges = data?.data?.search?.edges || [];
    console.log('[SEARCH] Found', edges.length, 'results');
    
    const results = edges.map(item => ({
      id: item._id,
      title: item.englishName || item.name,
    }));
    
    console.log('[SEARCH] Returning results:', results.length);
    return results;
    
  } catch (error) {
    console.error('[SEARCH] ERROR:', error.message);
    console.error('[SEARCH] Status:', error.response?.status);
    console.error('[SEARCH] Data:', JSON.stringify(error.response?.data).substring(0, 500));
    return [];
  }
}

async function getAnimeDetails(showId) { return null; }
async function getEpisodesList() { return []; }
async function getEpisodeUrl() { return null; }
async function getEpisodeInfo() { return null; }
async function getAvailableQualities() { return []; }

module.exports = { searchAnime, getAnimeDetails, getEpisodesList, getEpisodeUrl, getEpisodeInfo, getAvailableQualities };
