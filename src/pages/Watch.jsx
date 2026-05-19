import { useParams, useNavigate } from 'react-router-dom';
import { useContext, useState, useEffect } from 'react';
import { useAnime } from '../hooks/useAnime';
import { AuthContext } from '../context/AuthContext';
import { progressAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function Watch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { anime, loading, fetchAnimeDetails } = useAnime();
  const { isAuthenticated, token } = useContext(AuthContext);
  const [currentEpisode, setCurrentEpisode] = useState(1);

  useEffect(() => {
    fetchAnimeDetails(id);
  }, [id]);

  const handleEpisodeChange = async (episode) => {
    setCurrentEpisode(episode);
    
    if (isAuthenticated) {
      await progressAPI.updateProgress(id, episode, token);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!anime) return <div className="text-white text-center py-12">Anime not found</div>;

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/anime/${id}`)}
          className="mb-6 text-purple-400 hover:text-purple-300 flex items-center gap-2"
        >
          ← Back
        </button>

        {/* Video Player */}
        <div className="bg-black rounded-lg overflow-hidden mb-8">
          <div className="aspect-video bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">▶</div>
              <p className="text-white text-lg">Episode {currentEpisode}</p>
              <p className="text-gray-400 mt-2">Video player would load here</p>
            </div>
          </div>
        </div>

        {/* Episode List */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-6">{anime.title}</h2>
          <p className="text-gray-400 mb-6">Select an episode to watch</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: anime.episodes || 12 }).map((_, idx) => (
              <button
                key={idx + 1}
                onClick={() => handleEpisodeChange(idx + 1)}
                className={`py-3 rounded-lg font-semibold transition ${
                  currentEpisode === idx + 1
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Ep {idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="bg-gray-900 rounded-lg p-6 mt-8">
          <h3 className="text-xl font-bold text-white mb-4">About</h3>
          <p className="text-gray-300">{anime.description}</p>
        </div>
      </div>
    </div>
  );
}
