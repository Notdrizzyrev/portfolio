import { useTrendingAnime } from '../hooks/useAnime';
import { useNavigate } from 'react-router-dom';
import AnimeCard from '../components/common/AnimeCard';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function Schedule() {
  const navigate = useNavigate();
  const { animeList, loading } = useTrendingAnime();

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Group anime by day (for demo, distribute randomly)
  const scheduleByDay = {};
  days.forEach(day => {
    scheduleByDay[day] = [];
  });

  animeList.forEach((anime, idx) => {
    const dayIdx = idx % 7;
    scheduleByDay[days[dayIdx]].push(anime);
  });

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-white mb-2">Anime Schedule</h1>
        <p className="text-gray-400 mb-8">Upcoming anime releases this week</p>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-8">
            {days.map((day) => (
              <div key={day}>
                <h2 className="text-2xl font-bold text-white mb-4 pb-2 border-b border-gray-800">
                  {day}
                </h2>
                
                {scheduleByDay[day].length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {scheduleByDay[day].map((anime) => (
                      <AnimeCard
                        key={anime.id}
                        anime={anime}
                        onClick={() => navigate(`/anime/${anime.id}`)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 py-4">No releases scheduled</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
