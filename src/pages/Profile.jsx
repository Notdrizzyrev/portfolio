import { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Profile() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useContext(AuthContext);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/portal');
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-purple-900 to-gray-900 rounded-lg p-8 mb-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-purple-600 flex items-center justify-center">
              <span className="text-4xl">👤</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                {user?.username || 'User'}
              </h1>
              <p className="text-gray-300">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 rounded-lg p-6 text-center">
            <p className="text-3xl font-bold text-purple-400 mb-2">0</p>
            <p className="text-gray-400">Currently Watching</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-6 text-center">
            <p className="text-3xl font-bold text-purple-400 mb-2">0</p>
            <p className="text-gray-400">Completed</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-6 text-center">
            <p className="text-3xl font-bold text-purple-400 mb-2">0</p>
            <p className="text-gray-400">Episodes Watched</p>
          </div>
        </div>

        {/* Settings Section */}
        <div className="bg-gray-900 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Account Settings</h2>
          
          <div className="space-y-4">
            <button className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-left transition">
              📝 Edit Profile
            </button>
            <button className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-left transition">
              🔐 Change Password
            </button>
            <button className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-left transition">
              ⚙️ Preferences
            </button>
            <button
              onClick={handleLogout}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-left transition font-semibold"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
