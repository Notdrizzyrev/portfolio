import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
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
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-white mb-6">Login / Register</h1>
        <input type="email" placeholder="Email" className="w-full mb-4 px-4 py-2 bg-gray-800 text-white rounded" />
        <input type="password" placeholder="Password" className="w-full mb-6 px-4 py-2 bg-gray-800 text-white rounded" />
        <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-semibold transition">
          Login
        </button>
        <p className="text-gray-400 text-center mt-4">Don't have an account? <a href="#" className="text-purple-400">Sign up</a></p>
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
