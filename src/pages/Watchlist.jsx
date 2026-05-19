import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { watchlistAPI } from '../services/api';
import AnimeCard from '../components/common/AnimeCard';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function Watchlist() {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useContext(AuthContext);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('Watching');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/portal');
      return;
    }

    fetchWatchlist();
  }, [isAuthenticated]);

  const fetchWatchlist = async () => {
    setLoading(true);
    const result = await watchlistAPI.getWatchlist(token);
    if (result.success) {
      setWatchlist(result.data || []);
    }
    setLoading(false);
  };

  const handleRemove = async (animeId) => {
    if (window.confirm('Remove from watchlist?')) {
      await watchlistAPI.removeFromWatchlist(animeId, token);
      fetchWatchlist();
    }
  };

  const statuses = ['Watching', 'Planned', 'Completed', 'Dropped'];
  const filteredWatchlist = watchlist.filter(item => item.status === selectedStatus);

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-white mb-8">My Watchlist</h1>

        {/* Filter Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-800">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`pb-4 font-semibold transition ${
                selectedStatus === status
                  ? 'border-b-2 border-purple-600 text-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <LoadingSpinner />
        ) : filteredWatchlist.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {filteredWatchlist.map((item) => (
              <div key={item.id} className="relative">
                <AnimeCard
                  anime={item}
                  onClick={() => navigate(`/anime/${item.id}`)}
                />
                <button
                  onClick={() => handleRemove(item.id)}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg mb-4">No anime in {selectedStatus.toLowerCase()}</p>
            <button
              onClick={() => navigate('/browse')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition"
            >
              Browse Anime
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
