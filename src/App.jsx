import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import BackendStatusChecker from './components/common/BackendStatusChecker';

// Pages
import Home from './pages/Home';
import Browse from './pages/Browse';
import AnimeDetails from './pages/AnimeDetails';
import Watch from './pages/Watch';
import Watchlist from './pages/Watchlist';
import Profile from './pages/Profile';
import Schedule from './pages/Schedule';

// Auth Pages (simple placeholders)
function Portal() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-white mb-6">Login / Register</h1>
        
        <div className="bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded-lg p-4 mb-6">
          <p className="text-yellow-400 text-sm font-semibold">
            ⚠️ Database Coming Soon
          </p>
          <p className="text-yellow-300 text-xs mt-2">
            We don't have a database yet. User accounts are coming soon! For now, you can browse and explore all anime.
          </p>
        </div>

        <div className="space-y-3">
          <input 
            type="email" 
            placeholder="Email" 
            className="w-full px-4 py-2 bg-gray-800 text-white rounded disabled:opacity-50" 
            disabled 
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="w-full px-4 py-2 bg-gray-800 text-white rounded disabled:opacity-50" 
            disabled 
          />
          <button 
            className="w-full bg-gray-700 text-gray-400 py-2 rounded font-semibold cursor-not-allowed"
            disabled
          >
            Login (Coming Soon)
          </button>
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-semibold transition"
        >
          Back Home
        </button>

        <p className="text-gray-400 text-center text-xs mt-4">
          Join our <a href="https://discord.gg/d9nZMQRtHw" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">Discord</a> for updates!
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const isPortalPage = location.pathname === '/portal';

  return (
    <div className="flex flex-col min-h-screen">
      <BackendStatusChecker />
      
      {!isPortalPage && <Navbar onSearch={() => {}} />}
      
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/anime/:id" element={<AnimeDetails />} />
          <Route path="/watch/:id" element={<Watch />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/portal" element={<Portal />} />
        </Routes>
      </main>

      {!isPortalPage && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}
