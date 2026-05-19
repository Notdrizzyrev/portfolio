const BACKEND_URL = import.meta.env.VITE_PYTHON_API || 'http://localhost:5000';

// Anime Endpoints
export const animeAPI = {
  // Search anime
  search: async (query) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/anime/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Search failed');
      return await response.json();
    } catch (error) {
      console.error('Search error:', error);
      return { success: false, data: [] };
    }
  },

  // Get anime details
  getDetails: async (id) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/anime/${id}`);
      if (!response.ok) throw new Error('Fetch failed');
      return await response.json();
    } catch (error) {
      console.error('Details error:', error);
      return { success: false, data: null };
    }
  },

  // Get trending anime
  getTrending: async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/anime/trending`);
      if (!response.ok) throw new Error('Fetch failed');
      return await response.json();
    } catch (error) {
      console.error('Trending error:', error);
      return { success: false, data: [] };
    }
  },

  // Get anime by genre
  getByGenre: async (genre) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/anime/genre/${genre}`);
      if (!response.ok) throw new Error('Fetch failed');
      return await response.json();
    } catch (error) {
      console.error('Genre error:', error);
      return { success: false, data: [] };
    }
  }
};

// User/Auth Endpoints
export const authAPI = {
  // Register
  register: async (userData) => {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      return await response.json();
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, message: 'Registration failed' };
    }
  },

  // Login
  login: async (credentials) => {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      return await response.json();
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Login failed' };
    }
  }
};

// Watchlist Endpoints
export const watchlistAPI = {
  // Get user's watchlist
  getWatchlist: async (token) => {
    try {
      const response = await fetch(`${BACKEND_URL}/watchlist`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Fetch failed');
      return await response.json();
    } catch (error) {
      console.error('Watchlist error:', error);
      return { success: false, data: [] };
    }
  },

  // Add to watchlist
  addToWatchlist: async (animeId, status, token) => {
    try {
      const response = await fetch(`${BACKEND_URL}/watchlist/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ animeId, status })
      });
      return await response.json();
    } catch (error) {
      console.error('Add to watchlist error:', error);
      return { success: false, message: 'Failed to add to watchlist' };
    }
  },

  // Remove from watchlist
  removeFromWatchlist: async (animeId, token) => {
    try {
      const response = await fetch(`${BACKEND_URL}/watchlist/${animeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await response.json();
    } catch (error) {
      console.error('Remove from watchlist error:', error);
      return { success: false, message: 'Failed to remove from watchlist' };
    }
  }
};

// Progress Endpoints
export const progressAPI = {
  // Get progress for anime
  getProgress: async (animeId, token) => {
    try {
      const response = await fetch(`${BACKEND_URL}/progress/${animeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Fetch failed');
      return await response.json();
    } catch (error) {
      console.error('Progress error:', error);
      return { success: false, data: null };
    }
  },

  // Update progress
  updateProgress: async (animeId, episodeWatched, token) => {
    try {
      const response = await fetch(`${BACKEND_URL}/progress/${animeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ episodeWatched })
      });
      return await response.json();
    } catch (error) {
      console.error('Update progress error:', error);
      return { success: false, message: 'Failed to update progress' };
    }
  }
};

// Check backend health
export const healthCheck = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (!response.ok) throw new Error('Health check failed');
    return await response.json();
  } catch (error) {
    console.error('Health check error:', error);
    return { status: 'error', service: 'unavailable' };
  }
};