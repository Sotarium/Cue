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

    const data = await res.json()
    const user = data.data?.user || data.data || data.user || data
    return {
      success: true,
      user: {
        username: user.username || user.name || 'Player',
        level: user.level !== undefined ? user.level : (user.tier || 1),
        token_balance: user.token_balance || 0,
        avatar: user.avatar_url || user.avatar || null,
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
        <img src={brandIconBase64} alt="Sotarium" style={{ width: 64, height: 64, marginBottom: 16 }} />
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Sotarium</h1>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>Personal Rollbux Automation Workspace</p>
        <a className="download-button" href="https://github.com/Sotarium/Cue/releases/latest/download/Sotarium.exe">Download for Windows</a>
      </div>
    </main>
  )
}

function CueAuthPage({ onAuthSuccess, initialMode = 'signup', registeredToken = null }) {
  const [mode, setMode] = useState(initialMode)
  const [sessionCookie, setSessionCookie] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const tokenToUse = sessionCookie.trim()
    if (!tokenToUse) {
      setError('Please enter your authjs.session-token')
      return
    }

    if (mode === 'signup' && registeredToken) {
      setMode('login')
      showToast('You Already Have An Account.')
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

      {toast && <div className="toast-notice">{toast}</div>}

      <div className="cue-auth-box">
        <div className="cue-brand-header">
          <img
            src={brandIconBase64}
            alt="Sotarium"
            className="sotarium-brand-icon-img"
          />
          <span className="cue-brand-wordmark">Sotarium</span>
        </div>

        <h1 className="cue-auth-title">{mode === 'signup' ? 'Sign up' : 'Log in'}</h1>

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

        <button
          type="button"
          className="cue-mode-switch"
          onClick={() => {
            setMode(mode === 'signup' ? 'login' : 'signup')
            setError('')
          }}
        >
          {mode === 'signup' ? 'Already have an account? Log in' : 'Need an account? Sign up'}
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Fullscreen "Update Detected." Blocking View
// ============================================================================

function UpdateDetectedScreen({ onComplete }) {
  const [updating, setUpdating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isDone, setIsDone] = useState(false)

  const handleStartUpdate = () => {
    setUpdating(true)
    let current = 0

    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 8) + 4
      if (current >= 100) {
        current = 100
        setProgress(100)
        clearInterval(interval)
        setIsDone(true)
        setTimeout(() => {
          onComplete()
        }, 1400)
      } else {
        setProgress(current)
      }
    }, 120)
  }

  return (
    <div className="update-fullscreen-overlay">
      <div style={{ position: 'fixed', top: 0, left: 0, right: 140, height: 32, WebkitAppRegion: 'drag', zIndex: 100 }} />

      <div className="update-screen-card">
        {isDone ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, animation: 'toastSlideDown 0.3s ease-out' }}>
            <img
              src={checkIconBase64}
              alt="Updated"
              style={{ width: 72, height: 72, objectFit: 'contain' }}
            />
            <h1 className="update-screen-title" style={{ fontSize: 24, fontStyle: 'normal' }}>
              Updated Sotarium
            </h1>
          </div>
        ) : (
          <>
            <img
              src={brandIconBase64}
              alt="Sotarium Icon"
              style={{ width: 68, height: 68, objectFit: 'contain' }}
            />

            <div>
              <h1 className="update-screen-title">Update Detected.</h1>
              <p className="update-screen-desc" style={{ marginTop: 6 }}>
                A new version or missing resources were detected for your client. Update now to sync the latest files without reinstalling.
              </p>
            </div>

            {!updating ? (
              <button className="update-white-button" onClick={handleStartUpdate}>
                Update
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%', marginTop: 12 }}>
                <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 9999, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${progress}%`,
                      background: '#ffffff',
                      transition: 'width 0.15s ease'
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RollbuxDashboard({ user, onLogout }) {
  const [currentUnit, setCurrentUnit] = useState('BUX')
  const [toast, setToast] = useState('')
  const [activeTab, setActiveTab] = useState('24h')
  const [sideTab, setSideTab] = useState('home') // 'home' | 'automations' | 'rains'

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

  // Data state
  const [rains, setRains] = useState([])
  const [gameHistory, setGameHistory] = useState([])
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const sessionToken = window.localStorage.getItem('sotarium_session_token') || ''

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Fetch rain data: live cycle (public) + user transactions from backend
  const [rainCycle, setRainCycle] = useState(null) // { secondsLeft, potBux }
  const [rainTxs, setRainTxs] = useState([])       // actual earned rain transactions

  const fetchRains = async () => {
    // 1. Live cycle — public endpoint
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

    // 2. User transactions from backend (rain history)
    try {
      if (window.electronAPI?.backendCall) {
        const res = await window.electronAPI.backendCall({
          endpoint: `/api/user/${encodeURIComponent(user.username)}`,
          method: 'GET',
          body: null
        })
        if (res.ok && res.data?.user) {
          const txs = res.data.user.transactions || []
          setRainTxs(txs.slice(0, 50)) // keep last 50
          // update overview counts
          setRains(txs.map((t, i) => ({
            id: t.cycle_id || i,
            amount: t.amount_bux || 0,
            ends_at: t.timestamp,
            account: t.account || user.username
          })))
        }
      }
    } catch (e) {}
  }

  useEffect(() => {
    fetchRains()
    const interval = setInterval(fetchRains, 15000)
    return () => clearInterval(interval)
  }, [])

  // Live level polling — scrape /profile every 60 seconds
  const [liveLevel, setLiveLevel] = useState(user.level)
  useEffect(() => {
    const token = window.localStorage.getItem('sotarium_session_token') || ''
    const doFetch = async () => {
      if (window.electronAPI?.fetchLevel) {
        const res = await window.electronAPI.fetchLevel(token)
        if (res.ok && res.level !== null) setLiveLevel(res.level)
      }
    }
    doFetch()
    const interval = setInterval(doFetch, 60000)
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
    setBattleFeedback('Creating 3v3 battle...')
    try {
      const res = await window.electronAPI.backendCall({
        endpoint: '/api/battles/create',
        method: 'POST',
        body: {
          username: user.username,
          borrow: battleBorrow,
          crazy_mode: battleCrazy,
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
        setGameHistory(prev => [{
          mode: 'Battle',
          success: false,
          account: user.username,
          amount: '0.00',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }, ...prev])
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

  const formatValue = (microTokens) => {
    const bux = microTokens ? microTokens / 1000000 : 0
    if (currentUnit === 'USD') return `$${(bux * 0.01).toFixed(2)}`
    if (currentUnit === 'SOL') return `${(bux * 0.0001).toFixed(4)}`
    return bux.toFixed(2)
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
  ]

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: '#121418' }} className="selection:bg-[#acff46] selection:text-[#0e131f]">
      {/* Drag region for frameless window */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 140, height: 32, WebkitAppRegion: 'drag', zIndex: 9999 }} />

      {/* Toast */}
      {toast && <div className="toast-notice">{toast}</div>}

      {/* ── Left sidebar nav ── */}
      <div style={{ width: 220, minWidth: 220, flexShrink: 0, background: '#0b0e17', borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingTop: 44, paddingBottom: 24, paddingLeft: 12, paddingRight: 12, gap: 4 }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 16 }}>
          <img src={brandIconBase64} alt="Sotarium" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          <span style={{ fontSize: 15, fontWeight: 900, fontStyle: 'italic', color: '#fff', letterSpacing: '-0.3px' }}>Sotarium</span>
        </div>

        {/* Nav items */}
        {['home', 'automations', 'rains'].map(id => (
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
            {sideTab === id && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#acff46', display: 'block' }} />}
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
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(172,255,70,0.15)', border: '1px solid rgba(172,255,70,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#acff46' }}>{(user.username?.[0] || 'S').toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</span>
              <span style={{ fontSize: 10, color: '#9aa3a8' }}>Lvl {liveLevel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', height: '100vh' }}>

        {/* ════ HOME TAB ════ */}
        {sideTab === 'home' && (
          <div className="flex w-full justify-center pb-[40px] pt-[35px]">
            <div className="flex w-full max-w-[1400px] flex-col items-start gap-[28px] px-6">

              {/* Header */}
              <h1 className="whitespace-nowrap text-[25px] tracking-[0.5px] text-white font-bold italic">{user.username}</h1>

                {/* Content */}
                <div className="flex w-full flex-col items-start gap-[24px]">

                  {/* Overview */}
                  <div className="flex w-full flex-col gap-[16px]">
                    <div className="flex w-full items-center justify-between gap-3">
                      <p className="text-[20px] font-bold italic text-white">Overview</p>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1 bg-[#131a29] p-1 rounded-md border border-white/[0.04]">
                          {[
                            { id: 'BUX', icon: './figma/token-bux.png' },
                            { id: 'USD', icon: './figma/token-usd.svg' },
                            { id: 'SOL', icon: './figma/af-coin-24.svg' },
                          ].map(({ id, icon }) => (
                            <button key={id} onClick={() => setCurrentUnit(id)} type="button"
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${currentUnit === id ? 'bg-[#acff46] text-[#121418]' : 'text-[#9aa3a8] hover:text-white'}`}>
                              <img src={icon} alt={id} style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0 }} />
                              {id}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => showToast('Overview metrics reset')} type="button" className="flex h-[32px] items-center justify-center rounded-[7px] px-[14px] bg-[#acff46] text-[#121418] font-bold text-[13px] hover:brightness-110 active:scale-95 transition cursor-pointer">Clear</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px] w-full">
                      <div className="relative flex w-full flex-col gap-[6px] rounded-[12px] px-[20px] py-[16px] border border-white/[0.03] bg-[#0e131f]">
                        <p className="text-[14px] font-medium text-[#9aa3a8]">Rains Joined</p>
                        <p className="text-[20px] font-bold text-white">0 Rains</p>
                      </div>
                      <div className="relative flex w-full flex-col gap-[6px] rounded-[12px] px-[20px] py-[16px] border border-white/[0.03] bg-[#0e131f]">
                        <p className="text-[14px] font-medium text-[#9aa3a8]">How Much Time</p>
                        <p className="text-[20px] font-bold text-white">0S</p>
                      </div>
                      <div className="relative flex w-full flex-col gap-[6px] rounded-[12px] px-[20px] py-[16px] border border-white/[0.03] bg-[#0e131f]">
                        <p className="text-[14px] font-medium text-[#9aa3a8]">Total Earnings</p>
                        <div className="flex items-center gap-[8px]">
                          <img alt="" className="size-[24px]" src="./figma/af-coin-24.svg" />
                          <p className="text-[20px] font-bold text-white">0.00</p>
                        </div>
                      </div>
                      <div className="relative flex w-full items-center justify-between gap-[12px] rounded-[12px] border border-[rgba(172,255,70,0.12)] px-[20px] py-[16px] bg-[#0e131f]">
                        <div className="flex min-w-0 flex-col gap-[6px]">
                          <p className="text-[14px] font-medium text-[#acff46]">Current Balance</p>
                          <div className="flex items-center gap-[8px]">
                            <img alt="" className="size-[24px]" src="./figma/af-coin-24.svg" />
                            <p className="text-[20px] font-bold text-white">{formatValue(user.token_balance)}</p>
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
                          <div className="absolute left-0 top-0 flex flex-col items-start justify-between h-[330px] text-[12px] font-bold text-[#6d7680]">
                            <p>100</p><p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p><p className="text-white font-bold">0</p>
                          </div>
                          <div className="absolute cursor-crosshair" style={{ left: 56, top: 9, width: 'calc(100% - 56px)', height: 330 }}>
                            <svg className="absolute inset-0 size-full" viewBox="0 0 744 330" preserveAspectRatio="none">
                              <line x1="0" y1="20" x2="744" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                              <line x1="0" y1="130" x2="744" y2="130" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                              <line x1="0" y1="240" x2="744" y2="240" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                              <path d="M 0 330 L 744 330" fill="none" stroke="#7974FF" strokeWidth="2.5" />
                            </svg>
                          </div>
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
                              <span className="text-center text-[13px] font-bold text-[#c2c6db]">{item.amount} BUX</span>
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
            <div className="flex w-full max-w-[1400px] flex-col items-start gap-[28px] px-6">
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
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#131a29] border border-white/5">
                      <span className="text-[11px] font-semibold text-[#9aa3a8]">Account</span>
                      <button type="button" className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#7c3aed] text-white text-xs font-black">All Accounts</button>
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
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#131a29] border border-white/5">
                      <span className="text-[11px] font-semibold text-[#9aa3a8]">Account</span>
                      <button type="button" className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#7c3aed] text-white text-xs font-black">2 Accs</button>
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
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#131a29] border border-white/5">
                      <span className="text-[11px] font-semibold text-[#9aa3a8]">Account</span>
                      <button type="button" className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#7c3aed] text-white text-xs font-black">All Accounts</button>
                    </div>
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
            <div className="flex w-full max-w-[1400px] flex-col items-start gap-[28px] px-6">
              <div className="flex shrink-0 flex-col items-start gap-[6px]">

                <h1 className="text-[25px] tracking-[0.5px] text-white font-bold italic">Rains</h1>
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
                  <div className="relative w-full min-w-[600px] rounded-[12px] border border-white/[0.03] overflow-hidden bg-[#0e131f]" style={{ minHeight: 164 }}>
                    <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-[12px] px-[16px] py-[14px] text-[13px] font-semibold text-[#9aa3a8] border-b border-white/[0.04]">
                      <div>Account</div><div className="text-center">Amount</div><div className="text-right pr-2">Time</div>
                    </div>
                    <div className="flex flex-col divide-y divide-white/[0.02]">
                      {rainTxs.length === 0 ? (
                        <div className="flex h-[120px] items-center justify-center px-[32px] text-center">
                          <p className="text-[13px] text-[#9aa3a8]">No rain transactions yet. Syncing from backend every 15s...</p>
                        </div>
                      ) : rainTxs.map((tx, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-[12px] px-[16px] py-[10px] hover:bg-white/[0.02]">
                          <span className="truncate text-[14px] font-bold italic text-[#acff46]">{tx.account || user.username}</span>
                          <span className="text-center text-[14px] font-bold text-white">+{(tx.amount_bux || 0).toFixed(2)} BUX</span>
                          <span className="text-right pr-2 text-[12px] text-[#9aa3a8]">{tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function DesktopApp() {
  const [hasUpdated, setHasUpdated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [loadingInitial, setLoadingInitial] = useState(true)

  const registeredToken = window.localStorage.getItem('sotarium_registered_token')

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

  if (!hasUpdated) {
    return (
      <UpdateDetectedScreen
        onComplete={() => {
          setHasUpdated(true)
        }}
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
        initialMode={registeredToken ? 'login' : 'signup'}
        registeredToken={registeredToken}
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
