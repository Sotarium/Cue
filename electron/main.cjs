const { app, BrowserWindow, ipcMain, session } = require('electron')
const path = require('path')
const https = require('https')

// Ensure single instance to prevent duplicate processes or flashing
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

function verifyRollbuxSession(token) {
  return new Promise((resolve) => {
    if (!token || typeof token !== 'string' || token.trim().length < 5) {
      return resolve({ success: false, error: 'Enter a valid authjs.session-token.' })
    }

    const trimmed = token.trim()
    const options = {
      hostname: 'rollbux.com',
      port: 443,
      path: '/_api/users/me',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://rollbux.com',
        'Referer': 'https://rollbux.com/',
        'Cookie': `authjs.session-token=${trimmed}`,
        'Authorization': `Bearer ${trimmed}`
      }
    }

    const req = https.request(options, (res) => {
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const user = parsed.data?.user || parsed.data || parsed.user || parsed
            resolve({
              success: true,
              user: {
                username: user.username || user.name || 'Player',
                level: user.level !== undefined ? user.level : (user.tier || 1),
                token_balance: user.token_balance || 0,
                avatar: user.avatar_url || user.avatar || null,
                raw: user
              }
            })
          } else {
            resolve({
              success: false,
              statusCode: res.statusCode,
              error: parsed.message || parsed.error || `Authentication failed (${res.statusCode})`
            })
          }
        } catch (err) {
          if (res.statusCode === 401) {
            resolve({ success: false, error: 'Authentication required: Invalid session token' })
          } else {
            resolve({ success: false, error: `Invalid response from server (${res.statusCode})` })
          }
        }
      })
    })

    req.on('error', (e) => {
      resolve({ success: false, error: `Connection failed: ${e.message}` })
    })

    req.setTimeout(12000, () => {
      req.destroy()
      resolve({ success: false, error: 'Request timed out connecting to rollbux.com' })
    })

    req.end()
  })
}

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#121418',
    show: false, // Don't show until rendered to avoid flashes
    autoHideMenuBar: true,
    title: 'Sotarium',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Show only when ready to avoid flashing or opening/closing appearances
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.once('did-finish-load', async () => {
    if (process.env.SOTARIUM_SMOKE === '1') {
      const bodyText = await mainWindow.webContents.executeJavaScript('document.body.innerText')
      console.log(bodyText.includes('Sotarium') ? 'SOTARIUM_SMOKE_OK' : bodyText.slice(0, 200))
      app.quit()
    }
  })

  mainWindow.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
    if (process.env.SOTARIUM_SMOKE === '1') console.error(`SOTARIUM_SMOKE_FAIL ${errorCode} ${errorDescription}`)
  })

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  ipcMain.handle('verify-session', async (_event, token) => {
    return await verifyRollbuxSession(token)
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
