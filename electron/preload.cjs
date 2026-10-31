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
  startDiscordGiveawayBot: (token) => ipcRenderer.invoke('start-discord-gw-bot', token),
  openDiscordWindow: (token) => ipcRenderer.invoke('open-discord-window', token),
  stopDiscordGiveawayBot: () => ipcRenderer.invoke('stop-discord-gw-bot'),
  setDiscordBotFlags: (flags) => ipcRenderer.invoke('set-discord-bot-flags', flags),
  discordGwStatus: () => ipcRenderer.invoke('discord-gw-status'),
  onDiscordGwLog: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('discord-gw-log', handler)
    return () => ipcRenderer.removeListener('discord-gw-log', handler)
  },
  backendCall: (opts) => ipcRenderer.invoke('backend-call', opts),

  // ── Auto-updater ────────────────────────────────────────────────────────────
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  downloadAndInstallUpdate: () => ipcRenderer.invoke('download-and-install-update'),
  onUpdateProgress: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('update-progress', handler)
    return () => ipcRenderer.removeListener('update-progress', handler)
  },
})
