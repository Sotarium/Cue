const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const https = require('https')

// Ensure single instance to prevent duplicate processes or flashing
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

function makeRollbuxRequest({ path: apiPath, method = 'GET', body = null, token = '' }) {
  return new Promise((resolve) => {
    const trimmed = (token || '').trim()
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Origin': 'https://rollbux.com',
      'Referer': 'https://rollbux.com/',
    }

    if (trimmed) {
      headers['Cookie'] = `authjs.session-token=${trimmed}`
      headers['Authorization'] = `Bearer ${trimmed}`
    }

    let payloadString = ''
    if (body) {
      payloadString = typeof body === 'string' ? body : JSON.stringify(body)
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(payloadString)
    }

    const options = {
      hostname: 'rollbux.com',
      port: 443,
      path: apiPath.startsWith('/') ? apiPath : `/${apiPath}`,
      method: method.toUpperCase(),
      headers
    }

    const req = https.request(options, (res) => {
      let rawData = ''
      res.on('data', (chunk) => { rawData += chunk })
      res.on('end', () => {
        let json = null
        try { json = JSON.parse(rawData) } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          data: json,
          text: rawData
        })
      })
    })

    req.on('error', (e) => {
      resolve({ statusCode: 500, ok: false, error: e.message })
    })

    req.setTimeout(15000, () => {
      req.destroy()
      resolve({ statusCode: 408, ok: false, error: 'Request timeout' })
    })

    if (payloadString) {
      req.write(payloadString)
    }
    req.end()
  })
}

function verifyRollbuxSession(token) {
  return new Promise((resolve) => {
    if (!token || typeof token !== 'string' || token.trim().length < 5) {
      return resolve({ success: false, error: 'Enter a valid authjs.session-token.' })
    }

    makeRollbuxRequest({ path: '/_api/users/me', method: 'GET', token }).then((res) => {
      if (res.ok && res.data) {
        const user = res.data.data?.user || res.data.data || res.data.user || res.data
        let playerLevel = 1
        if (typeof user.level === 'object' && user.level !== null && user.level.currentLevel !== undefined) {
          playerLevel = user.level.currentLevel
        } else if (typeof user.level === 'number') {
          playerLevel = user.level
        } else if (user.tier !== undefined) {
          playerLevel = user.tier
        }
        resolve({
          success: true,
          user: {
            username: user.username || user.name || 'Player',
            level: playerLevel,
            token_balance: user.token_balance || 0,
            avatar: user.avatar_url || user.avatar || null,
            raw: user
          }
        })
      } else {
        const err = res.data?.message || res.data?.error || `Authentication failed (${res.statusCode})`
        resolve({
          success: false,
          statusCode: res.statusCode,
          error: res.statusCode === 401 ? 'Authentication required: Invalid session token' : err
        })
      }
    })
  })
}

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#242424',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a1a',
      symbolColor: '#ffffff',
      height: 32
    },
    show: false,
    autoHideMenuBar: true,
    title: 'Sotarium',
    icon: path.join(__dirname, '..', 'build', 'sotarium-icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

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

  ipcMain.handle('rollbux-request', async (_event, options) => {
    return await makeRollbuxRequest(options)
  })

  // Fetch live player level directly from /_api/users/me: "level":{"currentLevel":38}
  ipcMain.handle('fetch-level', async (_event, token) => {
    return new Promise((resolve) => {
      const trimmed = (token || '').trim()
      makeRollbuxRequest({ path: '/_api/users/me', method: 'GET', token: trimmed }).then(apiRes => {
        if (apiRes.ok && apiRes.data) {
          const u = apiRes.data.data?.user || apiRes.data.data || apiRes.data.user || apiRes.data
          let lvl = null
          if (u?.level && typeof u.level === 'object' && u.level.currentLevel !== undefined) {
            lvl = u.level.currentLevel
          } else if (typeof u?.level === 'number') {
            lvl = u.level
          } else if (u?.xp_level !== undefined) {
            lvl = u.xp_level
          } else if (u?.tier !== undefined) {
            lvl = u.tier
          }

          if (lvl !== null && !isNaN(parseInt(lvl, 10))) {
            return resolve({ ok: true, level: parseInt(lvl, 10), badge: lvl })
          }
        }
        resolve({ ok: false, level: null })
      }).catch(() => resolve({ ok: false, level: null }))
    })
  })


  // Proxy call to Rollbux Vercel backend (rollbux-one.vercel.app)
  ipcMain.handle('backend-call', async (_event, { endpoint, method = 'POST', body = null }) => {
    return new Promise((resolve) => {
      const payload = body ? JSON.stringify(body) : null
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'https://rollbux.com',
        'Referer': 'https://rollbux.com/',
      }
      if (payload) headers['Content-Length'] = Buffer.byteLength(payload)

      const options = {
        hostname: 'rollbux.vercel.app',
        port: 443,
        path: endpoint.startsWith('/') ? endpoint : `/${endpoint}`,
        method: method.toUpperCase(),
        headers
      }

      const req = https.request(options, (res) => {
        let raw = ''
        res.on('data', (chunk) => { raw += chunk })
        res.on('end', () => {
          let data = null
          try { data = JSON.parse(raw) } catch (e) {}
          resolve({ statusCode: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data, text: raw })
        })
      })
      req.on('error', (e) => resolve({ statusCode: 500, ok: false, error: e.message }))
      req.setTimeout(20000, () => { req.destroy(); resolve({ statusCode: 408, ok: false, error: 'Timeout' }) })
      if (payload) req.write(payload)
      req.end()
    })
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
