import { useEffect, useState } from 'react';

export default function BackendStatusChecker() {
  const [bothDown, setBothDown] = useState(false);

  useEffect(() => {
    const checkBackends = async () => {
      try {
        const primaryBackend = import.meta.env.VITE_PYTHON_API || 'https://animevault-backend-production.up.railway.app';
        let primaryUp = false;
        let supabaseUp = false;

        // Check primary backend
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const res1 = await fetch(`${primaryBackend}/health`, { 
            method: 'GET',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          primaryUp = res1.ok;
        } catch (e) {
          primaryUp = false;
        }

        // Check Supabase
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          await fetch('https://zpgryifvnzujooaekfdu.supabase.co/rest/v1/health', { 
            method: 'GET',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          supabaseUp = true;
        } catch (e) {
          supabaseUp = false;
        }

        // Only show error if BOTH are down
        const bothAreDown = !primaryUp && !supabaseUp;
        setBothDown(bothAreDown);
      } catch (error) {
        console.log('Status check error:', error);
      }
    };

    // Check after 10 seconds (give servers time to respond)
    const initialTimer = setTimeout(checkBackends, 10000);
    
    // Then check every 60 seconds
    const interval = setInterval(checkBackends, 60000);
    
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  if (bothDown) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center z-50">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-4">⚠️</h1>
          <p className="text-2xl font-bold text-white mb-2">
            Servers are down. We are fixing them.
          </p>
          <p className="text-gray-400 mt-4">Please check back soon...</p>
        </div>
      </div>
    );
  }

  return null;
}
