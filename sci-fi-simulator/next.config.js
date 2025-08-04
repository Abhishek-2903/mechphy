// next.config.js
const { WS_CONFIG } = require('./config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  //--------------------------------------------------
  //  ⚙️  Core export + Electron settings
  //--------------------------------------------------
  output: 'export',          // static export (next build produces /out)
  
  // FIXED: For Electron, we need trailing slash OR proper exportPathMap
  trailingSlash: true,       // CHANGED: Enable trailing slashes for static export
  skipTrailingSlashRedirect: false, // CHANGED: Allow redirects for proper routing
  
  assetPrefix: process.env.ELECTRON ? './' : '',  // IMPROVED: Only use relative paths in Electron
  images: { unoptimized: true },

  // Configure export directory
  distDir: '.next',          // Keep default for build
  
  // ADDED: Explicit export path mapping for better Electron compatibility
  exportPathMap: async function (defaultPathMap, { dev, dir, outDir, distDir, buildId }) {
    if (process.env.ELECTRON) {
      return {
        '/': { page: '/' },
        '/terrain': { page: '/terrain' },
        '/aar': { page: '/aar' },
        '/adddetails': { page: '/adddetails' },
        // Add other routes as needed
      };
    }
    return defaultPathMap;
  },

  //--------------------------------------------------
  //  🔌  Dev-time API proxies (ignored in export)
  //--------------------------------------------------
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        { source: '/api/:path*',     destination: 'http://localhost:8000/api/:path*' },
        { source: '/aar-api/:path*', destination: 'http://localhost:8001/api/:path*' },
      ];
    }
    return [];
  },

  //--------------------------------------------------
  //  🛠  Webpack tweak for Electron
  //--------------------------------------------------
  webpack(config, { isServer }) {
    config.experiments = { 
      ...config.experiments, 
      asyncWebAssembly: true, 
      layers: true 
    };
    
    // IMPROVED: Better Electron target handling
    if (!isServer) {
      if (process.env.ELECTRON) {
        config.target = 'electron-renderer';
        // Fix for Electron file:// protocol
        config.output.publicPath = './';
      } else {
        config.target = 'web';
      }
    }
    
    // ADDED: Handle node modules for Electron
    if (process.env.ELECTRON && !isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'electron': 'commonjs electron'
      });
    }
    
    return config;
  },

  //--------------------------------------------------
  //  🚫  Headers: only applied during `next dev`
  //--------------------------------------------------
  async headers() {
    if (process.env.NODE_ENV !== 'production') {
      const httpBaseUrl = WS_CONFIG.BASE_URL.replace('ws://', 'http://') + ':3000';
      const sockets = [
        'ws://192.168.1.18:8001/ws',
        'ws://192.168.1.18:8002/ws',
        'ws://192.168.1.18:8003/ws',
        'ws://192.168.1.18:8765/ws',
        'ws://192.168.1.18:8766/ws',
        'ws://192.168.1.18:8767/ws',
      ].join(' ');
      const apis = [
        'http://192.168.1.18:8000',
        'http://localhost:8000',
        'http://localhost:8001',
      ].join(' ');

      return [{
        source: '/(.*)',
        headers: [{
          key: 'Content-Security-Policy',
          value: `
            default-src 'self';
            script-src 'self' 'unsafe-eval' 'unsafe-inline';
            style-src 'self' 'unsafe-inline';
            img-src 'self' data: blob: ${httpBaseUrl};
            font-src 'self';
            connect-src 'self' ${httpBaseUrl} ${sockets} ${apis};
          `.replace(/\s+/g, ' ').trim(),
        }],
      }];
    }
    return [];
  },

  //--------------------------------------------------
  //  🌐  Env vars bundled into JS
  //--------------------------------------------------
  env: {
    WS_BASE_URL:     WS_CONFIG.BASE_URL,
    HTTP_BASE_URL:   WS_CONFIG.HTTP_BASE_URL,
    RTM_SOLDIER_PORT: WS_CONFIG.RTM_PORTS.SOLDIER_DATA.toString(),
    RTM_KILL_FEED_PORT: WS_CONFIG.RTM_PORTS.KILL_FEED.toString(),
    RTM_STATS_PORT:     WS_CONFIG.RTM_PORTS.STATS.toString(),
    AAR_SOLDIER_PORT: WS_CONFIG.AAR_PORTS.SOLDIER_DATA.toString(),
    AAR_KILL_FEED_PORT: WS_CONFIG.AAR_PORTS.KILL_FEED.toString(),
    AAR_STATS_PORT:     WS_CONFIG.AAR_PORTS.STATS.toString(),
    REPLAY_INIT_PORT:   WS_CONFIG.API_PORTS.REPLAY_INIT.toString(),
  },
};

module.exports = nextConfig;