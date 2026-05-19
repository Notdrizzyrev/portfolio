import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrendingAnime, useSearchAnime } from '../hooks/useAnime';
import AnimeCard from '../components/common/AnimeCard';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function Home() {
  const navigate = useNavigate();
  const { animeList, loading } = useTrendingAnime();
  const { search, results: searchResults } = useSearchAnime();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      search(searchQuery);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero Section */}
      <section className="relative h-96 bg-gradient-to-r from-purple-900 via-gray-900 to-black overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml,...')]"></div>
        <div className="relative max-w-7xl mx-auto px-4 h-full flex flex-col justify-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Discover Your Next Anime
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl">
            Stream thousands of anime, explore trending shows, and build your watchlist
          </p>
          
          <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
            <input
              type="text"
              placeholder="Search anime..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Trending Section */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold text-white mb-8">Trending Now</h2>
        
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {animeList.map((anime) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                onClick={() => navigate(`/anime/${anime.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-12 border-t border-gray-800">
          <h2 className="text-3xl font-bold text-white mb-8">Search Results</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {searchResults.map((anime) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                onClick={() => navigate(`/anime/${anime.id}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
