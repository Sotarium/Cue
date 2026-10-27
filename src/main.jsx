import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { brandIconBase64 } from './brandIcon.js'
import { checkIconBase64 } from './checkIcon.js'

// Authentication function using Electron IPC or fallback direct fetch
async function authenticateToken(token) {
  if (window.electronAPI?.verifySession) {
    return await window.electronAPI.verifySession(token)
  }

  try {
    const res = await fetch('https://rollbux.com/_api/users/me', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token.trim()}`,
        'Cookie': `authjs.session-token=${token.trim()}`
      }
    })

    if (!res.ok) {
      return { success: false, error: 'Authentication failed. Please check your session token.' }
    }

    const rawText = await res.text()
    let data = {}
    try { data = JSON.parse(rawText) } catch (e) {}
    const user = data.data?.user || data.data || data.user || data

    let playerLevel = 1
    const rawMatch = rawText.match(/"current_level"\s*:\s*(\d+)/i) ||
                     rawText.match(/"currentLevel"\s*:\s*(\d+)/i) ||
                     rawText.match(/"level"\s*:\s*(\d+)/i)
    if (rawMatch && rawMatch[1]) {
      playerLevel = parseInt(rawMatch[1], 10)
    } else if (user?.current_level !== undefined) {
      playerLevel = parseInt(user.current_level, 10)
    } else if (typeof user?.level === 'object' && user?.level !== null) {
      playerLevel = user.level.current_level || user.level.currentLevel || 1
    } else if (typeof user?.level === 'number') {
      playerLevel = user.level
    }
    let liveBalance = user.token_balance || 0
    try {
      const balRes = await fetch('https://rollbux.com/_api/users/me/balance', {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token.trim()}`,
          'Cookie': `authjs.session-token=${token.trim()}`
        }
      })
      if (balRes.ok) {
        const balData = await balRes.json()
        const b = balData?.data?.token_balance ?? balData?.token_balance
        if (typeof b === 'number') liveBalance = b
      }
    } catch (e) {}

    return {
      success: true,
      user: {
        username: user.username || user.name || 'Player',
        level: playerLevel,
        token_balance: liveBalance,
        avatar: user.avatar_url || user.avatar || user.profile_image || user.profile_picture || user.image_url || user.image || user.picture || null,
        raw: user
      }
    }
  } catch (err) {
    return { success: false, error: 'Unable to reach Rollbux authentication service.' }
  }
}

function DownloadPage() {
  return (
    <main className="download-page">
      <div className="download-card">
        <img src={brandIconBase64} alt="Sotarium" style={{ width: 64, height: 64, marginBottom: 16, display: 'block', margin: '0 auto 16px auto' }} />
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Sotarium</h1>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>Personal Rollbux Automation Workspace</p>
        <a className="download-button" href="https://github.com/Sotarium/Cue/releases/latest/download/Sotarium.exe">Download for Windows</a>
      </div>
    </main>
  )
}

function CueAuthPage({ onAuthSuccess }) {
  const [sessionCookie, setSessionCookie] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const tokenToUse = sessionCookie.trim()
    if (!tokenToUse) {
      setError('Please enter your authjs.session-token')
      return
    }

    setLoading(true)
    const result = await authenticateToken(tokenToUse)
    setLoading(false)

    if (!result.success) {
      setError(result.error || 'Invalid session token.')
      return
    }

    window.localStorage.setItem('sotarium_registered_token', tokenToUse)
    window.localStorage.setItem('sotarium_session_token', tokenToUse)
    window.localStorage.setItem('sotarium_user_profile', JSON.stringify(result.user))

    onAuthSuccess(result.user)
  }

  return (
    <div className="cue-auth-screen">
      <div style={{ position: 'fixed', top: 0, left: 0, right: 140, height: 32, WebkitAppRegion: 'drag', zIndex: 100 }} />

      <div className="cue-auth-box">
        <div className="cue-brand-header">
          <img
            src={brandIconBase64}
            alt="Sotarium"
            className="sotarium-brand-icon-img"
          />
          <span className="cue-brand-wordmark">Sotarium</span>
        </div>

        <h1 className="cue-auth-title">Log in</h1>

        <form className="cue-auth-form" onSubmit={handleSubmit}>
          <input
            type="password"
            className="cue-session-input"
            placeholder="Enter Session Cookie"
            value={sessionCookie}
            onChange={(e) => {
              setSessionCookie(e.target.value)
              setError('')
            }}
            autoFocus
          />

          <button
            type="submit"
            className="cue-continue-btn"
            disabled={loading}
          >
            {loading ? 'Verifying…' : 'Continue'}
          </button>
        </form>

        {error && <p className="cue-error-msg">{error}</p>}
      </div>
    </div>
  )
}

// ============================================================================
// Fullscreen "Update Detected." Blocking View — real auto-updater
// ============================================================================

function UpdateDetectedScreen({ latestVersion, onSkip }) {
  const [phase, setPhase] = useState('prompt')   // prompt | downloading | done | error
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const handleUpdate = async () => {
    setPhase('downloading')
    setProgress(0)

    // Listen for real download progress from main process
    let removeListener = () => {}
    if (window.electronAPI?.onUpdateProgress) {
      removeListener = window.electronAPI.onUpdateProgress(({ percent }) => {
        if (percent >= 0) setProgress(Math.min(percent, 99))
      })
    }

    const result = await window.electronAPI?.downloadAndInstallUpdate?.()
    removeListener()

    if (result?.ok) {
      setProgress(100)
      setPhase('done')
      // Main process will spawn the new exe and quit — nothing more needed here
    } else {
      setErrorMsg(result?.error || 'Download failed.')
      setPhase('error')
    }
  }

  return (
    <div className="update-fullscreen-overlay">
      <div style={{ position: 'fixed', top: 0, left: 0, right: 140, height: 32, WebkitAppRegion: 'drag', zIndex: 100 }} />

      <div className="update-screen-card">
        {phase === 'done' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, width: '100%', textAlign: 'center', animation: 'fadeInCenter 0.3s ease-out' }}>
            <img src={checkIconBase64} alt="Done" style={{ width: 76, height: 76, objectFit: 'contain' }} />
            <h1 className="update-screen-title" style={{ fontSize: 24, fontStyle: 'normal', textAlign: 'center', width: '100%' }}>
              Updated! Relaunching…
            </h1>
          </div>
        ) : phase === 'error' ? (
          <>
            <img src={brandIconBase64} alt="Sotarium Icon" style={{ width: 68, height: 68, objectFit: 'contain' }} />
            <div>
              <h1 className="update-screen-title">Update Failed</h1>
              <p className="update-screen-desc" style={{ marginTop: 6, color: '#ff5555' }}>{errorMsg}</p>
            </div>
            <button className="update-white-button" onClick={onSkip}>Continue Anyway</button>
          </>
        ) : phase === 'downloading' ? (
          <>
            <img src={brandIconBase64} alt="Sotarium Icon" style={{ width: 68, height: 68, objectFit: 'contain' }} />
            <div>
              <h1 className="update-screen-title">Downloading v{latestVersion}…</h1>
              <p className="update-screen-desc" style={{ marginTop: 6 }}>{progress}%</p>
            </div>
            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 9999, overflow: 'hidden', marginTop: 12 }}>
              <div style={{ height: '100%', width: `${progress}%`, background: '#acff46', transition: 'width 0.2s ease' }} />
            </div>
          </>
        ) : (
          <>
            <img src={brandIconBase64} alt="Sotarium Icon" style={{ width: 68, height: 68, objectFit: 'contain' }} />
            <div>
              <h1 className="update-screen-title">Update Detected.</h1>
              <p className="update-screen-desc" style={{ marginTop: 6 }}>
                A new version <strong style={{ color: '#acff46' }}>v{latestVersion}</strong> is available.
                Sotarium will download and relaunch automatically.
              </p>
            </div>
            <button className="update-white-button" onClick={handleUpdate}>Update Now</button>
            <button
              onClick={onSkip}
              style={{ background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', marginTop: -4 }}
            >
              Skip for now
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function InteractiveGraph({ maxVal, width, height, fillD, pathD, chartPoints, formatBuxValue, currencyIcon }) {
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const formatTooltipDate = (isoOrMs) => {
    if (!isoOrMs) return ''
    const d = new Date(isoOrMs)
    if (isNaN(d.getTime())) return ''
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const day = d.getDate()
    const m = months[d.getMonth()]
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${day} ${m} ${h}:${min}`
  }

  const handleMouseMove = (e) => {
    if (!chartPoints || chartPoints.length < 2) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const svgRatio = width / rect.width
    const targetSvgX = mouseX * svgRatio

    let closest = chartPoints[0]
    let minDist = Infinity
    for (const pt of chartPoints) {
      const dist = Math.abs(pt.x - targetSvgX)
      if (dist < minDist) {
        minDist = dist
        closest = pt
      }
    }

    const pointPixelX = (closest.x / width) * rect.width
    const pointPixelY = (closest.y / height) * rect.height

    const tooltipX = Math.max(50, Math.min(rect.width - 50, pointPixelX))
    const isNearBottom = pointPixelY >= (rect.height * 0.75)
    const tooltipY = isNearBottom ? (pointPixelY + 14) : Math.max(8, pointPixelY - 58)

    setHoveredPoint(closest)
    setTooltipPos({ x: tooltipX, y: tooltipY })
  }

  const handleMouseLeave = () => {
    setHoveredPoint(null)
  }

  return (
    <>
      <div className="absolute left-0 top-0 flex flex-col items-start justify-between h-[330px] text-[12px] font-bold text-[#6d7680] select-none">
        <p>{formatBuxValue(maxVal)}</p>
        <p>{formatBuxValue(maxVal * 0.75)}</p>
        <p>{formatBuxValue(maxVal * 0.50)}</p>
        <p>{formatBuxValue(maxVal * 0.25)}</p>
        <p className="text-white font-bold">{formatBuxValue(0)}</p>
      </div>

      <div
        className="absolute cursor-crosshair"
        style={{ left: 68, top: 9, width: 'calc(100% - 68px)', height: 330 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg className="absolute inset-0 size-full pointer-events-none" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7974FF" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#7974FF" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <line x1="0" y1="20" x2={width} y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1="0" y1="100" x2={width} y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1="0" y1="180" x2={width} y2="180" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1="0" y1="260" x2={width} y2="260" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          
          <path d={fillD} fill="url(#chartGradient)" />
          <path d={pathD} fill="none" stroke="#7974FF" strokeWidth="2.5" />

          {/* Hover Crosshair & Indicator matching Rollbux */}
          {hoveredPoint && (
            <>
              <line
                x1={hoveredPoint.x}
                y1="0"
                x2={hoveredPoint.x}
                y2={height}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="8"
                fill="#7974FF"
                opacity="0.3"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="4.5"
                fill="#ffffff"
                stroke="#7974FF"
                strokeWidth="2.5"
              />
            </>
          )}
        </svg>

        {/* Pixel-perfect Rollbux Hover Tooltip Box */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-30 flex flex-col items-start gap-1 rounded-lg bg-[#121622] border border-white/10 px-2.5 py-1.5 shadow-2xl transition-all duration-75 transform -translate-x-1/2 select-none"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <span className="text-[11px] font-semibold text-[#9aa3a8] leading-none">
              {formatTooltipDate(hoveredPoint.rawTime || hoveredPoint.timestamp || Date.now())}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <img src={currencyIcon || "./figma/token-bux.png"} alt="Coin" className="size-3.5 object-contain" />
              <span className="text-[14px] font-black tracking-tight text-white leading-none font-mono">
                {formatBuxValue(hoveredPoint.cumulative)}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function RollbuxDashboard({ user, onLogout }) {
  const [currentUnit, setCurrentUnit] = useState('BUX')
  const getCurrencyIcon = () => {
    if (currentUnit === 'BUX') return './figma/token-bux.png'
    if (currentUnit === 'USD') return './figma/token-usd.svg'
    return './figma/af-coin-24.svg'
  }

  // toast disabled
  const [activeTab, setActiveTab] = useState('24h')
  const [sideTab, setSideTab] = useState('home') // 'home' | 'automations' | 'rains' | 'discord'

  // Discord Integration State
  const [discordToken, setDiscordToken] = useState(() => window.localStorage.getItem('sotarium_discord_token') || '')
  const [discordTokenInput, setDiscordTokenInput] = useState('')
  const [discordUser, setDiscordUser] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('sotarium_discord_user') || 'null')
    } catch (e) {
      return null
    }
  })
  const [discordLoading, setDiscordLoading] = useState(false)
  const [discordError, setDiscordError] = useState('')
  const [autoJoinGiveaway, setAutoJoinGiveaway] = useState(() => window.localStorage.getItem('sotarium_auto_join_gw') === 'true')
  const [autoClaimGiveaway, setAutoClaimGiveaway] = useState(() => window.localStorage.getItem('sotarium_auto_claim_gw') === 'true')

  const handleDiscordLogin = async (tokenToUse) => {
    const t = (tokenToUse || discordTokenInput || '').trim()
    if (!t) {
      setDiscordError('Please enter a Discord token')
      return
    }
    setDiscordLoading(true)
    setDiscordError('')
    try {
      if (window.electronAPI?.discordGetUser) {
        const res = await window.electronAPI.discordGetUser(t)
        if (res && res.ok && res.user) {
          const finalToken = res.token || t
          setDiscordUser(res.user)
          setDiscordToken(finalToken)
          window.localStorage.setItem('sotarium_discord_token', finalToken)
          window.localStorage.setItem('sotarium_discord_user', JSON.stringify(res.user))
          setDiscordTokenInput('')
        } else {
          setDiscordError(res?.error || 'Failed to authenticate with Discord')
        }
      } else {
        // Web fallback
        const resp = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: t }
        })
        if (resp.ok) {
          const d = await resp.json()
          const u = {
            id: d.id,
            username: d.username,
            global_name: d.global_name || d.username,
            avatar: d.avatar ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png?size=128` : null,
            discriminator: d.discriminator
          }
          setDiscordUser(u)
          setDiscordToken(t)
          window.localStorage.setItem('sotarium_discord_token', t)
          window.localStorage.setItem('sotarium_discord_user', JSON.stringify(u))
          setDiscordTokenInput('')
        } else {
          setDiscordError(`Authentication failed: HTTP ${resp.status}`)
        }
      }
    } catch (err) {
      setDiscordError(err.message || 'Network error verifying Discord token')
    } finally {
      setDiscordLoading(false)
    }
  }

  const handleDiscordLogout = () => {
    setDiscordUser(null)
    setDiscordToken('')
    setDiscordTokenInput('')
    setDiscordError('')
    window.localStorage.removeItem('sotarium_discord_token')
    window.localStorage.removeItem('sotarium_discord_user')
  }

  const [discordGwLogs, setDiscordGwLogs] = useState([])
  // Session-based live stats: always start fresh per app execution session
  const [gwStats, setGwStats] = useState({ joined: 0, won: 0, lost: 0, date: Date.now() })

  useEffect(() => {
    if (!window.electronAPI?.onDiscordGwLog) return
    const cleanup = window.electronAPI.onDiscordGwLog((log) => {
      setDiscordGwLogs((prev) => [log, ...prev].slice(0, 15))
      if (log.message === 'Successfully Joined') {
        setGwStats(prev => {
          const next = { ...prev, joined: prev.joined + 1, lost: Math.max(0, (prev.joined + 1) - prev.won) }
          window.localStorage.setItem('sotarium_gw_stats_24h', JSON.stringify(next))
          return next
        })
      } else if (log.message === 'Giveaway won') {
        setGwStats(prev => {
          const next = { ...prev, won: prev.won + 1, lost: Math.max(0, prev.joined - (prev.won + 1)) }
          window.localStorage.setItem('sotarium_gw_stats_24h', JSON.stringify(next))
          return next
        })
      }
    })
    return cleanup
  }, [])

  useEffect(() => {
    if ((autoJoinGiveaway || autoClaimGiveaway)) {
      if (!discordToken) {
        setDiscordGwLogs(prev => [{
          message: 'Discord token not found in memory. Please reconnect Discord account above.',
          type: 'error',
          time: new Date().toLocaleTimeString()
        }, ...prev].slice(0, 15))
        return
      }
      if (window.electronAPI?.startDiscordGiveawayBot) {
        window.electronAPI.startDiscordGiveawayBot(discordToken)
      }
      if (window.electronAPI?.setDiscordBotFlags) {
        window.electronAPI.setDiscordBotFlags({ 
          autoJoin: autoJoinGiveaway, 
          autoClaim: autoClaimGiveaway,
          username: discordUser?.username || 'sotarium',
          rollbuxUsername: user?.username || 'sotarium'
        })
      }
    } else if (!autoJoinGiveaway && !autoClaimGiveaway) {
      if (window.electronAPI?.stopDiscordGiveawayBot) {
        window.electronAPI.stopDiscordGiveawayBot()
      }
    }
  }, [autoJoinGiveaway, autoClaimGiveaway, discordToken, discordUser])

  const handleToggleAutoJoin = (val) => {
    setAutoJoinGiveaway(val)
    window.localStorage.setItem('sotarium_auto_join_gw', String(val))
    if (window.electronAPI?.setDiscordBotFlags) {
      window.electronAPI.setDiscordBotFlags({ 
        autoJoin: val, 
        autoClaim: autoClaimGiveaway,
        username: discordUser?.username || 'sotarium',
        rollbuxUsername: user?.username || 'sotarium'
      })
    }
    if (val && discordToken && window.electronAPI?.startDiscordGiveawayBot) {
      window.electronAPI.startDiscordGiveawayBot(discordToken)
    } else if (!val && !autoClaimGiveaway && window.electronAPI?.stopDiscordGiveawayBot) {
      window.electronAPI.stopDiscordGiveawayBot()
    }
  }

  const handleToggleAutoClaim = (val) => {
    setAutoClaimGiveaway(val)
    window.localStorage.setItem('sotarium_auto_claim_gw', String(val))
    if (window.electronAPI?.setDiscordBotFlags) {
      window.electronAPI.setDiscordBotFlags({ 
        autoJoin: autoJoinGiveaway, 
        autoClaim: val,
        username: discordUser?.username || 'sotarium',
        rollbuxUsername: user?.username || 'sotarium'
      })
    }
    if (val && discordToken && window.electronAPI?.startDiscordGiveawayBot) {
      window.electronAPI.startDiscordGiveawayBot(discordToken)
    } else if (!val && !autoJoinGiveaway && window.electronAPI?.stopDiscordGiveawayBot) {
      window.electronAPI.stopDiscordGiveawayBot()
    }
  }

  // Fullscreen update screen trigger
  const [showUpdateScreen, setShowUpdateScreen] = useState(false)

  // Upgrader state
  const [upgraderActive, setUpgraderActive] = useState(false)
  const [upgraderMultiplier, setUpgraderMultiplier] = useState(2.0)
  const [upgraderRandom, setUpgraderRandom] = useState(false)
  const [upgraderAutoSell, setUpgraderAutoSell] = useState(true)
  const [upgraderFeedback, setUpgraderFeedback] = useState('Ready')

  // Battle state
  const [battleActive, setBattleActive] = useState(false)
  const [battleBorrow, setBattleBorrow] = useState(true)
  const [battleCrazy, setBattleCrazy] = useState(true)
  const [battleFeedback, setBattleFeedback] = useState('Ready')

  // Mines state
  const [minesActive, setMinesActive] = useState(false)
  const [minesFeedback, setMinesFeedback] = useState('Ready')

  // Rain Bot state (auto-clicks Join Rain button in hidden browser window)
  const [rainBotActive, setRainBotActive] = useState(false)
  const [rainBotFeedback, setRainBotFeedback] = useState('Inactive')

  const toggleRainBot = async () => {
    if (!rainBotActive) {
      setRainBotFeedback('Starting...')
      const token = window.localStorage.getItem('sotarium_session_token') || ''
      if (window.electronAPI?.startRainBot) {
        const res = await window.electronAPI.startRainBot(token)
        if (res?.ok) {
          setRainBotActive(true)
          setRainBotFeedback('Running')
        } else {
          setRainBotFeedback('Failed: ' + (res?.error || 'unknown'))
        }
      }
    } else {
      if (window.electronAPI?.stopRainBot) {
        await window.electronAPI.stopRainBot()
      }
      setRainBotActive(false)
      setRainBotFeedback('Inactive')
    }
  }

  // Data state
  const [rains, setRains] = useState([])
  const [gameHistory, setGameHistory] = useState([])
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const sessionToken = window.localStorage.getItem('sotarium_session_token') || ''

  const showToast = () => {}

  // Fetch rain data: live cycle (public) + user transactions from backend
  const [rainCycle, setRainCycle] = useState(null) // { secondsLeft, potBux }
  const [rainTxs, setRainTxs] = useState([])       // actual earned rain transactions

  const deleteRainTx = (txTimestamp, txIndex) => {
    const targetTx = rainTxs[txIndex] || rainTxs.find(t => t.timestamp === txTimestamp)
    
    // Save to permanent local blacklist in localStorage
    try {
      const savedBlacklist = JSON.parse(window.localStorage.getItem('sotarium_deleted_rains') || '[]')
      if (txTimestamp && !savedBlacklist.includes(String(txTimestamp))) savedBlacklist.push(String(txTimestamp))
      if (targetTx?.id && !savedBlacklist.includes(String(targetTx.id))) savedBlacklist.push(String(targetTx.id))
      if (targetTx?.cycle_id && !savedBlacklist.includes(String(targetTx.cycle_id))) savedBlacklist.push(String(targetTx.cycle_id))
      window.localStorage.setItem('sotarium_deleted_rains', JSON.stringify(savedBlacklist))
    } catch (e) {}

    setRainTxs(prev => prev.filter((t, idx) => {
      if (txTimestamp && t.timestamp === txTimestamp) return false
      if (idx === txIndex) return false
      return true
    }))
    setRains(prev => prev.filter((_, idx) => idx !== txIndex))
    showToast('Rain transaction removed')
  }

  const fetchRains = async () => {
    // 1. Live cycle from rollbux
    try {
      const res = await fetch('https://rollbux.com/_api/rain/current')
      if (res.ok) {
        const d = await res.json()
        const cycleEnd = d?.data?.cycle?.cycle_end
        const livePool = d?.data?.live_pool || 0
        if (cycleEnd) {
          const secondsLeft = Math.max(0, Math.floor((new Date(cycleEnd).getTime() - Date.now()) / 1000))
          const potBux = parseFloat((livePool / 1000000).toFixed(2))
          setRainCycle({ secondsLeft, potBux })
        }
      }
    } catch (e) {}

    // 2. Direct Rollbux Official API for User Rain Transactions (rollbux.com/_api/users/me/transactions)
    try {
      const token = window.localStorage.getItem('sotarium_session_token') || sessionToken
      if (window.electronAPI?.rollbuxRequest && token) {
        const res = await window.electronAPI.rollbuxRequest({
          path: '/_api/users/me/transactions',
          method: 'GET',
          token
        })
        if (res.ok && res.data) {
          const items = res.data.data?.items || res.data.items || []
          const blacklist = JSON.parse(window.localStorage.getItem('sotarium_deleted_rains') || '[]')

          const filteredRains = items
            .filter(t => t.type === 'RAIN_REWARD')
            .map((t, idx) => {
              const ts = typeof t.date === 'number' ? t.date : new Date(t.date || t.created_at || Date.now()).getTime()
              return {
                id: t.id || `${user.username}_${ts}`,
                account: user.username,
                amount_bux: parseFloat(((t.amount || 0) / 1000000).toFixed(2)),
                timestamp: ts,
                time: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            })
            .filter(t => !blacklist.includes(String(t.timestamp)) && !blacklist.includes(String(t.id)))

          setRainTxs(filteredRains)
          setRains(filteredRains.map((t, i) => ({
            id: t.id || i,
            amount: t.amount_bux || 0,
            ends_at: t.timestamp,
            account: t.account
          })))
        }
      }
    } catch (e) {
      console.error('Failed to fetch transactions from Rollbux official API:', e)
    }
  }

  useEffect(() => {
    fetchRains()
    const interval = setInterval(fetchRains, 15000)
    return () => clearInterval(interval)
  }, [])

  // Live level & balance polling — scrape actively every second for avatar & live stats
  const [liveLevel, setLiveLevel] = useState(user.level || user.raw?.level || 1)
  const [levelBadge, setLevelBadge] = useState(user.level || user.raw?.level || 1)
  const [liveBalance, setLiveBalance] = useState(user.token_balance || 0)
  const [liveAvatar, setLiveAvatar] = useState(user.avatar || user.raw?.avatar_url || user.raw?.avatar || null)

  useEffect(() => {
    const token = window.localStorage.getItem('sotarium_session_token') || ''
    const doFetch = async () => {
      // 1. Fetch live level & avatar every second
      if (window.electronAPI?.fetchLevel) {
        const res = await window.electronAPI.fetchLevel(token)
        if (res && res.ok) {
          if (res.level !== null && res.level > 0) {
            setLiveLevel(res.level)
            if (res.badge) setLevelBadge(res.badge)
          }
          if (res.avatar) {
            setLiveAvatar(res.avatar)
          }
          try {
            const cached = JSON.parse(window.localStorage.getItem('sotarium_user_profile') || '{}')
            if (res.level) cached.level = res.level
            if (res.avatar) cached.avatar = res.avatar
            window.localStorage.setItem('sotarium_user_profile', JSON.stringify(cached))
          } catch (e) {}
        }
      }

      // 2. Fetch live balance
      if (window.electronAPI?.fetchBalance) {
        const balRes = await window.electronAPI.fetchBalance(token)
        if (balRes && balRes.ok && typeof balRes.token_balance === 'number') {
          setLiveBalance(balRes.token_balance)
          try {
            const cached = JSON.parse(window.localStorage.getItem('sotarium_user_profile') || '{}')
            cached.token_balance = balRes.token_balance
            window.localStorage.setItem('sotarium_user_profile', JSON.stringify(cached))
          } catch (e) {}
        }
      } else if (token) {
        // Fallback direct web request
        try {
          const bResp = await fetch('https://rollbux.com/_api/users/me/balance', {
            headers: { 'Authorization': `Bearer ${token}`, 'Cookie': `authjs.session-token=${token}` }
          })
          if (bResp.ok) {
            const bJson = await bResp.json()
            const b = bJson?.data?.token_balance ?? bJson?.token_balance
            if (typeof b === 'number') setLiveBalance(b)
          }
        } catch (e) {}
      }
    }
    doFetch()
    const interval = setInterval(doFetch, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleCopyCode = () => {
    navigator.clipboard.writeText(user.username)
    setCopiedCode(true)
    showToast('Referral code copied')
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://rollbux.com/r/${user.username.toLowerCase()}`)
    setCopiedLink(true)
    showToast('Referral link copied')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  // Upgrader execution
  const executeUpgraderPlay = async () => {
    setUpgraderFeedback('Upgrading...')
    try {
      const res = await window.electronAPI.backendCall({
        endpoint: '/api/upgrader/play',
        method: 'POST',
        body: {
          username: user.username,
          multiplier: upgraderMultiplier,
          randomPosition: upgraderRandom,
          autoSell: upgraderAutoSell,
        }
      })
      if (res.ok && res.data?.success) {
        const d = res.data
        const won = d.won
        const payout = d.newBalanceBux ?? d.stakeBux ?? 0
        setUpgraderFeedback(won ? `Won! +${Number(payout).toFixed(2)} BUX` : 'Lost — no upgrade')
        showToast(won ? `Upgrader won! Auto-sold for ${Number(payout).toFixed(2)} BUX` : 'Upgrader: no win this round')
        setGameHistory(prev => [{
          mode: 'Upgrader',
          success: won,
          account: user.username,
          amount: Number(payout).toFixed(2),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }, ...prev])
      } else {
        const msg = (typeof res.data?.error === 'string' ? res.data.error : JSON.stringify(res.data?.error)) || res.data?.message || `HTTP ${res.statusCode}`
        setUpgraderFeedback(`Error: ${msg}`)
        showToast(`Upgrader error: ${msg}`)
      }
    } catch (e) {
      setUpgraderFeedback('Error')
      showToast('Upgrader: network error')
    }
  }

  // Battle execution
  const executeBattleCreate = async () => {
    // 50% crazy mode, 50% normal mode when battleCrazy is toggled on
    const isCrazyMode = battleCrazy ? (Math.random() < 0.5) : false
    setBattleFeedback(`Creating 3v3 battle (${isCrazyMode ? 'Crazy' : 'Normal'})...`)
    try {
      const res = await window.electronAPI.backendCall({
        endpoint: '/api/battles/create',
        method: 'POST',
        body: {
          username: user.username,
          borrow: battleBorrow,
          crazy_mode: isCrazyMode,
        }
      })
      if (res.ok && res.data?.success) {
        const d = res.data
        const cost = d.actualPaidBux ?? d.totalCostBux ?? 0
        setBattleFeedback(`Battle #${d.battle_id} created! Cost: ${Number(cost).toFixed(2)} BUX`)
        showToast(`3v3 Battle created! ID #${d.battle_id}`)
        setGameHistory(prev => [{
          mode: 'Battle',
          success: true,
          account: user.username,
          amount: Number(cost).toFixed(2),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }, ...prev])
      } else {
        const msg = (typeof res.data?.error === 'string' ? res.data.error : JSON.stringify(res.data?.error)) || res.data?.message || `HTTP ${res.statusCode}`
        setBattleFeedback(`Error: ${msg}`)
        showToast(`Battle error: ${msg}`)
      }
    } catch (e) {
      setBattleFeedback('Error')
      showToast('Battle: network error')
    }
  }

  // Mines execution — 3-step flow: start → reveal tiles → cashout
  const executeMinesPlay = async () => {
    setMinesFeedback('Starting mines...')
    try {
      // Step 1: Start game with 50 BUX, 1 mine
      const startRes = await window.electronAPI.backendCall({
        endpoint: '/api/mines/start',
        method: 'POST',
        body: { username: user.username, amount_micro_tokens: 50000000, number_of_mines: 1 }
      })
      if (!startRes.ok || !startRes.data?.success) {
        const msg = (typeof startRes.data?.error === 'string' ? startRes.data?.error : JSON.stringify(startRes.data?.error)) || startRes.data?.message || `HTTP ${startRes.statusCode}`
        setMinesFeedback(`Start error: ${msg}`)
        showToast(`Mines start error: ${msg}`)
        return
      }

      // Step 2: Reveal tile 0 (safe corner)
      setMinesFeedback('Revealing tile 0...')
      const rev1 = await window.electronAPI.backendCall({
        endpoint: '/api/mines/reveal',
        method: 'POST',
        body: { username: user.username, tile_index: 0 }
      })
      if (!rev1.ok || !rev1.data?.success || rev1.data?.exploded) {
        const msg = rev1.data?.exploded ? 'Exploded on tile 0!' : ((typeof rev1.data?.error === 'string' ? rev1.data?.error : JSON.stringify(rev1.data?.error)) || `HTTP ${rev1.statusCode}`)
        setMinesFeedback(msg)
        showToast(`Mines: ${msg}`)
        setGameHistory(prev => [{
          mode: 'Mines',
          success: false,
          account: user.username,
          amount: '50.00',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }, ...prev])
        return
      }

      // Step 3: Reveal tile 5 (second safe spot)
      setMinesFeedback('Revealing tile 5...')
      const rev2 = await window.electronAPI.backendCall({
        endpoint: '/api/mines/reveal',
        method: 'POST',
        body: { username: user.username, tile_index: 5 }
      })
      if (!rev2.ok || !rev2.data?.success || rev2.data?.exploded) {
        const msg = rev2.data?.exploded ? 'Exploded on tile 5!' : ((typeof rev2.data?.error === 'string' ? rev2.data?.error : JSON.stringify(rev2.data?.error)) || `HTTP ${rev2.statusCode}`)
        setMinesFeedback(msg)
        showToast(`Mines: ${msg}`)
        setGameHistory(prev => [{
          mode: 'Mines',
          success: false,
          account: user.username,
          amount: '50.00',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }, ...prev])
        return
      }

      // Step 4: Cashout
      setMinesFeedback('Cashing out...')
      const cashRes = await window.electronAPI.backendCall({
        endpoint: '/api/mines/cashout',
        method: 'POST',
        body: { username: user.username }
      })
      if (cashRes.ok && cashRes.data?.success) {
        const payout = cashRes.data?.payout_bux ?? 0
        setMinesFeedback(`Cashed out! +${Number(payout).toFixed(2)} BUX`)
        showToast(`Mines cashed out! +${Number(payout).toFixed(2)} BUX`)
        setGameHistory(prev => [{
          mode: 'Mines',
          success: true,
          account: user.username,
          amount: Number(payout).toFixed(2),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }, ...prev])
      } else {
        const msg = (typeof cashRes.data?.error === 'string' ? cashRes.data?.error : JSON.stringify(cashRes.data?.error)) || cashRes.data?.message || `HTTP ${cashRes.statusCode}`
        setMinesFeedback(`Cashout error: ${msg}`)
        showToast(`Mines cashout error: ${msg}`)
      }
    } catch (e) {
      setMinesFeedback('Error')
      showToast('Mines: network error')
    }
  }


  // Auto-loop: when active flags ON, run automation continuously
  useEffect(() => {
    if (!upgraderActive) return
    let alive = true
    const loop = async () => {
      while (alive) {
        await executeUpgraderPlay()
        await new Promise(r => setTimeout(r, 2500))
      }
    }
    loop()
    return () => { alive = false }
  }, [upgraderActive])

  useEffect(() => {
    if (!battleActive) return
    let alive = true
    const loop = async () => {
      while (alive) {
        await executeBattleCreate()
        await new Promise(r => setTimeout(r, 3000))
      }
    }
    loop()
    return () => { alive = false }
  }, [battleActive])

  useEffect(() => {
    if (!minesActive) return
    let alive = true
    const loop = async () => {
      while (alive) {
        await executeMinesPlay()
        await new Promise(r => setTimeout(r, 3000))
      }
    }
    loop()
    return () => { alive = false }
  }, [minesActive])

  const [solPrice, setSolPrice] = useState(150.00)

  // Universal format value based on currentUnit (BUX, USD, SOL)
  const formatBuxValue = (buxVal) => {
    const bux = parseFloat(buxVal) || 0
    if (currentUnit === 'USD') return `$${(bux * 0.002).toFixed(2)}`
    if (currentUnit === 'SOL') return `${((bux * 0.002) / (solPrice || 150)).toFixed(4)}`
    return bux.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatValue = (microTokens) => {
    const bux = microTokens ? microTokens / 1000000 : 0
    return formatBuxValue(bux)
  }

  // Side nav items
  const NAV_ITEMS = [
    { id: 'home', label: 'Home', icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    )},
    { id: 'automations', label: 'Automations', icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    )},
    { id: 'rains', label: 'Rains', icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
    )},
    { id: 'discord', label: 'Discord', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    )},
  ]

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: '#121418' }} className="selection:bg-[#acff46] selection:text-[#0e131f]">
      {/* Drag region for frameless window */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 140, height: 32, WebkitAppRegion: 'drag', zIndex: 9999 }} />

      {/* Toast */}
      

      {/* ── Left sidebar nav ── */}
      <div style={{ width: 220, minWidth: 220, flexShrink: 0, background: '#0b0e17', borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingTop: 44, paddingBottom: 24, paddingLeft: 12, paddingRight: 12, gap: 4 }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 16 }}>
          <img src={brandIconBase64} alt="Sotarium" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          <span style={{ fontSize: 15, fontWeight: 900, fontStyle: 'italic', color: '#fff', letterSpacing: '-0.3px' }}>Sotarium</span>
        </div>

        {/* Nav items */}
        {['home', 'automations', 'rains', 'discord'].map(id => (
          <button
            key={id}
            type="button"
            onClick={() => setSideTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'all 0.15s',
              background: sideTab === id ? '#131a29' : 'transparent',
              color: sideTab === id ? '#fff' : '#9aa3a8',
              border: sideTab === id ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
            }}
          >
            {id.charAt(0).toUpperCase() + id.slice(1)}
            {/* active tab indicator */}
          </button>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User card + logout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Log Out
          </button>
          <div style={{ padding: '10px 12px', borderRadius: 12, background: '#131a29', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
            {liveAvatar ? (
              <img
                src={liveAvatar}
                alt=""
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(172,255,70,0.3)', flexShrink: 0 }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(172,255,70,0.15)', border: '1px solid rgba(172,255,70,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#acff46' }}>{(user.username?.[0] || 'S').toUpperCase()}</span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 800,
                  background: 'linear-gradient(180deg, #2b3240 0%, #1e232d 100%)',
                  border: '1px solid rgba(172, 255, 70, 0.4)',
                  color: '#acff46',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  letterSpacing: '0.2px'
                }}>
                  LVL {liveLevel}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', height: '100vh' }}>
        {/* Universal Top Bar with Global Currency Selector across all tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '16px 24px 0 24px', width: '100%' }}>
          <div className="flex gap-1 bg-[#131a29] p-1 rounded-md border border-white/[0.04] shadow-sm">
            {[
              { id: 'BUX', icon: './figma/token-bux.png' },
              { id: 'USD', icon: './figma/token-usd.svg' },
              { id: 'SOL', icon: './figma/af-coin-24.svg' },
            ].map(({ id, icon }) => (
              <button key={id} onClick={() => setCurrentUnit(id)} type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold transition cursor-pointer ${currentUnit === id ? 'bg-[#acff46] text-[#121418]' : 'text-[#9aa3a8] hover:text-white'}`}>
                <img src={icon} alt={id} style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0 }} />
                {id}
              </button>
            ))}
          </div>
        </div>


        {/* ════ HOME TAB ════ */}
        {sideTab === 'home' && (
          <div className="flex w-full justify-center pb-[40px] pt-[35px]">
            <div className="flex w-full max-w-[1100px] mx-auto flex-col items-center gap-[28px] px-6">

              {/* Header */}
              <h1 className="whitespace-nowrap text-[25px] tracking-[0.5px] text-white font-bold italic">{user.username}</h1>

                {/* Content */}
                <div className="flex w-full flex-col items-start gap-[24px]">

                  {/* Overview */}
                  <div className="flex w-full flex-col gap-[16px]">
                    <div className="flex w-full items-center justify-between gap-3">
                      <p className="text-[20px] font-bold italic text-white">Overview</p>
                      <div className="flex items-center gap-3">
                        <button onClick={() => showToast('Overview metrics reset')} type="button" className="flex h-[32px] items-center justify-center rounded-[7px] px-[14px] bg-[#acff46] text-[#121418] font-bold text-[13px] hover:brightness-110 active:scale-95 transition cursor-pointer">Clear</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px] w-full">
                      <div className="relative flex w-full flex-col gap-[6px] rounded-[12px] px-[20px] py-[16px] border border-white/[0.03] bg-[#0e131f]">
                        <p className="text-[14px] font-medium text-[#9aa3a8]">Rains Joined</p>
                        <p className="text-[20px] font-bold text-white">{rainTxs.length} Rains</p>
                      </div>
                      <div className="relative flex w-full flex-col gap-[6px] rounded-[12px] px-[20px] py-[16px] border border-white/[0.03] bg-[#0e131f]">
                        <p className="text-[14px] font-medium text-[#9aa3a8]">How Much Time</p>
                        <p className="text-[20px] font-bold text-white">0S</p>
                      </div>
                      <div className="relative flex w-full flex-col gap-[6px] rounded-[12px] px-[20px] py-[16px] border border-white/[0.03] bg-[#0e131f]">
                        <p className="text-[14px] font-medium text-[#9aa3a8]">Total Earnings</p>
                        <div className="flex items-center gap-[8px]">
                          <img alt="" className="size-[24px] object-contain" src={getCurrencyIcon()} />
                          <p className="text-[20px] font-bold text-white">{formatBuxValue(rainTxs.reduce((acc, t) => acc + (t.amount_bux || 0), 0))}</p>
                        </div>
                      </div>
                      <div className="relative flex w-full items-center justify-between gap-[12px] rounded-[12px] border border-[rgba(172,255,70,0.12)] px-[20px] py-[16px] bg-[#0e131f]">
                        <div className="flex min-w-0 flex-col gap-[6px]">
                          <p className="text-[14px] font-medium text-[#acff46]">Current Balance</p>
                          <div className="flex items-center gap-[8px]">
                            <img alt="" className="size-[24px] object-contain" src={getCurrencyIcon()} />
                            <p className="text-[20px] font-bold text-white">{formatValue(liveBalance)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="flex w-full flex-col gap-[16px]">
                    <div className="flex w-full items-center justify-between">
                      <p className="text-[20px] font-bold italic text-white">Statistics</p>
                      <div className="flex items-center gap-3">
                        <button onClick={() => showToast('Stats cleared')} type="button" className="flex h-[32px] items-center justify-center rounded-[7px] px-[14px] bg-[#acff46] text-[#121418] font-bold text-[13px] hover:brightness-110 active:scale-95 transition cursor-pointer">Clear</button>
                        <div className="flex items-center gap-[2px] rounded-[8px] p-[2px] bg-[#0e131f] border border-white/[0.04]">
                          {['24H', 'Week', 'Month'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())} type="button"
                              className={`flex h-[32px] items-center justify-center rounded-[7px] px-[12px] transition cursor-pointer ${activeTab === tab.toLowerCase() ? 'bg-[#131a29] text-white font-semibold' : 'text-[#9aa3a8] hover:text-white'}`}>
                              <span className="text-[14px]">{tab}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="relative flex w-full flex-col items-start justify-center overflow-clip rounded-[12px] p-[24px] border border-white/[0.03] bg-[#0e131f]">
                      <div className="custom-scroll relative h-[348px] w-full overflow-x-auto overflow-y-clip">
                        <div className="relative h-full w-full min-w-[500px]">
                          {(() => {
                            const sortedTxs = [...rainTxs].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
                            let cumulative = 0
                            const pointsData = sortedTxs.map(t => {
                              cumulative += (t.amount_bux || 0)
                              return {
                                cumulative,
                                earning: t.amount_bux || 0,
                                rawTime: t.timestamp || Date.now(),
                                timestamp: t.timestamp || Date.now()
                              }
                            })

                            if (pointsData.length < 2) {
                              pointsData.unshift({ cumulative: 0, earning: 0, time: 'Start' })
                            }

                            const maxVal = Math.max(10, Math.ceil((Math.max(...pointsData.map(p => p.cumulative), 0) || 10) * 1.15))
                            const width = 744
                            const height = 330

                            const chartPoints = pointsData.map((p, idx) => {
                              const x = (idx / (pointsData.length - 1)) * width
                              const y = height - (p.cumulative / maxVal) * (height - 45) - 15
                              return { ...p, x, y }
                            })

                            const coords = chartPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                            const pathD = 'M ' + coords.join(' L ')
                            const fillD = `M 0,${height} L ` + coords.join(' L ') + ` L ${width},${height} Z`

                            return (
                              <InteractiveGraph
                                maxVal={maxVal}
                                width={width}
                                height={height}
                                fillD={fillD}
                                pathD={pathD}
                                chartPoints={chartPoints}
                                formatBuxValue={formatBuxValue}
                                currencyIcon={getCurrencyIcon()}
                              />
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Game History */}
                  <div className="flex w-full flex-col gap-[16px]">
                    <div className="flex w-full items-center justify-between">
                      <p className="text-[20px] font-bold italic text-white">Game History</p>
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setGameHistory([]); showToast('Game history cleared'); }} type="button" className="flex h-[30px] items-center justify-center rounded-[7px] px-[12px] bg-[#7c3aed] text-white font-bold text-[12px] hover:brightness-110 active:scale-95 transition cursor-pointer">Clear History</button>
                        <span className="text-[13px] text-[#9aa3a8]">{gameHistory.length} rounds</span>
                      </div>
                    </div>
                    <div className="custom-scroll w-full overflow-x-auto overflow-y-hidden">
                      <div className="relative w-full min-w-[650px] rounded-[12px] border border-white/[0.03] overflow-hidden bg-[#0e131f]" style={{ minHeight: 164 }}>
                        <div className="grid grid-cols-5 items-center gap-[12px] px-[16px] py-[14px] text-[13px] font-semibold text-[#9aa3a8] border-b border-white/[0.04]">
                          <div>Account</div><div className="text-center">Mode</div><div className="text-center">Result</div><div className="text-center">Amount</div><div className="text-right pr-2">Time</div>
                        </div>
                        <div className="flex flex-col divide-y divide-white/[0.02]">
                          {gameHistory.length === 0 ? (
                            <div className="flex h-[120px] items-center justify-center px-[32px] text-center">
                              <p className="text-[13px] text-[#9aa3a8]">No game rounds yet. Start Auto Upgrader, Battle, or Mines to see history here.</p>
                            </div>
                          ) : gameHistory.map((item, i) => (
                            <div key={i} className="grid grid-cols-5 items-center gap-[12px] px-[16px] py-[10px] hover:bg-white/[0.02]">
                              <span className="truncate text-[14px] font-bold italic text-white">{item.account}</span>
                              <span className="text-center text-[13px] font-bold text-[#7974FF]">{item.mode}</span>
                              <span className="text-center">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase ${item.success ? 'bg-[#acff46]/10 text-[#acff46]' : 'bg-red-500/10 text-red-400'}`}>{item.success ? 'Success' : 'Loss'}</span>
                              </span>
                              <span className="text-center text-[13px] font-bold text-[#c2c6db]">{formatBuxValue(item.amount)}</span>
                              <span className="text-right pr-2 text-[12px] text-[#9aa3a8]">{item.time}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
            </div>
          </div>
        )}

        {/* ════ AUTOMATIONS TAB ════ */}
        {sideTab === 'automations' && (
          <div className="flex w-full justify-center pb-[40px] pt-[35px]">
            <div className="flex w-full max-w-[1100px] mx-auto flex-col items-center gap-[28px] px-6">
              <div className="flex shrink-0 flex-col items-start gap-[6px]">

                <h1 className="text-[25px] tracking-[0.5px] text-white font-bold italic">Automations</h1>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">

                {/* Auto Upgrader */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-[20px] font-black italic text-white">Auto Upgrader</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${upgraderActive ? 'bg-[#acff46]/10 border border-[#acff46]/30 text-[#acff46]' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>{upgraderActive ? 'Active' : 'Disabled'}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input type="checkbox" checked={upgraderActive} onChange={e => setUpgraderActive(e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#acff46]"></div>
                    </label>
                  </div>
                  <div className="flex flex-col gap-4 rounded-[12px] bg-[#0e131f] p-[20px] border border-white/[0.03]">
                    {/* Wheel */}
                    <div className="flex flex-col items-center py-2">
                      <div className="relative size-[200px] flex items-center justify-center">
                        <svg className="size-full overflow-visible" viewBox="0 0 200 200">
                          <circle cx="100" cy="100" r="78" fill="#0c0f17" stroke="#181d2a" strokeWidth="15" />
                          <circle cx="100" cy="100" r="78" fill="none" stroke="#8b5cf6" strokeWidth="15" strokeDasharray="220.5 490.09" transform="rotate(-90 100 100)" />
                          <circle cx="100" cy="22" r="6.5" fill="#ffffff" stroke="#8b5cf6" strokeWidth="2" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-[34px] font-black text-white tracking-tight leading-none">45.00%</span>
                        </div>
                      </div>
                    </div>
                    {/* Multiplier */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px] font-black text-[#9aa3a8]">
                        <span>MULTIPLIER TARGET</span>
                        <span className="text-white">{upgraderMultiplier.toFixed(2)}x</span>
                      </div>
                      <div className="relative flex items-center">
                        <input type="number" min="1.1" max="100" step="0.05" value={upgraderMultiplier} onChange={e => setUpgraderMultiplier(parseFloat(e.target.value) || 1.1)} className="w-full bg-[#131a29] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-black focus:border-[#8b5cf6] outline-none" />
                        <span className="absolute right-3 text-xs text-gray-400">x</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#131a29] border border-white/5">
                      <span className="text-xs font-black text-white">Auto Random</span>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input type="checkbox" checked={upgraderRandom} onChange={e => setUpgraderRandom(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8b5cf6]"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#131a29] border border-white/5">
                      <span className="text-xs font-black text-white">Auto Sell</span>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input type="checkbox" checked={upgraderAutoSell} onChange={e => setUpgraderAutoSell(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8b5cf6]"></div>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#9aa3a8] truncate flex-1">{upgraderFeedback}</span>
                      <button onClick={executeUpgraderPlay} type="button" className="shrink-0 px-4 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-black rounded-lg transition active:scale-95 cursor-pointer">Play</button>
                    </div>
                  </div>
                </div>

                {/* Auto Battle */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-[20px] font-bold italic text-white">Auto Battle</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${battleActive ? 'bg-[#acff46]/10 border border-[#acff46]/30 text-[#acff46]' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>{battleActive ? 'Active' : 'Disabled'}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input type="checkbox" checked={battleActive} onChange={e => setBattleActive(e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#acff46]"></div>
                    </label>
                  </div>
                  <div className="flex flex-col gap-3 rounded-[12px] bg-[#0e131f] p-[20px] border border-white/[0.03]">
                    <label className="px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 bg-[#131a29] border border-white/[0.06] cursor-pointer select-none">
                      <span className="font-semibold text-xs text-white">Borrow Tokens</span>
                      <input type="checkbox" checked={battleBorrow} onChange={e => setBattleBorrow(e.target.checked)} className="sr-only peer" />
                      <div className="relative w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8b5cf6]"></div>
                    </label>
                    <label className="px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 bg-[#131a29] border border-white/[0.06] cursor-pointer select-none">
                      <span className="font-semibold text-xs text-white">50/50 Crazy Mode</span>
                      <input type="checkbox" checked={battleCrazy} onChange={e => setBattleCrazy(e.target.checked)} className="sr-only peer" />
                      <div className="relative w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8b5cf6]"></div>
                    </label>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#131a29] border border-white/5">
                      <span className="text-[11px] font-semibold text-[#9aa3a8]">Modifiers</span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-[11px] font-extrabold text-yellow-400">JACKPOT</span>
                        <span className="px-2 py-0.5 rounded bg-[#acff46]/10 border border-[#acff46]/20 text-[11px] font-extrabold text-[#acff46]">3v3</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-[#9aa3a8] truncate flex-1">{battleFeedback}</span>
                      <button onClick={executeBattleCreate} type="button" className="shrink-0 px-4 py-2 bg-[#acff46] hover:brightness-110 text-[#121418] text-xs font-bold rounded-lg transition active:scale-95 cursor-pointer">Create</button>
                    </div>
                  </div>
                </div>

                {/* Auto Mines */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-[20px] font-black italic text-white">Auto Mines</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${minesActive ? 'bg-[#acff46]/10 border border-[#acff46]/30 text-[#acff46]' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>{minesActive ? 'Active' : 'Disabled'}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input type="checkbox" checked={minesActive} onChange={e => setMinesActive(e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#acff46]"></div>
                    </label>
                  </div>
                  <div className="flex flex-col gap-3 rounded-[12px] bg-[#0e131f] p-[20px] border border-white/[0.03]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#9aa3a8] truncate flex-1">{minesFeedback}</span>
                      <button onClick={executeMinesPlay} type="button" className="shrink-0 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-black rounded-lg transition active:scale-95 cursor-pointer">Play</button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ════ RAINS TAB ════ */}
        {sideTab === 'rains' && (
          <div className="flex w-full justify-center pb-[40px] pt-[35px]">
            <div className="flex w-full max-w-[1100px] mx-auto flex-col items-center gap-[28px] px-6">
              <div className="flex w-full items-center justify-between shrink-0">
                <h1 className="text-[25px] tracking-[0.5px] text-white font-bold italic">Rains</h1>
                <button
                  onClick={toggleRainBot}
                  type="button"
                  className={` lex items-center gap-[8px] h-[36px] rounded-[9px] px-[16px] font-bold text-[13px] transition cursor-pointer border ${rainBotActive ? 'bg-[#acff46] text-[#121418] border-[#acff46]' : 'bg-transparent text-[#9aa3a8] border-white/10 hover:border-[#acff46]/40 hover:text-white'} `}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l14 9-14 9V3z"/></svg>
                  {rainBotActive ? 'Bot Running' : 'Start Rain Bot'}
                  {rainBotActive && <span className="ml-1 h-2 w-2 rounded-full bg-[#121418] animate-pulse inline-block" />}
                </button>
              </div>
              {/* Live rain cycle banner */}
              {rainCycle && (
                <div className="flex items-center justify-between rounded-[12px] border border-[#acff46]/20 bg-[#acff46]/5 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold text-[#acff46] uppercase tracking-wider">Live Rain Cycle</span>
                      <span className="text-[22px] font-black text-white font-mono">{rainCycle.potBux.toFixed(2)} BUX pot</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] text-[#9aa3a8]">Time remaining</span>
                    <span className="text-[20px] font-black text-white font-mono">
                      {String(Math.floor(rainCycle.secondsLeft / 60)).padStart(2,'0')}:{String(rainCycle.secondsLeft % 60).padStart(2,'0')}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex w-full flex-col gap-[16px]">
                <div className="flex w-full items-center justify-between">
                  <p className="text-[20px] font-bold italic text-white">Rain History</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setRainTxs([]); setRains([]); showToast('Rain history cleared'); }} type="button" className="flex h-[30px] items-center justify-center rounded-[7px] px-[12px] bg-[#acff46] text-[#121418] font-bold text-[12px] hover:brightness-110 active:scale-95 transition cursor-pointer">Clear</button>
                    <span className="text-[13px] text-[#9aa3a8]">{rainTxs.length} rains earned</span>
                  </div>
                </div>
                <div className="custom-scroll w-full overflow-x-auto overflow-y-hidden">
                  <div className="relative w-full min-w-[650px] rounded-[12px] border border-white/[0.03] overflow-hidden bg-[#0e131f]" style={{ minHeight: 164 }}>
                    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_40px] items-center gap-[12px] px-[16px] py-[14px] text-[13px] font-semibold text-[#9aa3a8] border-b border-white/[0.04]">
                      <div>Account</div>
                      <div className="text-center">Time Left</div>
                      <div className="text-center">Amount</div>
                      <div className="text-right pr-2">Time</div>
                      <div className="text-center"></div>
                    </div>
                    <div className="flex flex-col divide-y divide-white/[0.02]">
                      {rainTxs.length === 0 ? (
                        <div className="flex h-[120px] items-center justify-center px-[32px] text-center">
                          <p className="text-[13px] text-[#9aa3a8]">No rain transactions yet. The rain bot will sync transactions automatically.</p>
                        </div>
                      ) : rainTxs.map((tx, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_40px] items-center gap-[12px] px-[16px] py-[10px] hover:bg-white/[0.02] group">
                          <span className="truncate text-[14px] font-bold italic text-white">{tx.account || user.username}</span>
                          <span className="text-center text-[13px] font-semibold" style={{ color: 'rgb(255, 107, 107)' }}>Completed</span>
                          <span className="text-center text-[14px] font-bold italic text-[#c2c6db]">+{formatBuxValue(tx.amount_bux || 0)}</span>
                          <span className="text-right pr-2">
                            <span className="inline-flex h-[24px] items-center rounded-[6px] px-[8px] text-[12px] font-semibold text-[#50f07b] bg-[rgba(80,240,123,0.12)]">
                              {tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </span>
                          </span>
                          <span className="flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => deleteRainTx(tx.timestamp, i)}
                              className="flex items-center justify-center size-[26px] rounded-[6px] text-[#ff4b4b] hover:bg-[#ff4b4b]/20 hover:text-white transition active:scale-90 cursor-pointer"
                              title="Delete this rain"
                            >
                              <svg className="size-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Discord Tab ── */}
        {sideTab === 'discord' && (
          <div className="flex w-full justify-center pb-[40px] pt-[35px]">
            <div className="flex w-full max-w-[1100px] mx-auto flex-col items-center gap-[28px] px-6">
              <div className="flex w-full items-center justify-between shrink-0">
                <div className="flex flex-col gap-1">
                  <h1 className="text-[25px] tracking-[0.5px] text-white font-bold italic">Discord Integration</h1>
                  <p className="text-[13px] text-[#9aa3a8]">Connect your Discord account to manage automated giveaways</p>
                </div>
              </div>

              {!discordUser ? (
                /* Login / Token Input Card Centered */
                <div className="flex w-full flex-col items-center justify-center pt-8 pb-12">
                  <div className="flex w-full max-w-[540px] flex-col gap-5 rounded-[16px] border border-white/[0.06] bg-[#0e131f] p-7 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/30 text-[#5865F2]">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-[17px] font-bold text-white">Discord Authorization</h2>
                      <p className="text-[12px] text-[#9aa3a8]">Enter your Discord user token to log in</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[12px] font-bold uppercase tracking-wider text-[#9aa3a8]">Discord Token</label>
                    <input
                      type="password"
                      value={discordTokenInput}
                      onChange={(e) => setDiscordTokenInput(e.target.value)}
                      placeholder="Paste your Discord token here..."
                      className="h-[44px] w-full rounded-[10px] border border-white/10 bg-[#131a29] px-4 text-[13px] text-white placeholder-white/20 outline-none focus:border-[#5865F2] transition"
                    />
                  </div>

                  {discordError && (
                    <div className="rounded-[8px] border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
                      {discordError}
                    </div>
                  )}

                  <button
                    onClick={() => handleDiscordLogin()}
                    disabled={discordLoading}
                    type="button"
                    className="flex h-[42px] items-center justify-center rounded-[10px] bg-[#5865F2] font-bold text-[14px] text-white hover:brightness-110 active:scale-98 transition disabled:opacity-50 cursor-pointer"
                  >
                    {discordLoading ? 'Connecting...' : 'Connect Discord Account'}
                  </button>
                  </div>
                </div>
              ) : (
                /* Logged In Dashboard with User Info and Toggles */
                <div className="flex w-full flex-col gap-6 max-w-[900px] mx-auto">
                  {/* User Profile Card */}
                  <div className="flex w-full items-center justify-between rounded-[16px] border border-white/[0.06] bg-[#0e131f] p-5 shadow-xl">
                    <div className="flex items-center gap-4">
                      {discordUser.avatar ? (
                        <img src={discordUser.avatar} alt="" className="h-[52px] w-[52px] rounded-full border border-white/10 object-cover" />
                      ) : (
                        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#5865F2] font-bold text-[20px] text-white">
                          {(discordUser.username?.[0] || 'D').toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-[18px] font-bold text-white">{discordUser.global_name || discordUser.username}</span>
                          <span className="rounded bg-[#5865F2]/20 px-2 py-0.5 text-[11px] font-semibold text-[#5865F2]">Connected</span>
                        </div>
                        <span className="text-[13px] text-[#9aa3a8]">@{discordUser.username} {discordUser.discriminator && discordUser.discriminator !== '0' ? `#${discordUser.discriminator}` : ''}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleDiscordLogout}
                      type="button"
                      className="flex h-[36px] items-center justify-center rounded-[8px] border border-white/10 bg-transparent px-4 text-[13px] font-semibold text-[#9aa3a8] hover:border-red-500/40 hover:text-red-400 transition cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>

                  {/* Giveaways Control Sections */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
                    {/* Auto Join Giveaway Card */}
                    <div className="flex flex-col justify-between gap-4 rounded-[16px] border border-white/[0.06] bg-[#0e131f] p-6 shadow-xl">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#acff46]/10 text-[#acff46]">
                              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </span>
                            <h3 className="text-[16px] font-bold text-white">Auto Join Giveaway</h3>
                          </div>
                          {/* Toggle */}
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={autoJoinGiveaway}
                              onChange={(e) => handleToggleAutoJoin(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#acff46]"></div>
                          </label>
                        </div>
                        <p className="text-[13px] text-[#9aa3a8] leading-relaxed">
                          Automatically reacts to or enters newly announced giveaways across configured channels.
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                        <span className="text-[12px] font-semibold text-[#9aa3a8]">Status</span>
                        <span className={`text-[12px] font-bold ${autoJoinGiveaway ? 'text-[#acff46]' : 'text-[#9aa3a8]'}`}>
                          {autoJoinGiveaway ? 'Active & Watching (Channel #1564378251575562300)' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    {/* Auto Claim Giveaway Card */}
                    <div className="flex flex-col justify-between gap-4 rounded-[16px] border border-white/[0.06] bg-[#0e131f] p-6 shadow-xl">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#5865F2]/10 text-[#5865F2]">
                              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                            <h3 className="text-[16px] font-bold text-white">Auto Claim Giveaway</h3>
                          </div>
                          {/* Toggle */}
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={autoClaimGiveaway}
                              onChange={(e) => handleToggleAutoClaim(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865F2]"></div>
                          </label>
                        </div>
                        <p className="text-[13px] text-[#9aa3a8] leading-relaxed">
                          Instantly claims winning notifications or promo-code drops when your account is tagged.
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                        <span className="text-[12px] font-semibold text-[#9aa3a8]">Status</span>
                        <span className={`text-[12px] font-bold ${autoClaimGiveaway ? 'text-[#5865F2]' : 'text-[#9aa3a8]'}`}>
                          {autoClaimGiveaway ? 'Active & Monitoring' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Discord Giveaway Activity Feed */}
                  {(autoJoinGiveaway || autoClaimGiveaway) && (
                    <div className="flex flex-col gap-3 rounded-[16px] border border-white/[0.06] bg-[#0e131f] p-5 shadow-xl w-full">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#acff46] animate-pulse"></span>
                          <span className="text-[14px] font-bold text-white">Giveaway Bot Logs</span>
                        </div>
                        <span className="text-[12px] text-[#9aa3a8]">Listening to channel #1564378251575562300</span>
                      </div>
                      <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {discordGwLogs.length === 0 ? (
                          <div className="py-2 text-[12px] text-[#9aa3a8]/60 italic">Waiting for giveaways to appear in channel...</div>
                        ) : (
                          discordGwLogs.map((log, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-[12px]">
                              <span className="text-[#9aa3a8]/50 shrink-0 font-mono">[{log.time}]</span>
                              <span className={log.type === 'success' ? 'text-[#acff46] font-medium' : log.type === 'error' ? 'text-red-400 font-medium' : log.type === 'warn' ? 'text-yellow-400' : 'text-[#c0c6cf]'}>
                                {log.message}
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* 24h Recap Cards Header & Clear Button */}
                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] mt-1">
                        <span className="text-[12px] font-semibold text-[#9aa3a8]">Giveaway Stats</span>
                        <button
                          type="button"
                          onClick={() => {
                            const reset = { joined: 0, won: 0, lost: 0, date: Date.now() }
                            setGwStats(reset)
                            window.localStorage.setItem('sotarium_gw_stats_24h', JSON.stringify(reset))
                            setDiscordGwLogs([])
                            showToast('Giveaway stats cleared')
                          }}
                          className="flex h-[24px] items-center justify-center rounded-[6px] px-[10px] bg-white/[0.06] hover:bg-[#acff46] hover:text-[#121418] text-[#9aa3a8] font-bold text-[11px] transition active:scale-95 cursor-pointer"
                        >
                          Clear Stats
                        </button>
                      </div>

                      {/* 24h Recap Cards */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="flex flex-col items-center justify-center py-2 px-3 rounded-[10px] bg-white/[0.03] border border-white/[0.04]">
                          <span className="text-[11px] font-medium text-[#9aa3a8] uppercase tracking-wider">Joined</span>
                          <span className="text-[16px] font-bold text-white mt-0.5">{gwStats.joined}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center py-2 px-3 rounded-[10px] bg-[#acff46]/[0.04] border border-[#acff46]/10">
                          <span className="text-[11px] font-medium text-[#acff46] uppercase tracking-wider">Won</span>
                          <span className="text-[16px] font-bold text-[#acff46] mt-0.5">{gwStats.won}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center py-2 px-3 rounded-[10px] bg-red-500/[0.04] border border-red-500/10">
                          <span className="text-[11px] font-medium text-red-400 uppercase tracking-wider">Lost</span>
                          <span className="text-[16px] font-bold text-red-400 mt-0.5">{gwStats.lost}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function DesktopApp() {
  const CURRENT_APP_VERSION = '1.0.18'
  const [showUpdate, setShowUpdate] = useState(false)
  const [latestVersion, setLatestVersion] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [loadingInitial, setLoadingInitial] = useState(true)

  const registeredToken = window.localStorage.getItem('sotarium_registered_token')

  // Check for a real new version via Electron IPC (main process hits GitHub API)
  useEffect(() => {
    const checkForUpdate = async () => {
      try {
        let updateAvailable = false
        let latest = ''

        if (window.electronAPI?.checkForUpdate) {
          // Running as packaged .exe — use main-process IPC
          const result = await window.electronAPI.checkForUpdate()
          updateAvailable = !!result?.updateAvailable
          latest = result?.latestVersion || ''
        } else {
          // Running in browser/dev — fall back to direct GitHub fetch
          const res = await fetch('https://api.github.com/repos/Sotarium/Cue/releases/latest')
          if (res.ok) {
            const data = await res.json()
            latest = (data.tag_name || '').replace(/^v/, '').trim()
            updateAvailable = latest && latest !== CURRENT_APP_VERSION
          }
        }

        if (updateAvailable && latest) {
          setLatestVersion(latest)
          setShowUpdate(true)
        }
      } catch (e) {
        // Offline or rate-limited — skip silently
      }
    }
    checkForUpdate()
    // Poll every 2 minutes while app is running so update screen triggers even if already open
    const pollInterval = setInterval(checkForUpdate, 2 * 60 * 1000)
    return () => clearInterval(pollInterval)
  }, [])

  useEffect(() => {
    const token = window.localStorage.getItem('sotarium_session_token')
    const cachedProfile = window.localStorage.getItem('sotarium_user_profile')

    if (token) {
      if (cachedProfile) {
        try {
          setCurrentUser(JSON.parse(cachedProfile))
          setLoadingInitial(false)
          return
        } catch (e) {}
      }

      authenticateToken(token).then((res) => {
        if (res.success) {
          setCurrentUser(res.user)
          window.localStorage.setItem('sotarium_user_profile', JSON.stringify(res.user))
        } else {
          window.localStorage.removeItem('sotarium_session_token')
        }
        setLoadingInitial(false)
      })
    } else {
      setLoadingInitial(false)
    }
  }, [])

  const handleLogout = () => {
    window.localStorage.removeItem('sotarium_session_token')
    window.localStorage.removeItem('sotarium_user_profile')
    setCurrentUser(null)
  }

  if (showUpdate) {
    return (
      <UpdateDetectedScreen
        latestVersion={latestVersion}
        onSkip={() => setShowUpdate(false)}
      />
    )
  }

  if (loadingInitial) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#242424', color: '#888' }}>
        Loading Sotarium…
      </div>
    )
  }

  if (!currentUser) {
    return (
      <CueAuthPage
        onAuthSuccess={(user) => setCurrentUser(user)}
      />
    )
  }

  return <RollbuxDashboard user={currentUser} onLogout={handleLogout} />
}

function App() {
  const isDesktopApp = window.location.protocol === 'file:' || window.location.pathname === '/app' || !!window.electronAPI

  if (!isDesktopApp) {
    return <DownloadPage />
  }

  return <DesktopApp />
}

createRoot(document.getElementById('root')).render(<App />)
