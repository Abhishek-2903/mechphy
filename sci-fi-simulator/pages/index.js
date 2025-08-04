// pages/index.js
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function HomePage() {
  const router = useRouter();

  // Debug function to check if we're in Electron
  useEffect(() => {
    console.log('Current location:', window.location.href);
    console.log('Is Electron?', typeof window !== 'undefined' && window.process?.type === 'renderer');
  }, []);

  const go = (path) => {
    console.log('Navigating to:', path);
    
    // For Electron static export, use the full path
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      // In Electron, use the actual file path
      router.push(path).catch(err => {
        console.error('Navigation error:', err);
        // Fallback: try without trailing slash
        router.push(path.replace(/\/$/, '')).catch(err2 => {
          console.error('Fallback navigation also failed:', err2);
        });
      });
    } else {
      // Normal web navigation
      router.push(path);
    }
  };

  return (
    <div className="container">
      <div className="overlay" />
      <div className="content">
        <h1>Instrumented Battle Training System</h1>

        <div className="buttons">
          <button 
            className="btn" 
            onClick={() => go('/terrain')}
          >
            New Exercise
          </button>

          <button 
            className="btn" 
            onClick={() => go('/aar')}
          >
            View Previous Exercise
          </button>

          <button 
            className="btn" 
            onClick={() => go('/adddetails')}
          >
            Add Entity to Database
          </button>

          {/* Debug button - remove in production */}
          <button 
            className="btn" 
            onClick={() => {
              console.log('Router object:', router);
              console.log('Current pathname:', router.pathname);
              console.log('Window location:', window.location);
            }}
            style={{ backgroundColor: '#ff6b6b', fontSize: '12px' }}
          >
            DEBUG INFO
          </button>
        </div>
      </div>

      <div className="footer">
        © 2024 Mechphy Defense Systems. All rights reserved.
      </div>
      <div className="version">v2.5.7</div>
    </div>
  );
}