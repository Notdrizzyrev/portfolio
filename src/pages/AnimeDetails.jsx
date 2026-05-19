import { useParams, useNavigate } from 'react-router-dom';
import { useContext, useEffect } from 'react';
import { useAnime } from '../hooks/useAnime';
import { AuthContext } from '../context/AuthContext';
import { watchlistAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function AnimeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { anime, loading, fetchAnimeDetails } = useAnime();
  const { isAuthenticated, token } = useContext(AuthContext);

  useEffect(() => {
    fetchAnimeDetails(id);
  }, [id]);

  const handleAddToWatchlist = async () => {
    if (!isAuthenticated) {
      navigate('/portal');
      return;
    }

    const result = await watchlistAPI.addToWatchlist(id, 'Watching', token);
    if (result.success) {
      alert('Added to watchlist!');
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!anime) return <div className="text-white text-center py-12">Anime not found</div>;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="relative h-80 bg-gradient-to-b from-gray-900 to-gray-950 overflow-hidden">
        <img
          src={anime.image}
          alt={anime.title}
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950 to-transparent flex items-end">
          <div className="max-w-7xl mx-auto px-4 py-12 flex gap-6 w-full">
            <img
              src={anime.image}
              alt={anime.title}
              className="h-64 rounded-lg shadow-lg"
            />
            <div className="flex-1 flex flex-col justify-end">
              <h1 className="text-5xl font-bold text-white mb-4">{anime.title}</h1>
              <div className="flex gap-4 mb-4">
                <span className="text-yellow-400 text-lg">⭐ {anime.score || 'N/A'}</span>
                <span className="text-gray-400">{anime.status}</span>
                <span className="text-gray-400">{anime.year}</span>
              </div>
              <p className="text-gray-400 mb-6">{anime.studio}</p>
              <div className="flex gap-3">
                <button
                  onClick={handleAddToWatchlist}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition"
                >
                  + Watchlist
                </button>
                <button
                  onClick={() => navigate(`/watch/${id}`)}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
                >
                  ▶ Watch Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2">
            <h2 className="text-2xl font-bold text-white mb-4">Description</h2>
            <p className="text-gray-300 leading-relaxed mb-8">{anime.description}</p>

            <h2 className="text-2xl font-bold text-white mb-4">Information</h2>
            <div className="bg-gray-900 rounded-lg p-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Episodes:</span>
                <span className="text-white font-semibold">{anime.episodes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className="text-white font-semibold">{anime.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Year:</span>
                <span className="text-white font-semibold">{anime.year}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Studio:</span>
                <span className="text-white font-semibold">{anime.studio}</span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Genres</h2>
            <div className="flex flex-wrap gap-2">
              {anime.genres?.map((genre, idx) => (
                <span key={idx} className="bg-purple-700 text-white px-3 py-1 rounded-full text-sm">
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
