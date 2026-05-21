import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const [backendStatus, setBackendStatus] = useState(null);

  const checkStatus = async () => {
    try {
      const res = await fetch('https://animevault-backend-production.up.railway.app/health');
      const data = await res.json();
      setBackendStatus(data.status === 'ok' ? '✅ Backend Online' : '❌ Backend Offline');
    } catch (e) {
      setBackendStatus('❌ Backend Offline');
    }
  };

  const handleLink = (type) => {
    if (type === 'about') {
      navigate('/');
    } else if (type === 'status') {
      checkStatus();
      setModal('status');
    } else if (type === 'discord') {
      window.open('https://discord.gg/d9nZMQRtHw', '_blank');
    } else {
      setModal(type);
    }
  };

  const closeModal = () => setModal(null);

  return (
    <>
      <footer className="bg-gray-900 border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold mb-4">About Us</h3>
              <ul className="space-y-2">
                <li><button onClick={() => handleLink('about')} className="text-gray-400 hover:text-white transition text-sm">About Us</button></li>
                <li><button onClick={() => handleLink('status')} className="text-gray-400 hover:text-white transition text-sm">Status</button></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-bold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><button onClick={() => handleLink('privacy')} className="text-gray-400 hover:text-white transition text-sm">Privacy</button></li>
                <li><button onClick={() => handleLink('terms')} className="text-gray-400 hover:text-white transition text-sm">Terms</button></li>
                <li><button onClick={() => handleLink('dmca')} className="text-gray-400 hover:text-white transition text-sm">DMCA</button></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-bold mb-4">Community</h3>
              <ul className="space-y-2">
                <li><button onClick={() => handleLink('discord')} className="text-purple-400 hover:text-purple-300 transition text-sm font-semibold">Join Discord</button></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2026 AniVault. All rights reserved. Built with ❤️ for anime fans.</p>
          </div>
        </div>
      </footer>

      {/* Status Modal */}
      {modal === 'status' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-800">
            <h2 className="text-2xl font-bold text-white mb-4">System Status</h2>
            <div className="bg-gray-800 p-4 rounded mb-4">
              <p className="text-white text-lg">{backendStatus || 'Checking...'}</p>
            </div>
            <button onClick={closeModal} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-semibold">Close</button>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {modal === 'privacy' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-800 max-h-96 overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Privacy Policy</h2>
            <p className="text-gray-300 text-sm mb-4">
              We respect your privacy. AniVault does not collect personal data without your consent. We use cookies only for essential functionality. Your watch history is stored locally on your device unless you create an account.
            </p>
            <button onClick={closeModal} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-semibold">Close</button>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {modal === 'terms' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-800 max-h-96 overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Terms of Service</h2>
            <p className="text-gray-300 text-sm mb-4">
              By using AniVault, you agree to our terms. You must be 13+ to use this service. Content is provided for educational purposes only. Unauthorized copying or distribution is prohibited. We reserve the right to modify or discontinue service at any time.
            </p>
            <button onClick={closeModal} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-semibold">Close</button>
          </div>
        </div>
      )}

      {/* DMCA Modal */}
      {modal === 'dmca' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-800 max-h-96 overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">DMCA Notice</h2>
            <p className="text-gray-300 text-sm mb-4">
              AniVault respects intellectual property rights. If you believe content violates copyright, please contact us through our Discord community. We will promptly investigate and remove infringing content upon verification.
            </p>
            <button onClick={closeModal} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-semibold">Close</button>
          </div>
        </div>
      )}
    </>
  );
}