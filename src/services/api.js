import axios from "axios";

export const PYTHON_API = (typeof window !== "undefined" && window.location.hostname === "localhost")
  ? "http://localhost:5000"
  : (import.meta.env.VITE_PYTHON_API || "https://animevault-backend-production.up.railway.app");

export const PYTHON_API_BACKUP = import.meta.env.VITE_PYTHON_API_BACKUP || "";

export const ALLANIME_API = import.meta.env.VITE_ALLANIME_API || "https://allanime-api.rk18109ry.workers.dev";

export const MIRURO_API = import.meta.env.VITE_MIRURO_API || "https://miruro-hono-worker.miruro-api.workers.dev";

export async function getMiruroStream(anilistId, episodeNumber = 1) {
  if (!anilistId) return null;
  try {
    const { data } = await axios.get(`${MIRURO_API}/watch`, {
      params: { id: anilistId, ep: episodeNumber },
      timeout: 15000,
    });
    return data;
  } catch (err) {
    console.error("[Miruro] Stream fetch failed:", err.message);
    return null;
  }
}

export const ANILIST_URL = `${PYTHON_API}/api/anilist/proxy`;
export const ANIXO_SERVER = PYTHON_API;
export const JIKAN_BASE_URL = import.meta.env.VITE_JIKAN_API || "https://api.jikan.moe/v4";

// --- ADVANCED HYBRID CACHE MANAGER ---
const CACHE_TTL = {
  GENRES: 1000 * 60 * 60 * 24 * 30,
  RECENT_DUBS: 1000 * 60 * 60 * 2,
  BROWSE: 1000 * 60 * 60 * 24,
  TRENDING: 1000 * 60 * 60 * 2,
  POPULAR: 1000 * 60 * 60 * 24,
  DETAILS: 1000 * 60 * 60 * 2,
  SCHEDULE: 1000 * 60 * 60 * 6,
};

const MemoryCache = new Map();

const cache = {
  get: (key) => {
    try {
      const cacheKey = `anivault_cache_${key}`;
      
      if (MemoryCache.has(cacheKey)) {
        const { value, expiry } = MemoryCache.get(cacheKey);
        if (new Date().getTime() < expiry) return value;
        MemoryCache.delete(cacheKey);
      }

      const item = localStorage.getItem(cacheKey);
      if (!item) return null;
      
      const { value, expiry } = JSON.parse(item);
      if (new Date().getTime() > expiry) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      MemoryCache.set(cacheKey, { value, expiry });
      return value;
    } catch { return null; }
  },
