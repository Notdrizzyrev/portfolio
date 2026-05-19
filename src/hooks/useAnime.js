import { useState, useEffect, useCallback } from 'react';
import { animeAPI } from '../services/api';

export const useAnime = () => {
  const [anime, setAnime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnimeDetails = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const result = await animeAPI.getDetails(id);
      if (result.success) {
        setAnime(result.data);
      } else {
        setError('Failed to fetch anime');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { anime, loading, error, fetchAnimeDetails };
};

export const useTrendingAnime = () => {
  const [animeList, setAnimeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const result = await animeAPI.getTrending();
        if (result.success) {
          setAnimeList(result.data);
        } else {
          setError('Failed to fetch trending anime');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, []);

  return { animeList, loading, error };
};

export const useSearchAnime = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = useCallback(async (query) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await animeAPI.search(query);
      if (result.success) {
        setResults(result.data);
      } else {
        setError('Search failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search };
};
