import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchAnime } from '../hooks/useAnime';
import AnimeCard from '../components/common/AnimeCard';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function Browse() {
  const navigate = useNavigate();
  const { search, results, loading } = useSearchAnime();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');

  const genres = ['All', 'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Shounen', 'Sci-Fi', 'Supernatural'];

  useEffect(() => {
    if (selectedGenre === 'All') {
      search('a'); // Get all anime
    } else {
      search(selectedGenre);
    }
  }, [selectedGenre]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      search(searchQuery);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-bold text-white mb-6">Browse Anime</h1>
          
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Search by title..."
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
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-2 mb-8">
          {genres.map((genre) => (
            <button
              key={genre}
              onClick={() => {
                setSelectedGenre(genre);
                setSearchQuery('');
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                selectedGenre === genre
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <LoadingSpinner />
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {results.map((anime) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                onClick={() => navigate(`/anime/${anime.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No anime found. Try a different search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
