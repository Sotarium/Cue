function extractLevelFromPayload(rawText, data) {
  if (rawText) {
    // 1. Direct regex on raw content for current_level or currentLevel
    const match = rawText.match(/"current_level"\s*:\s*(\d+)/i) ||
                  rawText.match(/"currentLevel"\s*:\s*(\d+)/i) ||
                  rawText.match(/"level"\s*:\s*(\d+)/i)
    if (match && match[1]) {
      const lvl = parseInt(match[1], 10)
      if (!isNaN(lvl) && lvl > 0) return lvl
    }
  }

  if (data) {
    const u = data.data?.user || data.data || data.user || data
    if (u?.current_level !== undefined && !isNaN(parseInt(u.current_level, 10))) return parseInt(u.current_level, 10)
    if (u?.level && typeof u.level === 'object') {
      if (u.level.current_level !== undefined) return parseInt(u.level.current_level, 10)
      if (u.level.currentLevel !== undefined) return parseInt(u.level.currentLevel, 10)
    }
    if (typeof u?.level === 'number') return u.level
    if (u?.tier !== undefined) return parseInt(u.tier, 10)
  }

  return 1
}

const { app, BrowserWindow, ipcMain, session } = require('electron')
const path = require('path')
const https = require('https')

// Ensure single instance to prevent duplicate processes or flashing
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

// ─── Cloudflare Clearance Cache ──────────────────────────────────────────────
// Stores cf_clearance cookie value + expiry so we don't open a hidden window
// on every single request — only when the cookie expires or a 403 is received.
let cfClearanceCache = { value: '', expires: 0 }

function isTurnstileResponse(statusCode, bodyText) {
  return [403, 429, 503].includes(statusCode) &&
    /cloudflare|turnstile|challenge|captcha|cf-chl/i.test(bodyText || '')
}

/**
 * Opens a hidden BrowserWindow on rollbux.com with the user's session token
 * already injected as a cookie. Cloudflare fingerprints the real Chromium
 * engine and auto-passes the Turnstile challenge, issuing a cf_clearance cookie.
 * We extract that cookie, cache it, and close the hidden window.
 */
async function solveTurnstileWithHiddenWindow(sessionToken) {
  return new Promise((resolve) => {
    console.log('[CF] Opening hidden window to solve Turnstile...')

    const hiddenSes = session.fromPartition('persist:rollbux-session', { cache: true })

    // Pre-inject the user's session cookie so Cloudflare sees an authenticated session
    hiddenSes.cookies.set({
      url: 'https://rollbux.com',
      name: 'authjs.session-token',
      value: sessionToken.trim(),
      domain: '.rollbux.com',
      httpOnly: true,
      secure: true,
      sameSite: 'lax'
    }).catch(() => {})

    const win = new BrowserWindow({
      width: 400,
      height: 600,
      show: false,          // Completely hidden
      skipTaskbar: true,
      webPreferences: {
        session: hiddenSes,
        nodeIntegration: false,
        contextIsolation: true,
        // Real browser fingerprint — no sandbox spoofing
      }
    })

    let resolved = false
    const finish = (clearance) => {
      if (resolved) return
      resolved = true
      try { win.destroy() } catch (e) {}
      resolve(clearance)
    }

    // Timeout after 20s — if CF doesn't clear in time, give up gracefully
    const timeout = setTimeout(() => {
      console.log('[CF] Turnstile solve timeout — proceeding without cf_clearance')
      finish(null)
    }, 20000)

    // Poll cookies every 500ms looking for cf_clearance
    const pollInterval = setInterval(async () => {
      try {
        const cookies = await hiddenSes.cookies.get({ url: 'https://rollbux.com' })
        const cf = cookies.find(c => c.name === 'cf_clearance')
        if (cf && cf.value) {
          clearTimeout(timeout)
          clearInterval(pollInterval)
          console.log('[CF] cf_clearance obtained!')
          // Cache for ~29 minutes (CF clearance lasts 30min by default)
          cfClearanceCache = { value: cf.value, expires: Date.now() + 29 * 60 * 1000 }
          finish(cf.value)
        }
      } catch (e) {}
    }, 500)

    win.on('closed', () => {
      clearTimeout(timeout)
      clearInterval(pollInterval)
      if (!resolved) finish(null)
    })

    // Navigate to rollbux.com — Cloudflare will fingerprint and auto-solve
    win.loadURL('https://rollbux.com', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }).catch(() => finish(null))
  })
}

/**
 * Returns a valid cf_clearance value — from cache if still fresh,
 * or by opening a hidden BrowserWindow to solve a new one.
 */
async function getCfClearance(sessionToken) {
  if (cfClearanceCache.value && Date.now() < cfClearanceCache.expires) {
    return cfClearanceCache.value
  }
  return await solveTurnstileWithHiddenWindow(sessionToken)
}

// ─── Core Request Function ────────────────────────────────────────────────────

function makeRollbuxRequestRaw({ path: apiPath, method = 'GET', body = null, token = '', cfClearance = '' }) {
  return new Promise((resolve) => {
    const trimmed = (token || '').trim()
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://rollbux.com',
      'Referer': 'https://rollbux.com/',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    }

    // Build cookie string
    const cookieParts = []
    if (trimmed) cookieParts.push(`authjs.session-token=${trimmed}`)
    if (cfClearance) cookieParts.push(`cf_clearance=${cfClearance}`)
    if (cookieParts.length) headers['Cookie'] = cookieParts.join('; ')
    if (trimmed) headers['Authorization'] = `Bearer ${trimmed}`

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

    if (payloadString) req.write(payloadString)
    req.end()
  })
}

/**
 * Smart wrapper: makes the request, and if Cloudflare blocks it (403/Turnstile),
 * automatically opens a hidden window to get cf_clearance and retries once.
 */
async function makeRollbuxRequest({ path: apiPath, method = 'GET', body = null, token = '' }) {
  // First attempt — use cached cf_clearance if available
  const cachedCf = (cfClearanceCache.value && Date.now() < cfClearanceCache.expires)
    ? cfClearanceCache.value : ''

  const res = await makeRollbuxRequestRaw({ path: apiPath, method, body, token, cfClearance: cachedCf })

  // If blocked by Cloudflare/Turnstile, solve and retry
  if (isTurnstileResponse(res.statusCode, res.text)) {
    console.log(`[CF] Turnstile detected on ${apiPath} (HTTP ${res.statusCode}) — solving...`)
    const newCf = token ? await getCfClearance(token) : null
    if (newCf) {
      return await makeRollbuxRequestRaw({ path: apiPath, method, body, token, cfClearance: newCf })
    }
  }

  return res
}

function verifyRollbuxSession(token) {
  return new Promise((resolve) => {
    if (!token || typeof token !== 'string' || token.trim().length < 5) {
      return resolve({ success: false, error: 'Enter a valid authjs.session-token.' })
    }

    makeRollbuxRequest({ path: '/_api/users/me', method: 'GET', token }).then(async (res) => {
      if (res.ok && res.data) {
        const user = res.data.data?.user || res.data.data || res.data.user || res.data
        let playerLevel = extractLevelFromPayload(res.text, res.data)
        let liveBalance = user.token_balance || 0

        try {
          const balRes = await makeRollbuxRequest({ path: '/_api/users/me/balance', method: 'GET', token })
          if (balRes.ok && balRes.data) {
            const b = balRes.data.data?.token_balance ?? balRes.data.token_balance
            if (typeof b === 'number') liveBalance = b
          }
        } catch (e) {}

        resolve({
          success: true,
          user: {
            username: user.username || user.name || 'Player',
            level: playerLevel,
            token_balance: liveBalance,
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

// ─── Auto-Rain Bot Script ─────────────────────────────────────────────────────
// Injected directly into rollbux.com pages — same as Tampermonkey but native
const AUTO_RAIN_SCRIPT = `
(function () {
  if (window.__sotariumAutoRainRunning) return;
  window.__sotariumAutoRainRunning = true;

  console.log('[Sotarium] Browser session active. Monitoring for rain events...');

  let lastClicked = 0;
  const COOLDOWN_MS = 10000;

  function findJoinRainButton() {
    // Avoid clicking anything if a challenge modal is visible
    if (document.querySelector('iframe[src*="cloudflare"], iframe[src*="challenges"], .cf-turnstile, [class*="turnstile"]')) {
      return null;
    }

    const buttons = document.querySelectorAll('button, a, div[role="button"], [class*="button"]');
    for (const btn of buttons) {
      if (btn.closest('#rollbux-autorain-hud')) continue;
      const text = (btn.innerText || btn.textContent || '').toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      const aria  = (btn.getAttribute('aria-label') || '').toLowerCase();
      const combined = text + ' ' + title + ' ' + aria;
      if (combined.includes('join') && combined.includes('rain')) return btn;
    }
    return null;
  }

  function checkRain() {
    const now = Date.now();
    if (now - lastClicked < COOLDOWN_MS) return;
    const btn = findJoinRainButton();
    if (btn) {
      console.log('[Sotarium] Found Join Rain button.');
      btn.click();
      lastClicked = now;
      btn.style.outline = '3px solid #acff46';
      setTimeout(() => { if (btn) btn.style.outline = ''; }, 1500);
    }
  }

  // Moderate check interval to prevent anti-bot DOM tripwires
  setInterval(checkRain, 2000);
})();
`

// ─── Rain Bot Window ──────────────────────────────────────────────────────────
let rainBotWindow = null

async function injectAutoRainScript(webContents) {
  try {
    await webContents.executeJavaScript(AUTO_RAIN_SCRIPT)
  } catch (e) {
    console.log('[RainBot] Script injection skipped:', e.message)
  }
}

async function startRainBot(sessionToken) {
  if (rainBotWindow && !rainBotWindow.isDestroyed()) {
    console.log('[RainBot] Already running')
    return { ok: true, status: 'already_running' }
  }

  const trimmed = (sessionToken || '').trim()
  if (!trimmed) return { ok: false, error: 'No session token' }

  const botSes = session.fromPartition('persist:rollbux-session', { cache: true })

  // Inject the session cookie
  await botSes.cookies.set({
    url: 'https://rollbux.com',
    name: 'authjs.session-token',
    value: trimmed,
    domain: '.rollbux.com',
    httpOnly: true,
    secure: true,
    sameSite: 'lax'
  })

  // If we have a fresh cf_clearance, inject it too
  if (cfClearanceCache.value && Date.now() < cfClearanceCache.expires) {
    await botSes.cookies.set({
      url: 'https://rollbux.com',
      name: 'cf_clearance',
      value: cfClearanceCache.value,
      domain: '.rollbux.com',
      secure: true,
      sameSite: 'none'
    }).catch(() => {})
  }

  rainBotWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    show: true,           // Visible for testing
    skipTaskbar: false,
    title: 'Sotarium — Rain Bot',
    webPreferences: {
      session: botSes,
      nodeIntegration: false,
      contextIsolation: true,
    }
  })

  const wc = rainBotWindow.webContents

  // Inject script after every navigation (SPA re-routes too)
  wc.on('did-finish-load', async () => {
    const url = wc.getURL()
    if (url.includes('rollbux.com')) {
      console.log('[RainBot] Page loaded:', url)
      await injectAutoRainScript(wc)
      // Poll cookies for cf_clearance and update cache
      const cookies = await botSes.cookies.get({ url: 'https://rollbux.com' })
      const cf = cookies.find(c => c.name === 'cf_clearance')
      if (cf && cf.value) {
        cfClearanceCache = { value: cf.value, expires: Date.now() + 29 * 60 * 1000 }
      }
    }
  })

  // Also handle SPA navigation without full reload
  wc.on('did-navigate-in-page', async () => {
    await injectAutoRainScript(wc)
  })

  wc.on('did-fail-load', (_e, code, desc, url) => {
    console.log('[RainBot] Load failed:', code, desc, url)
    // Retry after 5s if it's a network error
    if (code !== -3) setTimeout(() => { if (rainBotWindow && !rainBotWindow.isDestroyed()) wc.reload() }, 5000)
  })

  rainBotWindow.on('closed', () => { rainBotWindow = null })

  rainBotWindow.loadURL('https://rollbux.com', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })

  console.log('[RainBot] Started — running silently on rollbux.com')
  return { ok: true, status: 'started' }
}

function stopRainBot() {
  if (rainBotWindow && !rainBotWindow.isDestroyed()) {
    rainBotWindow.destroy()
    rainBotWindow = null
    console.log('[RainBot] Stopped')
    return { ok: true, status: 'stopped' }
  }
  return { ok: true, status: 'not_running' }
}

function getRainBotStatus() {
  return {
    running: !!(rainBotWindow && !rainBotWindow.isDestroyed()),
    url: (rainBotWindow && !rainBotWindow.isDestroyed()) ? rainBotWindow.webContents.getURL() : null
  }
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

  // Fetch live player level directly from raw /_api/users/me: "current_level":38
  ipcMain.handle('fetch-level', async (_event, token) => {
    return new Promise((resolve) => {
      const trimmed = (token || '').trim()
      makeRollbuxRequest({ path: '/_api/users/me', method: 'GET', token: trimmed }).then(apiRes => {
        if (apiRes.ok) {
          const lvl = extractLevelFromPayload(apiRes.text, apiRes.data)
          if (lvl && lvl > 0) {
            return resolve({ ok: true, level: lvl, badge: lvl })
          }
        }
        resolve({ ok: false, level: null })
      }).catch(() => resolve({ ok: false, level: null }))
    })
  })

  // Fetch live token balance directly from Rollbux /_api/users/me/balance and /_api/users/me
  ipcMain.handle('fetch-balance', async (_event, token) => {
    return new Promise((resolve) => {
      const trimmed = (token || '').trim()
      makeRollbuxRequest({ path: '/_api/users/me/balance', method: 'GET', token: trimmed }).then(async (apiRes) => {
        if (apiRes.ok && apiRes.data) {
          const b = apiRes.data.data?.token_balance ?? apiRes.data.token_balance
          if (typeof b === 'number') {
            return resolve({ ok: true, token_balance: b })
          }
        }
        // Fallback to /_api/users/me
        const meRes = await makeRollbuxRequest({ path: '/_api/users/me', method: 'GET', token: trimmed })
        if (meRes.ok && meRes.data) {
          const u = meRes.data.data?.user || meRes.data.data || meRes.data.user || meRes.data
          const b = u?.token_balance
          if (typeof b === 'number') {
            return resolve({ ok: true, token_balance: b })
          }
        }
        resolve({ ok: false, token_balance: null })
      }).catch(() => resolve({ ok: false, token_balance: null }))
    })
  })

  // ─── Discord IPC Handlers ───────────────────────────────────────────────────
  ipcMain.handle('discord-get-user', async (_event, token) => {
    return new Promise((resolve) => {
      if (!token || typeof token !== 'string' || token.trim().length < 10) {
        return resolve({ ok: false, error: 'Invalid Discord token' })
      }
      const trimmed = token.trim()
      const options = {
        hostname: 'discord.com',
        port: 443,
        path: '/api/v10/users/@me',
        method: 'GET',
        headers: {
          'Authorization': trimmed,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }

      const req = https.request(options, (res) => {
        let raw = ''
        res.on('data', chunk => { raw += chunk })
        res.on('end', () => {
          try {
            const data = JSON.parse(raw)
            if (res.statusCode >= 200 && res.statusCode < 300 && data.id) {
              resolve({
                ok: true,
                user: {
                  id: data.id,
                  username: data.username,
                  global_name: data.global_name || data.username,
                  avatar: data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=128` : null,
                  discriminator: data.discriminator,
                  accent_color: data.accent_color
                }
              })
            } else {
              resolve({ ok: false, error: data.message || `HTTP ${res.statusCode}` })
            }
          } catch (e) {
            resolve({ ok: false, error: 'Invalid response from Discord' })
          }
        })
      })

      req.on('error', e => resolve({ ok: false, error: e.message }))
      req.setTimeout(12000, () => { req.destroy(); resolve({ ok: false, error: 'Discord request timeout' }) })
      req.end()
    })
  })

  // ─── Rain Bot IPC Handlers ───────────────────────────────────────────────────
  ipcMain.handle('start-rain-bot', async (_event, token) => {
    return await startRainBot(token)
  })

  ipcMain.handle('stop-rain-bot', async () => {
    return stopRainBot()
  })

  ipcMain.handle('rain-bot-status', async () => {
    return getRainBotStatus()
  })

  // Manually trigger Turnstile solve (e.g. called from renderer when a 403 is detected)
  ipcMain.handle('solve-turnstile', async (_event, token) => {
    try {
      const cf = await getCfClearance((token || '').trim())
      return { ok: !!cf, cf_clearance: cf }
    } catch (e) {
      return { ok: false, error: e.message }
    }
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

  // Auto-start Rain Bot when app opens (uses stored session token)
  setTimeout(async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        const token = await mainWindow.webContents.executeJavaScript(
          'window.localStorage.getItem("sotarium_session_token") || ""'
        )
        if (token && token.length > 5) {
          console.log('[RainBot] Auto-starting with stored session token...')
          await startRainBot(token)
        } else {
          console.log('[RainBot] No stored token yet — bot will start after login')
        }
      } catch (e) {
        console.log('[RainBot] Auto-start deferred:', e.message)
      }
    }
  }, 3000)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
