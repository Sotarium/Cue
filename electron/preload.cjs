const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  verifySession: (token) => ipcRenderer.invoke('verify-session', token),
  rollbuxRequest: (options) => ipcRenderer.invoke('rollbux-request', options),
  fetchLevel: (token) => ipcRenderer.invoke('fetch-level', token),
  fetchBalance: (token) => ipcRenderer.invoke('fetch-balance', token),
  solveTurnstile: (token) => ipcRenderer.invoke('solve-turnstile', token),
  startRainBot: (token) => ipcRenderer.invoke('start-rain-bot', token),
  stopRainBot: () => ipcRenderer.invoke('stop-rain-bot'),
  rainBotStatus: () => ipcRenderer.invoke('rain-bot-status'),
  discordGetUser: (token) => ipcRenderer.invoke('discord-get-user', token),
  backendCall: (opts) => ipcRenderer.invoke('backend-call', opts),
})
