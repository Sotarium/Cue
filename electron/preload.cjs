const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  verifySession: (token) => ipcRenderer.invoke('verify-session', token),
  rollbuxRequest: (options) => ipcRenderer.invoke('rollbux-request', options),
  fetchLevel: (token) => ipcRenderer.invoke('fetch-level', token),
  fetchBalance: (token) => ipcRenderer.invoke('fetch-balance', token),
  backendCall: (opts) => ipcRenderer.invoke('backend-call', opts),
})
