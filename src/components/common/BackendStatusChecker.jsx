import { useEffect, useState } from 'react';

export default function BackendStatusChecker() {
  const [bothDown, setBothDown] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkBackends = async () => {
      try {
        const primaryBackend = import.meta.env.VITE_PYTHON_API || 'https://animevault-backend-production.up.railway.app';
        let primaryUp = false;
        let supabaseUp = false;

        // Check primary backend with timeout
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const res1 = await fetch(`${primaryBackend}/health`, { 
            method: 'GET',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          primaryUp = res1.ok;
        } catch (e) {
          primaryUp = false;
        }

        // Check Supabase (just try to fetch - if it responds, it's up)
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const res2 = await fetch('https://zpgryifvnzujooaekfdu.supabase.co/rest/v1/', { 
            method: 'GET',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          supabaseUp = true; // If we get any response, it's up
        } catch (e) {
          supabaseUp = false;
        }

        // If both are down, show error
        setBothDown(!primaryUp && !supabaseUp);
      } catch (error) {
        console.log('Status check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkBackends();
    // Check every 30 seconds
    const interval = setInterval(checkBackends, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;

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
