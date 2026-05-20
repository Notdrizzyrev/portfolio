export default function Footer() {
  const handleExternalLink = (url) => {
    window.open(url, '_blank');
  };

  return (
    <footer className="bg-gray-900 border-t border-gray-800 mt-12">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="text-white font-bold mb-4">About</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><button onClick={() => handleExternalLink('https://github.com/Notdrizzyrev/animevault-backend')} className="hover:text-white transition">About Us</button></li>
              <li><button onClick={() => handleExternalLink('https://github.com/Notdrizzyrev/animevault-backend')} className="hover:text-white transition">Blog</button></li>
              <li><button onClick={() => handleExternalLink('https://github.com/Notdrizzyrev/animevault-backend')} className="hover:text-white transition">Careers</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold mb-4">Support</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><button onClick={() => handleExternalLink('https://discord.gg/d9nZMQRtHw')} className="hover:text-white transition">Help Center</button></li>
              <li><button onClick={() => handleExternalLink('https://discord.gg/d9nZMQRtHw')} className="hover:text-white transition">Contact</button></li>
              <li><button onClick={() => handleExternalLink('https://github.com/Notdrizzyrev/animevault-backend')} className="hover:text-white transition">Status</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold mb-4">Legal</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><button onClick={() => handleExternalLink('https://github.com/Notdrizzyrev/animevault-backend')} className="hover:text-white transition">Privacy</button></li>
              <li><button onClick={() => handleExternalLink('https://github.com/Notdrizzyrev/animevault-backend')} className="hover:text-white transition">Terms</button></li>
              <li><button onClick={() => handleExternalLink('https://github.com/Notdrizzyrev/animevault-backend')} className="hover:text-white transition">DMCA</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold mb-4">Social</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><button onClick={() => handleExternalLink('https://twitter.com')} className="hover:text-white transition">Twitter</button></li>
              <li><button onClick={() => handleExternalLink('https://discord.gg/d9nZMQRtHw')} className="hover:text-white transition">Discord</button></li>
              <li><button onClick={() => handleExternalLink('https://github.com/Notdrizzyrev/animevault-backend')} className="hover:text-white transition">GitHub</button></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
          <p>&copy; 2026 AniVault. All rights reserved. Built with ❤️ for anime fans.</p>
        </div>
      </div>
    </footer>
  );
}
