const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { URL } = require('url');

const isDev = !app.isPackaged;

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      // Add preload script for better integration
      preload: path.join(__dirname, 'preload.js') // Optional: create this file for better integration
    },
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    console.log('Loading development server...');
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    console.log('Loading production build...');
    
    // For production, load the static export
    const indexPath = path.join(__dirname, 'out', 'index.html');
    console.log('Looking for index.html at:', indexPath);
    
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
      console.log('Found index.html, loading...');
      mainWindow.loadFile(indexPath);
    } else {
      console.error('index.html not found at:', indexPath);
      
      // Try alternative paths
      const altPaths = [
        path.join(__dirname, '..', 'out', 'index.html'),
        path.join(__dirname, 'dist', 'index.html'),
        path.join(process.resourcesPath, 'out', 'index.html')
      ];
      
      let loaded = false;
      for (const altPath of altPaths) {
        console.log('Trying alternative path:', altPath);
        if (fs.existsSync(altPath)) {
          mainWindow.loadFile(altPath);
          loaded = true;
          break;
        }
      }
      
      if (!loaded) {
        console.error('Could not find index.html in any expected location');
        console.log('Available files in current directory:', fs.readdirSync(__dirname));
        if (fs.existsSync(path.join(__dirname, 'out'))) {
          console.log('Files in out directory:', fs.readdirSync(path.join(__dirname, 'out')));
        }
      }
    }
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Remove menu bar (optional)
  // Menu.setApplicationMenu(null);

  // CRITICAL: Handle navigation for Next.js routing in Electron
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    console.log('Navigation attempt to:', navigationUrl);
    
    try {
      const parsedUrl = new URL(navigationUrl);
      
      if (isDev) {
        // In development, allow localhost navigation
        if (parsedUrl.origin === 'http://localhost:3000') {
          console.log('Allowing navigation to localhost');
          return;
        }
      } else {
        // In production, handle file:// protocol navigation
        if (parsedUrl.protocol === 'file:') {
          console.log('File protocol navigation detected');
          
          // Extract the path from the file URL
          const filePath = parsedUrl.pathname;
          const fileName = path.basename(filePath);
          
          // Allow navigation to HTML files in the out directory
          if (fileName.endsWith('.html') || filePath.includes('/out/')) {
            console.log('Allowing file:// navigation within app to:', filePath);
            return;
          }
          
          // For Next.js routing without .html extension, try to find the corresponding file
          const outDir = path.join(__dirname, 'out');
          let targetPath = filePath;
          
          // Handle trailing slash routes
          if (targetPath.endsWith('/')) {
            targetPath = path.join(targetPath, 'index.html');
          } else if (!targetPath.endsWith('.html')) {
            // Try both with and without .html extension
            const htmlPath = targetPath + '.html';
            const indexPath = path.join(targetPath, 'index.html');
            
            if (fs.existsSync(path.join(outDir, htmlPath.replace(/^\//, '')))) {
              console.log('Found HTML file, allowing navigation');
              return;
            } else if (fs.existsSync(path.join(outDir, indexPath.replace(/^\//, '')))) {
              console.log('Found index HTML file, allowing navigation');
              return;
            }
          }
          
          console.log('Allowing file navigation (will handle missing files later)');
          return;
        }
      }
    } catch (error) {
      console.error('Error parsing navigation URL:', error);
    }
    
    // Block external navigation
    console.log('Blocking external navigation to:', navigationUrl);
    event.preventDefault();
  });

  // Handle failed navigation by redirecting to existing files
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', validatedURL, 'Error:', errorDescription, 'Code:', errorCode);
    
    if (!isDev && errorCode === -6) { // FILE_NOT_FOUND
      console.log('File not found, attempting to fix path...');
      
      try {
        const parsedUrl = new URL(validatedURL);
        if (parsedUrl.protocol === 'file:') {
          let pathToTry = parsedUrl.pathname;
          
          // Remove leading slash for Windows compatibility
          if (process.platform === 'win32' && pathToTry.startsWith('/')) {
            pathToTry = pathToTry.substring(1);
          }
          
          const outDir = path.join(__dirname, 'out');
          
          // Try different path variations
          const pathVariations = [
            path.join(outDir, pathToTry, 'index.html'),
            path.join(outDir, pathToTry + '.html'),
            path.join(outDir, pathToTry.replace(/\/$/, '') + '.html'),
            path.join(outDir, pathToTry.replace(/\/$/, ''), 'index.html')
          ];
          
          for (const variation of pathVariations) {
            if (fs.existsSync(variation)) {
              console.log('Found alternative file:', variation);
              mainWindow.loadFile(variation);
              return;
            }
          }
          
          // If no variation found, go back to home
          console.log('No alternative found, returning to home');
          mainWindow.loadFile(path.join(outDir, 'index.html'));
        }
      } catch (error) {
        console.error('Error handling failed load:', error);
      }
    }
  });

  // Log successful navigation
  mainWindow.webContents.on('did-navigate', (event, url) => {
    console.log('Successfully navigated to:', url);
  });

  // Enhanced logging when page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading');
    
    // Inject debugging and navigation helpers
    mainWindow.webContents.executeJavaScript(`
      console.log('Electron app loaded successfully');
      console.log('Current location:', window.location.href);
      
      // Make Electron context available to renderer
      window.electronAPI = {
        isElectron: true,
        version: '${process.versions.electron}',
        platform: '${process.platform}'
      };
      
      // Custom navigation handler for Electron
      window.electronNavigate = function(path) {
        console.log('Electron navigate called with:', path);
        
        // Construct the full file path
        const basePath = window.location.href.replace(/\/[^\/]*$/, '');
        let fullPath;
        
        if (path.startsWith('/')) {
          // Absolute path
          const outIndex = basePath.indexOf('/out/');
          if (outIndex !== -1) {
            const outBasePath = basePath.substring(0, outIndex + 5);
            fullPath = outBasePath + path.substring(1);
          } else {
            fullPath = basePath + path.substring(1);
          }
        } else {
          // Relative path
          fullPath = basePath + '/' + path;
        }
        
        // Add trailing slash and index.html if needed
        if (!fullPath.endsWith('.html')) {
          if (fullPath.endsWith('/')) {
            fullPath += 'index.html';
          } else {
            fullPath += '/index.html';
          }
        }
        
        console.log('Navigating to full path:', fullPath);
        window.location.href = fullPath;
      };
      
      // Override history methods for better routing
      const originalPushState = history.pushState;
      history.pushState = function(state, title, url) {
        console.log('pushState called with:', url);
        
        if (typeof url === 'string' && !url.startsWith('http') && !url.startsWith('file:')) {
          // Use our custom navigation for relative URLs
          window.electronNavigate(url);
          return;
        }
        
        return originalPushState.call(this, state, title, url);
      };
      
      // Listen for popstate events
      window.addEventListener('popstate', (event) => {
        console.log('popstate event:', event.state, window.location.pathname);
      });
      
      // Log any JavaScript errors
      window.addEventListener('error', (e) => {
        console.error('JavaScript error:', e.error);
      });
      
      window.addEventListener('unhandledrejection', (e) => {
        console.error('Unhandled promise rejection:', e.reason);
      });
    `);
  });
}

// App ready
app.whenReady().then(() => {
  console.log('Electron app is ready');
  console.log('App version:', app.getVersion());
  console.log('Electron version:', process.versions.electron);
  console.log('Platform:', process.platform);
  console.log('Is packaged:', app.isPackaged);
  createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (navigationEvent, navigationURL) => {
    console.log('Blocked new window creation to:', navigationURL);
    navigationEvent.preventDefault();
  });
  
  // Also handle the newer 'window-open' event
  contents.setWindowOpenHandler(({ url }) => {
    console.log('Blocked window open to:', url);
    return { action: 'deny' };
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});