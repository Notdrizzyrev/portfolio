import { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

export default function Navbar({ onSearch }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, logout, user } = useContext(AuthContext);

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchQuery);
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎌</span>
          <a href="/" className="text-white font-bold text-xl hover:text-purple-400">
            AniVault
          </a>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-8">
          <input
            type="text"
            placeholder="Search anime..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-l-lg border border-gray-700 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-r-lg transition"
          >
            🔍
          </button>
        </form>

        {/* Menu */}
        <div className="flex items-center gap-4">
          <a href="/" className="text-gray-300 hover:text-white text-sm hidden md:block">Home</a>
          <a href="/browse" className="text-gray-300 hover:text-white text-sm hidden md:block">Browse</a>
          
          {isAuthenticated && (
            <>
              <a href="/watchlist" className="text-gray-300 hover:text-white text-sm hidden md:block">Watchlist</a>
              <a href="/profile" className="text-gray-300 hover:text-white text-sm hidden md:block">Profile</a>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition"
              >
                Logout
              </button>
            </>
          )}

          {!isAuthenticated && (
            <a href="/portal" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition">
              Login
            </a>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-white text-xl"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-gray-800 border-t border-gray-700 p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-700 text-white rounded text-sm"
            />
            <button type="submit" className="text-purple-400">🔍</button>
          </form>
          <a href="/" className="block text-gray-300 hover:text-white text-sm py-2">Home</a>
          <a href="/browse" className="block text-gray-300 hover:text-white text-sm py-2">Browse</a>
          {isAuthenticated && (
            <>
              <a href="/watchlist" className="block text-gray-300 hover:text-white text-sm py-2">Watchlist</a>
              <a href="/profile" className="block text-gray-300 hover:text-white text-sm py-2">Profile</a>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
