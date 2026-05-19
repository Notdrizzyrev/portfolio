export default function AnimeCard({ anime, onClick }) {
  return (
    <div 
      onClick={onClick}
      className="bg-gray-900 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-105"
    >
      <div className="relative overflow-hidden bg-gray-800 h-64">
        <img 
          src={anime.image} 
          alt={anime.title}
          className="w-full h-full object-cover"
          onError={(e) => e.target.src = 'https://via.placeholder.com/250x350?text=No+Image'}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end">
          <div className="p-4 w-full">
            <p className="text-yellow-400 text-sm font-semibold">⭐ {anime.score || 'N/A'}</p>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="text-white font-bold text-sm line-clamp-2 mb-2">{anime.title}</h3>
        <div className="flex flex-wrap gap-1 mb-2">
          {anime.genres?.slice(0, 2).map((genre, idx) => (
            <span key={idx} className="bg-purple-700 text-white text-xs px-2 py-1 rounded">
              {genre}
            </span>
          ))}
        </div>
        <p className="text-gray-400 text-xs">{anime.episodes} episodes</p>
      </div>
    </div>
  );
}
