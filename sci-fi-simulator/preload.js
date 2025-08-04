// preload.js (optional - place in root directory)
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  version: process.versions.electron,
  platform: process.platform,
  
  // Navigation helper
  navigate: (path) => {
    console.log('Preload navigate called with:', path);
    // You can add custom navigation logic here
    // For now, we'll use the injected method from electron.js
    return path;
  },
  
  // System info
  getSystemInfo: () => ({
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome
  }),
  
  // File system helpers (if needed)
  // Note: Be very careful with file system access for security
  
  // IPC communication (if you need it later)
  // invoke: (channel, data) => {
  //   const validChannels = ['navigate', 'get-files', 'save-data'];
  //   if (validChannels.includes(channel)) {
  //     return ipcRenderer.invoke(channel, data);
  //   }
  // },
  
  // on: (channel, func) => {
  //   const validChannels = ['navigation-complete', 'file-loaded'];
  //   if (validChannels.includes(channel)) {
  //     ipcRenderer.on(channel, (event, ...args) => func(...args));
  //   }
  // }
});

// Global error handler
window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload script loaded successfully');
  console.log('Electron version:', process.versions.electron);
});