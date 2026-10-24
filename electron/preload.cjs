const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  verifySession: (token) => ipcRenderer.invoke('verify-session', token)
})
