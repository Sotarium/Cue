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

const { app, BrowserWindow, ipcMain, session, shell } = require('electron')
const path = require('path')
const https = require('https')
const fs = require('fs')
const os = require('os')
const { spawn } = require('child_process')
const WebSocket = require('ws')

// Disable Chromium internal network services that trigger Windows Firewall prompts
app.commandLine.appendSwitch('disable-features', 'MediaRouter,DialMediaRouteProvider,WebRtcHideLocalIpsWithMdns,CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-device-discovery-notifications')
app.commandLine.appendSwitch('disable-background-networking')
app.commandLine.appendSwitch('disable-component-update')
app.commandLine.appendSwitch('disable-domain-reliability')
app.commandLine.appendSwitch('disable-sync')
app.commandLine.appendSwitch('no-default-browser-check')

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
            avatar: user.avatar_url || user.avatar || user.profile_image || user.profile_picture || user.image_url || user.image || user.picture || null,
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
    show: false,
    skipTaskbar: true,
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
    if (!rainBotWindow || rainBotWindow.isDestroyed() || wc.isDestroyed()) return
    const url = wc.getURL()
    if (url.includes('rollbux.com')) {
      console.log('[RainBot] Page loaded:', url)
      await injectAutoRainScript(wc)
      // Poll cookies for cf_clearance and update cache
      if (rainBotWindow && !rainBotWindow.isDestroyed()) {
        const cookies = await botSes.cookies.get({ url: 'https://rollbux.com' })
        const cf = cookies.find(c => c.name === 'cf_clearance')
        if (cf && cf.value) {
          cfClearanceCache = { value: cf.value, expires: Date.now() + 29 * 60 * 1000 }
        }
      }
    }
  })

  // Also handle SPA navigation without full reload
  wc.on('did-navigate-in-page', async () => {
    if (!rainBotWindow || rainBotWindow.isDestroyed() || wc.isDestroyed()) return
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

// ─── Discord Giveaway Bot (WebSocket + REST) ────────────────────────────────
const GUILD_ID      = '1454106247056982130'
const GW_CHANNEL_ID = '1564378251575562300'
const TKT_PANEL_ID  = '1564093343904825537'

let discordGwActive    = false
let discordClaimActive = false
let discordGwUsername  = 'sotarium'
let rollbuxUsername    = 'sotarium'
let _lastWonGwMessageLink = ''

let _gwSocket       = null  // WebSocket
let _gwGuildId      = '1454106247056982130'
let _gwToken        = ''
let _gwSessionId    = null
let _gwHeartbeatInt = null
let _gwUserId       = null
let _gwResumeUrl    = null
let _gwSeq          = null
// Track messages we already reacted to
const _joinedGiveaways = new Set()
// Claim flow state
let _claimState = 'idle'   // idle | waiting_ticket_msg | claiming_done

function sendDiscordGwLog(message, type = 'info') {
  console.log(`[DiscordGW] ${message}`)
  const allowedExact = ['Successfully Joined', 'Giveaway won', 'Auto Claimed']
  if (!allowedExact.includes(message)) {
    return
  }
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('discord-gw-log', { message, type, time: new Date().toLocaleTimeString() })
  }
}

// ── REST helpers ────────────────────────────────────────────────────────────
function discordRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const opts = {
      hostname: 'discord.com',
      path: `/api/v10${endpoint}`,
      method,
      headers: {
        'Authorization': _gwToken,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'X-Super-Properties': Buffer.from(JSON.stringify({
          os: 'Windows', browser: 'Chrome', device: '', browser_version: '120.0.0.0'
        })).toString('base64')
      }
    }
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data)
    const req = https.request(opts, res => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null }) }
        catch { resolve({ status: res.statusCode, body: raw }) }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

// PUT /channels/{ch}/messages/{msg}/reactions/{emoji}/@me
async function putReaction(channelId, messageId, emoji) {
  const enc = encodeURIComponent(emoji)
  const r = await discordRequest('PUT', `/channels/${channelId}/messages/${messageId}/reactions/${enc}/@me`)
  return r.status === 204
}

// POST /channels/{ch}/messages  → send a message
async function sendMessage(channelId, content) {
  const r = await discordRequest('POST', `/channels/${channelId}/messages`, { content })
  return { ok: r.status === 200 || r.status === 201, status: r.status, body: r.body }
}

// POST /channels/{ch}/messages with buffer attachments (multipart/form-data)
async function sendMessageWithBufferAttachments(channelId, content, items = []) {
  try {
    const fd = new FormData()
    if (content) {
      fd.append('payload_json', JSON.stringify({ content }))
    }
    items.forEach((item, index) => {
      if (item && item.buffer) {
        fd.append(`files[${index}]`, new Blob([item.buffer], { type: 'image/png' }), item.name || `image_${index}.png`)
      }
    })

    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': _gwToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      },
      body: fd
    })

    const body = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, body }
  } catch (err) {
    return { ok: false, status: 500, error: err.message }
  }
}

// POST /channels/{ch}/messages with attachments (multipart/form-data)
async function sendMessageWithAttachments(channelId, content, filePaths = []) {
  try {
    const fd = new FormData()
    if (content) {
      fd.append('payload_json', JSON.stringify({ content }))
    }
    filePaths.forEach((fp, index) => {
      if (fs.existsSync(fp)) {
        const buf = fs.readFileSync(fp)
        const filename = path.basename(fp)
        fd.append(`files[${index}]`, new Blob([buf], { type: 'image/png' }), filename)
      }
    })

    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': _gwToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      },
      body: fd
    })

    const body = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, body }
  } catch (err) {
    return { ok: false, status: 500, error: err.message }
  }
}

// Cache for found slash commands
let _guildCommandsCache = null

// Fetch guild application commands (slash commands)
async function getGuildCommands(guildId, channelId) {
  if (_guildCommandsCache && _guildCommandsCache.length) return _guildCommandsCache
  const targetGuildId = guildId || _gwGuildId || GUILD_ID
  
  // 1. Search in channel
  const r = await discordRequest('GET', `/channels/${channelId}/application-commands/search?query=invites&limit=10`)
  if (r.status === 200 && Array.isArray(r.body?.application_commands) && r.body.application_commands.length > 0) {
    _guildCommandsCache = r.body.application_commands
    return _guildCommandsCache
  }
  
  // 2. Search in guild command index
  const rGuild = await discordRequest('GET', `/guilds/${targetGuildId}/application-command-index`)
  if (rGuild.status === 200 && Array.isArray(rGuild.body?.application_commands) && rGuild.body.application_commands.length > 0) {
    _guildCommandsCache = rGuild.body.application_commands
    return _guildCommandsCache
  }

  return []
}

// Execute a slash command interaction like /invites (clicks top / first match)
async function executeSlashCommand(channelId, commandName = 'invites', userOptionValue = '') {
  const targetGuildId = _gwGuildId || GUILD_ID
  try {
    const commands = await getGuildCommands(targetGuildId, channelId)
    // Filter matching commands and pick the top one (matching the UI dropdown selection)
    const matches = commands.filter(c => c.name && c.name.toLowerCase().startsWith(commandName.toLowerCase()))
    const cmd = matches.find(c => c.name.toLowerCase() === commandName.toLowerCase()) || matches[0]

    if (cmd) {
      const optionsPayload = []
      if (cmd.options && Array.isArray(cmd.options) && cmd.options.length > 0 && userOptionValue) {
        const targetOpt = cmd.options.find(o => /user|member/i.test(o.name)) || cmd.options[0]
        optionsPayload.push({
          type: targetOpt.type || 3,
          name: targetOpt.name,
          value: userOptionValue
        })
      }

      const payload = {
        type: 2, // APPLICATION_COMMAND
        application_id: cmd.application_id,
        guild_id: targetGuildId,
        channel_id: channelId,
        session_id: _gwSessionId || 'sotarium',
        data: {
          version: cmd.version,
          id: cmd.id,
          name: cmd.name,
          type: cmd.type || 1,
          options: optionsPayload,
          application_command: {
            id: cmd.id,
            application_id: cmd.application_id,
            version: cmd.version,
            default_member_permissions: cmd.default_member_permissions || null,
            type: cmd.type || 1,
            name: cmd.name,
            description: cmd.description || '',
            dm_permission: true
          },
          attachments: []
        },
        nonce: Date.now().toString()
      }
      const res = await clickButton(payload)
      if (res.ok) return true
    }
  } catch (e) {
    // ignore
  }

  return false
}

// Helper: send claim payload into ticket channel (gw link, g.m, /invites, 4 proof images, User : ...)
async function sendTicketClaimPayload(channelId) {
  const targetGuildId = _gwGuildId || GUILD_ID
  const gwLink = _lastWonGwMessageLink || `https://discord.com/channels/${targetGuildId}/${GW_CHANNEL_ID}`
  const userTag = rollbuxUsername || discordGwUsername || 'sotarium'

  // 1. Giveaway link
  await sendMessage(channelId, gwLink)
  await new Promise(r => setTimeout(r, 700))

  // 2. g.m
  await sendMessage(channelId, 'g.m')
  await new Promise(r => setTimeout(r, 700))

  // 3. /invites user: <discord handle> (try real slash command, fallback to text)
  const discordHandle = (discordGwUsername || 'sotarium').replace(/^@/, '')
  const slashOk = await executeSlashCommand(channelId, 'invites', discordHandle)
  if (!slashOk) {
    await sendMessage(channelId, `/invites user: ${discordHandle}`)
  }
  await new Promise(r => setTimeout(r, 900))

  // 4. The 4 proof images — sent together in 1 SINGLE message
  const proofDir = path.join(__dirname, 'proof_images')
  const proofFiles = [
    path.join(proofDir, 'proof1_youtube.png'),
    path.join(proofDir, 'proof2_tiktok.png'),
    path.join(proofDir, 'proof3_instagram.png'),
    path.join(proofDir, 'proof4_twitter.png')
  ].filter(fp => fs.existsSync(fp))

  if (proofFiles.length > 0) {
    await sendMultipleImageAttachments(channelId, proofFiles)
  }
  await new Promise(r => setTimeout(r, 1000))

  // 5. User : <rollbux user>
  await sendMessage(channelId, `User : ${userTag}`)
  return true
}

// Upload multiple image files together in 1 single Discord message
async function sendMultipleImageAttachments(channelId, filePaths) {
  try {
    const boundary = '----FormBoundary' + Date.now()
    const CRLF = '\r\n'

    const metaPart = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="payload_json"${CRLF}` +
      `Content-Type: application/json${CRLF}${CRLF}` +
      `{}${CRLF}`
    )

    const parts = [metaPart]
    filePaths.forEach((fp, index) => {
      if (fs.existsSync(fp)) {
        const buf = fs.readFileSync(fp)
        const filename = path.basename(fp)
        const header = Buffer.from(
          `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="files[${index}]"; filename="${filename}"${CRLF}` +
          `Content-Type: image/png${CRLF}${CRLF}`
        )
        parts.push(header)
        parts.push(buf)
        parts.push(Buffer.from(CRLF))
      }
    })
    parts.push(Buffer.from(`--${boundary}--${CRLF}`))
    const body = Buffer.concat(parts)

    return new Promise((resolve) => {
      const opts = {
        hostname: 'discord.com',
        path: `/api/v10/channels/${channelId}/messages`,
        method: 'POST',
        headers: {
          'Authorization': _gwToken,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length
        }
      }
      const req = https.request(opts, res => {
        let raw = ''
        res.on('data', c => raw += c)
        res.on('end', () => resolve({ ok: res.statusCode === 200 || res.statusCode === 201, status: res.statusCode }))
      })
      req.on('error', e => resolve({ ok: false, error: e.message }))
      req.write(body)
      req.end()
    })
  } catch (err) {
    console.error('[sendMultipleImageAttachments] Error:', err.message)
    return { ok: false, error: err.message }
  }
}

// Upload a single image file as a Discord attachment (shows as embed, not a link)
async function sendImageAttachment(channelId, filePath) {
  try {
    const buf = fs.readFileSync(filePath)
    const filename = path.basename(filePath)
    const boundary = '----FormBoundary' + Date.now()
    const CRLF = '\r\n'

    // Build multipart body manually so we don't need extra deps
    const metaPart = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="payload_json"${CRLF}` +
      `Content-Type: application/json${CRLF}${CRLF}` +
      `{}${CRLF}`
    )
    const filePart1 = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="files[0]"; filename="${filename}"${CRLF}` +
      `Content-Type: image/png${CRLF}${CRLF}`
    )
    const filePart2 = Buffer.from(`${CRLF}--${boundary}--${CRLF}`)
    const body = Buffer.concat([metaPart, filePart1, buf, filePart2])

    return new Promise((resolve) => {
      const opts = {
        hostname: 'discord.com',
        path: `/api/v10/channels/${channelId}/messages`,
        method: 'POST',
        headers: {
          'Authorization': _gwToken,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length
        }
      }
      const req = https.request(opts, res => {
        let raw = ''
        res.on('data', c => raw += c)
        res.on('end', () => resolve({ ok: res.statusCode === 200 || res.statusCode === 201, status: res.statusCode }))
      })
      req.on('error', e => resolve({ ok: false, error: e.message }))
      req.write(body)
      req.end()
    })
  } catch (err) {
    console.error('[sendImageAttachment] Error:', err.message)
    return { ok: false, error: err.message }
  }
}

// POST /interactions  (click a component button)
async function clickButton(payload) {
  const r = await discordRequest('POST', '/interactions', payload)
  return { ok: r.status === 204 || r.status === 200, status: r.status, body: r.body }
}

// GET /channels/{id}
async function getChannel(channelId) {
  const r = await discordRequest('GET', `/channels/${channelId}`)
  if (r.status === 200 && r.body?.guild_id) return r.body
  return null
}

// GET /guilds/{id}/channels
async function getGuildChannels(guildId = null) {
  const gId = guildId || _gwGuildId || GUILD_ID
  const r = await discordRequest('GET', `/guilds/${gId}/channels`)
  if (r.status === 200 && Array.isArray(r.body)) return r.body
  return []
}

// GET /channels/{id}/messages?limit=5
async function getMessages(channelId, limit = 5) {
  const r = await discordRequest('GET', `/channels/${channelId}/messages?limit=${limit}`)
  if (r.status === 200 && Array.isArray(r.body)) return r.body
  return []
}

// ── Gateway WebSocket ────────────────────────────────────────────────────────
function _gwSend(op, d) {
  if (_gwSocket && _gwSocket.readyState === 1 /* OPEN */) {
    _gwSocket.send(JSON.stringify({ op, d }))
  }
}

function _gwStartHeartbeat(interval) {
  if (_gwHeartbeatInt) clearInterval(_gwHeartbeatInt)
  _gwHeartbeatInt = setInterval(() => {
    _gwSend(1, _gwSeq)
  }, interval)
}

function _gwStopHeartbeat() {
  if (_gwHeartbeatInt) { clearInterval(_gwHeartbeatInt); _gwHeartbeatInt = null }
}

// Handle a giveaway message: if it has a 🎉 component button, POST interaction; else PUT reaction
async function handleGiveawayMessage(msg) {
  if (!discordGwActive) return
  if (_joinedGiveaways.has(msg.id)) return
  const msgChannelId = msg.channel_id || GW_CHANNEL_ID

  // Don't join ended giveaways
  const text = (msg.content || '').toLowerCase()
  const embedText = (msg.embeds || []).map(e => `${e.title || ''} ${e.description || ''}`).join(' ').toLowerCase()
  if (text.includes('ended') || embedText.includes('giveaway ended') || embedText.includes('ended at')) {
    return
  }

  _joinedGiveaways.add(msg.id)

  const components = msg.components || []
  let foundButton = false
  for (const row of components) {
    for (const comp of (row.components || [])) {
      if (comp.type === 2) { // BUTTON
        const label = (comp.label || '') + (comp.emoji ? (comp.emoji.name || '') : '')
        // Join if not 'participants' or link buttons
        const isActionBtn = !comp.url && comp.custom_id && !label.toLowerCase().includes('participant')
        if (isActionBtn) {
          foundButton = true
          const targetGuildId = msg.guild_id || _gwGuildId || GUILD_ID
          const res = await clickButton({
            type: 3,
            nonce: Date.now().toString(),
            guild_id: targetGuildId,
            channel_id: msgChannelId,
            message_id: msg.id,
            application_id: msg.application_id || msg.author?.id,
            session_id: _gwSessionId || 'sotarium',
            message_flags: msg.flags || 0,
            data: {
              component_type: 2,
              custom_id: comp.custom_id
            }
          })
          if (res.ok) {
            sendDiscordGwLog('Successfully Joined', 'success')
          } else {
            // Fallback to 🎉 reaction if button interaction returned an error
            const reacted = await putReaction(msgChannelId, msg.id, '🎉')
            if (reacted) {
              sendDiscordGwLog('Successfully Joined', 'success')
            }
          }
        }
      }
    }
  }

  // If no component button was found at all on the giveaway message, react with 🎉
  if (!foundButton) {
    const reacted = await putReaction(msgChannelId, msg.id, '🎉')
    if (reacted) {
      sendDiscordGwLog('Successfully Joined', 'success')
    }
  }
}

let _ticketCreatedAt = 0

// Handle a win / congratulations message
async function handleWinMessage(msg) {
  if (!discordClaimActive) return
  if (_claimState !== 'idle') return

  const text = (msg.content || '').toLowerCase()
  const embeds = msg.embeds || []
  const embedText = embeds.map(e =>
    [e.title, e.description, ...(e.fields || []).map(f => f.value), ...(e.fields || []).map(f => f.name)]
    .filter(Boolean).join(' ')
  ).join(' ').toLowerCase()
  const fullText = text + ' ' + embedText

  const isCongrats = fullText.includes('congratulations') || fullText.includes('won') || fullText.includes('winner')
  if (!isCongrats) return

  const username = (discordGwUsername || 'sotarium').toLowerCase().replace(/^@/, '')

  const mentionedByObj = (msg.mentions || []).some(u =>
    u.username?.toLowerCase() === username ||
    u.global_name?.toLowerCase() === username ||
    u.display_name?.toLowerCase() === username ||
    u.id === _gwUserId
  )

  const mentionedByText = fullText.includes('@' + username) ||
                          fullText.includes(username) ||
                          (_gwUserId && fullText.includes(_gwUserId)) ||
                          (_gwUserId && (msg.content || '').includes(`<@${_gwUserId}>`)) ||
                          (_gwUserId && (msg.content || '').includes(`<@!${_gwUserId}>`))

  if (!mentionedByObj && !mentionedByText) return

  const targetGuildId = msg.guild_id || _gwGuildId || GUILD_ID
  const msgChannelId = msg.channel_id || GW_CHANNEL_ID
  _lastWonGwMessageLink = `https://discord.com/channels/${targetGuildId}/${msgChannelId}/${msg.id}`

  sendDiscordGwLog(`Giveaway won`, 'success')
  _claimState = 'waiting_ticket_msg'
  _ticketCreatedAt = Date.now()

  setTimeout(() => claimFlow_clickCreateTicket(), 2000)
}

async function claimFlow_clickCreateTicket() {
  const msgs = await getMessages(TKT_PANEL_ID, 10)
  let clicked = false
  for (const msg of msgs) {
    let msgChannelId = msg.channel_id
    let targetGuildId = msg.guild_id

    if (!msgChannelId || !targetGuildId) {
      const chInfo = await getChannel(TKT_PANEL_ID)
      if (chInfo) {
        msgChannelId = chInfo.id || TKT_PANEL_ID
        targetGuildId = chInfo.guild_id || _gwGuildId || GUILD_ID
      }
    }
    if (!msgChannelId) msgChannelId = TKT_PANEL_ID
    if (!targetGuildId) targetGuildId = _gwGuildId || GUILD_ID

    for (const row of (msg.components || [])) {
      for (const comp of (row.components || [])) {
        if (comp.type === 2) {
          const label = (comp.label || '').toLowerCase()
          const emojiName = comp.emoji?.name || ''
          if (label.includes('ticket') || emojiName.includes('📩') || label.includes('create') || !comp.url) {
            const ok = await clickButton({
              type: 3,
              nonce: Date.now().toString(),
              guild_id: targetGuildId,
              channel_id: msgChannelId,
              message_id: msg.id,
              application_id: msg.application_id || msg.author?.id,
              session_id: _gwSessionId || 'sotarium',
              message_flags: msg.flags || 0,
              data: {
                component_type: 2,
                custom_id: comp.custom_id
              }
            })
            clicked = true
            break
          }
        }
      }
      if (clicked) break
    }
    if (clicked) break
  }

  if (!clicked) {
    setTimeout(() => claimFlow_clickCreateTicket(), 5000)
    return
  }

  // After clicking, wait for the new ticket-XXXX channel to appear
  setTimeout(() => claimFlow_findAndSendOne(0), 4000)
}

// Convert snowflake string to epoch ms
function snowflakeToMs(id) {
  try {
    return Number((BigInt(id) >> 22n) + 1420070400000n)
  } catch {
    return 0
  }
}

async function claimFlow_findAndSendOne(attempt) {
  if (_claimState === 'claiming_done') return
  if (attempt > 15) {
    sendDiscordGwLog('Gave up waiting for newly created ticket channel after 75s.', 'error')
    _claimState = 'idle'
    return
  }
  const channels = await getGuildChannels()
  
  // Accept any text channel starting with ticket-
  // Prefer the newest one
  const ticketChs = channels.filter(c =>
    c.name && /^ticket-/i.test(c.name) && (c.type === 0 || c.type === undefined)
  ).sort((a, b) => BigInt(b.id) > BigInt(a.id) ? 1 : -1)

  if (ticketChs.length === 0) {
    setTimeout(() => claimFlow_findAndSendOne(attempt + 1), 4000)
    return
  }

  const ticketCh = ticketChs[0]

  const claimSuccess = await sendTicketClaimPayload(ticketCh.id)
  if (claimSuccess) {
    sendDiscordGwLog('Auto Claimed', 'success')
    _claimState = 'claiming_done'
  } else {
    setTimeout(() => claimFlow_findAndSendOne(attempt + 1), 4000)
  }
}

// Called for every MESSAGE_CREATE / MESSAGE_UPDATE from gateway
async function onGatewayMessage(msg) {
  if (!msg || !msg.id) return

  // Auto-join giveaways in the giveaway channel
  if (discordGwActive && msg.channel_id === GW_CHANNEL_ID) {
    await handleGiveawayMessage(msg)
  }

  // Auto-claim: watch all channels for win messages mentioning us
  if (discordClaimActive) {
    await handleWinMessage(msg)
  }
}

function connectGateway() {
  if (_gwSocket) {
    try { _gwSocket.terminate() } catch {}
    _gwSocket = null
  }
  _gwStopHeartbeat()

  sendDiscordGwLog('Connecting to Discord Gateway...', 'info')

  const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json')
  _gwSocket = ws

  ws.on('open', () => {
    sendDiscordGwLog('Gateway WebSocket opened.', 'info')
  })

  ws.on('message', async raw => {
    let payload
    try { payload = JSON.parse(raw) } catch { return }

    const { op, d, s, t } = payload
    if (s !== null && s !== undefined) _gwSeq = s

    switch (op) {
      case 10: { // HELLO — start heartbeat and Identify
        const interval = d.heartbeat_interval
        sendDiscordGwLog(`Gateway HELLO — heartbeat every ${interval}ms`, 'info')
        setTimeout(() => {
          _gwSend(1, _gwSeq)
          _gwStartHeartbeat(interval)
        }, Math.random() * interval)

        // Identify as a user client (not a bot — no intents, use capabilities)
        _gwSend(2, {
          token: _gwToken,
          capabilities: 30717,
          properties: {
            os: 'Windows',
            browser: 'Chrome',
            device: '',
            system_locale: 'en-US',
            browser_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            browser_version: '120.0.0.0',
            os_version: '10',
            referrer: '',
            referring_domain: '',
            referrer_current: '',
            referring_domain_current: '',
            release_channel: 'stable',
            client_build_number: 293430,
            client_event_source: null
          },
          presence: { status: 'online', since: 0, activities: [], afk: false },
          compress: false,
          client_state: { guild_versions: {} }
        })
        break
      }

      case 11: // Heartbeat ACK
        break

      case 0: { // Dispatch
        if (t === 'READY') {
          _gwSessionId = d.session_id
          _gwUserId    = d.user?.id
          _gwResumeUrl = d.resume_gateway_url
          const uname  = d.user?.username || d.user?.global_name || 'unknown'
          sendDiscordGwLog(`✅ Gateway READY — user: ${uname} (${_gwUserId})`, 'success')
          sendDiscordGwLog(`Session: ${_gwSessionId}`, 'info')

          // Extract guild_id automatically if available in user's guilds list
          if (Array.isArray(d.guilds)) {
            const matchedGuild = d.guilds.find(g => g.id === GUILD_ID)
            if (matchedGuild) {
              _gwGuildId = matchedGuild.id
            } else if (d.guilds.length > 0) {
              sendDiscordGwLog(`Note: Configured guild ${GUILD_ID} not found in ready guilds list (user has ${d.guilds.length} guilds).`, 'warn')
            }
          }

          // Subscribe to channels so Discord sends us MESSAGE_CREATE for them (op 14 = lazy guild)
          setTimeout(() => {
            sendDiscordGwLog(`Subscribing to giveaway + ticket channels...`, 'info')
            _gwSend(14, {
              guild_id: _gwGuildId,
              channels: {
                [GW_CHANNEL_ID]: [[0, 99]],
                [TKT_PANEL_ID]:  [[0, 99]]
              }
            })
          }, 1500)

          // Scan recent giveaway messages (only unjoined and still active)
          if (discordGwActive) {
            setTimeout(async () => {
              const msgs = await getMessages(GW_CHANNEL_ID, 5)
              for (const m of msgs) await handleGiveawayMessage(m)
            }, 3000)
          }
        }

        if (t === 'CHANNEL_CREATE') {
          const ch = d
          if (ch && ch.name && /^ticket-/.test(ch.name)) {
            if (_claimState === 'waiting_ticket_msg') {
              _claimState = 'claiming_in_progress'
              setTimeout(async () => {
                const claimSuccess = await sendTicketClaimPayload(ch.id)
                if (claimSuccess) {
                  sendDiscordGwLog('Auto Claimed', 'success')
                  _claimState = 'claiming_done'
                } else {
                  _claimState = 'waiting_ticket_msg'
                }
              }, 1500)
            }
          }
        }

        if (t === 'MESSAGE_CREATE' || t === 'MESSAGE_UPDATE') {
          await onGatewayMessage(d)
        }
        break
      }

      case 7: { // RECONNECT
        sendDiscordGwLog('Gateway requested reconnect.', 'warn')
        ws.close()
        break
      }

      case 9: { // INVALID SESSION
        sendDiscordGwLog('Gateway invalid session — re-identifying in 5s...', 'warn')
        _gwSessionId = null
        setTimeout(connectGateway, 5000)
        break
      }
    }
  })

  ws.on('close', (code, reason) => {
    _gwStopHeartbeat()
    sendDiscordGwLog(`Gateway closed (${code}): ${reason}`, 'warn')
    if (discordGwActive || discordClaimActive) {
      sendDiscordGwLog('Reconnecting in 8s...', 'info')
      setTimeout(connectGateway, 8000)
    }
  })

  ws.on('error', err => {
    sendDiscordGwLog(`Gateway error: ${err.message}`, 'error')
  })
}

async function startDiscordGiveawayWatcher(token) {
  discordGwActive = true

  const cleanToken = token ? token.replace(/^(?:Bearer|Bot)\s+/i, '').replace(/^"|"$/g, '').trim() : ''
  if (!cleanToken) {
    sendDiscordGwLog('Cannot start: Discord token is missing. Please reconnect.', 'error')
    return { ok: false, error: 'no_token' }
  }

  if (_gwSocket && _gwSocket.readyState === 1) {
    sendDiscordGwLog('Gateway already connected — auto-join enabled.', 'info')
    return { ok: true, status: 'already_running' }
  }

  _gwToken = cleanToken
  _claimState = 'idle'
  // Keep _joinedGiveaways so reconnects don't re-join or re-log old giveaways
  // _joinedGiveaways.clear()

  connectGateway()
  return { ok: true, status: 'started' }
}

function stopDiscordGiveawayWatcher() {
  discordGwActive = false
  discordClaimActive = false
  _gwStopHeartbeat()
  if (_gwSocket) {
    try { _gwSocket.terminate() } catch {}
    _gwSocket = null
  }
  _claimState = 'idle'
  sendDiscordGwLog('Stopped Discord Giveaway Bot.', 'info')
  return { ok: true, status: 'stopped' }
}

let mainWindow = null

// ─── Auto-Updater ─────────────────────────────────────────────────────────────
const CURRENT_VERSION = app.getVersion() // from package.json
const GITHUB_OWNER    = 'Sotarium'
const GITHUB_REPO     = 'Cue'
const EXE_ASSET_NAME  = 'Sotarium.exe'

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url)
    https.get({
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      headers: { 'User-Agent': 'Sotarium-Updater' }
    }, res => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(httpsGetJson(res.headers.location))
      }
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => {
        try { resolve(JSON.parse(raw)) } catch { reject(new Error('JSON parse failed')) }
      })
    }).on('error', reject)
  })
}

async function fetchLatestRelease() {
  const data = await httpsGetJson(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
  )
  const tag     = (data.tag_name || '').replace(/^v/, '').trim()
  const asset   = (data.assets || []).find(a => a.name === EXE_ASSET_NAME)
  const dlUrl   = asset?.browser_download_url || null
  const size    = asset?.size || 0
  return { tag, dlUrl, size }
}

function versionGt(a, b) {
  // Returns true if version string a > b  (semver-lite)
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0, nb = pb[i] || 0
    if (na > nb) return true
    if (na < nb) return false
  }
  return false
}

// IPC: check whether an update is available
ipcMain.handle('check-for-update', async () => {
  try {
    const { tag, dlUrl, size } = await fetchLatestRelease()
    const updateAvailable = tag && versionGt(tag, CURRENT_VERSION)
    return { updateAvailable, latestVersion: tag, currentVersion: CURRENT_VERSION, dlUrl, size }
  } catch (e) {
    return { updateAvailable: false, error: e.message }
  }
})

// IPC: download new exe to %TEMP%, then launch it and quit
ipcMain.handle('download-and-install-update', async () => {
  try {
    const { dlUrl, size } = await fetchLatestRelease()
    if (!dlUrl) return { ok: false, error: 'No download URL found in latest release.' }

    const destPath = path.join(os.tmpdir(), EXE_ASSET_NAME)

    await new Promise((resolve, reject) => {
      function doDownload(url, redirects = 0) {
        if (redirects > 10) return reject(new Error('Too many redirects'))
        const parsedUrl = new URL(url)
        https.get({
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          headers: { 'User-Agent': 'Sotarium-Updater' }
        }, res => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            return doDownload(res.headers.location, redirects + 1)
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}`))
          }

          const file   = fs.createWriteStream(destPath)
          let received = 0
          const total  = size || parseInt(res.headers['content-length'] || '0', 10)

          res.on('data', chunk => {
            received += chunk.length
            if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
              const percent = total > 0 ? Math.round((received / total) * 100) : -1
              mainWindow.webContents.send('update-progress', { percent, received, total })
            }
          })

          res.pipe(file)
          file.on('finish', () => file.close(resolve))
          file.on('error', reject)
          res.on('error', reject)
        }).on('error', reject)
      }
      doDownload(dlUrl)
    })

    // Launch the new exe and quit this process
    spawn(destPath, [], {
      detached: true,
      stdio: 'ignore',
      shell: false,
    }).unref()

    setTimeout(() => app.quit(), 800)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

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

  // Fetch live player profile (level, balance, avatar) directly from raw /_api/users/me
  ipcMain.handle('fetch-level', async (_event, token) => {
    return new Promise((resolve) => {
      const trimmed = (token || '').trim()
      makeRollbuxRequest({ path: '/_api/users/me', method: 'GET', token: trimmed }).then(apiRes => {
        if (apiRes.ok) {
          const u = apiRes.data?.data?.user || apiRes.data?.data || apiRes.data?.user || apiRes.data
          const lvl = extractLevelFromPayload(apiRes.text, apiRes.data)
          const avatar = u?.avatar_url || u?.avatar || u?.profile_image || u?.profile_picture || u?.image_url || u?.image || u?.picture || null
          const avatarWithTs = avatar ? (avatar.includes('?') ? `${avatar}&_ts=${Date.now()}` : `${avatar}?_ts=${Date.now()}`) : null
          const username = u?.username || u?.name || null
          return resolve({ ok: true, level: lvl && lvl > 0 ? lvl : null, badge: lvl, avatar: avatarWithTs, username })
        }
        resolve({ ok: false, level: null, avatar: null })
      }).catch(() => resolve({ ok: false, level: null, avatar: null }))
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
  ipcMain.handle('discord-get-user', async (_event, rawInput) => {
    return new Promise((resolve) => {
      if (!rawInput || typeof rawInput !== 'string') {
        return resolve({ ok: false, error: 'Please enter your Discord token or cookie string' })
      }

      let cleaned = rawInput.trim()
      // Strip outer quotes if copied with quotes
      if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1).trim()
      }

      // If user pasted a cookie string containing token=... or __Secure-token=...
      let token = cleaned;
      if (cleaned.includes('token=') || cleaned.includes('token:')) {
        const parts = cleaned.split(';');
        for (const p of parts) {
          const trimmedP = p.trim();
          if (/^(?:token|__Secure-token)\s*[:=]/i.test(trimmedP)) {
            token = trimmedP.replace(/^(?:token|__Secure-token)\s*[:=]\s*/i, '').trim();
            break;
          }
        }
      }

      // Remove 'Bot ' or 'Bearer ' prefix if user added it
      token = token.replace(/^(?:Bearer|Bot)\s+/i, '').trim();

      if (token.length < 15) {
        return resolve({ ok: false, error: 'Invalid Discord token length. Please paste a valid user token.' })
      }

      const headers = {
        'Authorization': token,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      }

      // If user pasted a cookie string, pass it along in the Cookie header as well
      if (rawInput.includes(';') || rawInput.includes('=')) {
        headers['Cookie'] = rawInput.trim()
        discordCookieHeader = rawInput.trim()
      } else {
        discordCookieHeader = ''
      }

      const options = {
        hostname: 'discord.com',
        port: 443,
        path: '/api/v10/users/@me',
        method: 'GET',
        headers
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
                token: token,
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

  // ─── Discord Giveaway IPC Handlers ───────────────────────────────────────────
  ipcMain.handle('start-discord-gw-bot', async (_event, token) => {
    return startDiscordGiveawayWatcher(token)
  })

  ipcMain.handle('stop-discord-gw-bot', async () => {
    return stopDiscordGiveawayWatcher()
  })

  ipcMain.handle('set-discord-bot-flags', async (_event, { autoJoin, autoClaim, username, rollbuxUsername: rUsername }) => {
    discordGwActive = !!autoJoin
    discordClaimActive = !!autoClaim
    if (username) discordGwUsername = username.trim()
    if (rUsername) rollbuxUsername = rUsername.trim()
    return { ok: true }
  })

  ipcMain.handle('discord-gw-status', async () => {
    return {
      active: discordGwActive,
      connected: !!(_gwSocket && _gwSocket.readyState === 1)
    }
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
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
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
