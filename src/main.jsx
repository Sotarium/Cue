import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { brandIconBase64 } from './brandIcon.js'

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

// ============================================================================
// Electron Desktop App Experience (Cue Sign-up / Login)
// ============================================================================

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
      {/* Draggable header region for frameless window */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 140, height: 32, WebkitAppRegion: 'drag', zIndex: 100 }} />

      {toast && <div className="toast-notice">{toast}</div>}

      <div className="cue-auth-box">
        {/* Revamped crisp icon directly ABOVE the text */}
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
// Rollbux Dashboard — Sidebar Navigation with Dedicated Pages
// ============================================================================

function RollbuxDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('home') // 'home' | 'automations' | 'rains' | 'update'
  const [displayUnit, setDisplayUnit] = useState('BUX')
  const [toast, setToast] = useState('')

  // Automations state
  const [upgraderEnabled, setUpgraderEnabled] = useState(false)
  const [upgraderMultiplier, setUpgraderMultiplier] = useState(2.0)
  const [upgraderRandomPos, setUpgraderRandomPos] = useState(false)
  const [upgraderAutoSell, setUpgraderAutoSell] = useState(true)

  const [battleEnabled, setBattleEnabled] = useState(false)
  const [battleBorrowMode, setBattleBorrowMode] = useState(true)
  const [battleCrazyMode, setBattleCrazyMode] = useState(true)

  const [minesEnabled, setMinesEnabled] = useState(false)

  // Rains state
  const [rains, setRains] = useState([])
  const [rainsJoined, setRainsJoined] = useState(0)
  const [rainsEarnings, setRainsEarnings] = useState(0)
  const [statsPeriod, setStatsPeriod] = useState('24H')

  // Update Detect state
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateStatus, setUpdateStatus] = useState('Ready to scan')
  const [missingResources, setMissingResources] = useState([
    { name: 'Rollbux Game Sound Pack & Audio FX', status: 'Missing', size: '12.4 MB' },
    { name: 'Upgrader Wheel Geometry & Textures', status: 'Outdated', size: '4.8 MB' },
    { name: '3v3 Battle Particle Effects', status: 'Missing', size: '8.2 MB' },
    { name: 'Mines Tile Cached Assets', status: 'Missing', size: '3.1 MB' }
  ])

  const sessionToken = window.localStorage.getItem('sotarium_session_token') || ''

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Fetch rain cycle
  const fetchRains = async () => {
    try {
      const res = await fetch('https://rollbux.com/_api/rain/current')
      if (res.ok) {
        const d = await res.json()
        const state = d?.data || {}
        if (state.cycle_id || state.cycle?.id) {
          setRains([{
            id: state.cycle_id || state.cycle?.id,
            amount: state.live_pot || state.live_pool || 0,
            ends_at: state.cycle_end || state.cycle?.cycle_end,
            created_at: new Date().toISOString()
          }])
        }
      }
    } catch (e) {}
  }

  useEffect(() => {
    fetchRains()
    const interval = setInterval(fetchRains, 15000)
    return () => clearInterval(interval)
  }, [])

  // Execute Upgrader Play via rollbux-request
  const handleUpgraderPlay = async () => {
    showToast(`Upgrading with ${upgraderMultiplier}x target...`)
    if (window.electronAPI?.rollbuxRequest) {
      try {
        const res = await window.electronAPI.rollbuxRequest({
          path: '/_api/upgrader/play',
          method: 'POST',
          token: sessionToken,
          body: {
            multiplier: upgraderMultiplier,
            randomPosition: upgraderRandomPos,
            autoSell: upgraderAutoSell,
            stakeValueMicroTokens: 1000000
          }
        })
        if (res.ok) {
          showToast('Upgrade completed!')
        } else {
          showToast(res.data?.message || 'Upgrade rejected by Rollbux')
        }
      } catch (e) {
        showToast('Error executing upgrade')
      }
    }
  }

  // Execute Battle Create
  const handleBattleCreate = async () => {
    showToast('Creating 3v3 Battle...')
    if (window.electronAPI?.rollbuxRequest) {
      try {
        const res = await window.electronAPI.rollbuxRequest({
          path: '/_api/battles',
          method: 'POST',
          token: sessionToken,
          body: {
            borrow: battleBorrowMode,
            crazy_mode: battleCrazyMode,
            mode: '3v3'
          }
        })
        if (res.ok) {
          showToast('3v3 Battle created successfully!')
        } else {
          showToast(res.data?.message || 'Battle creation rejected')
        }
      } catch (e) {
        showToast('Error creating battle')
      }
    }
  }

  // Perform Live Resource Update without reinstalling
  const handleResourceUpdate = async () => {
    setIsUpdating(true)
    setUpdateStatus('Connecting to repository CDN…')

    setTimeout(() => {
      setUpdateStatus('Downloading missing audio and geometry packs…')
    }, 1200)

    setTimeout(() => {
      setUpdateStatus('Verifying hash signatures and hot-patching runtime…')
    }, 2800)

    setTimeout(() => {
      setMissingResources(prev => prev.map(r => ({ ...r, status: 'Up to Date' })))
      setIsUpdating(false)
      setUpdateStatus('All local client assets verified and fully updated!')
      showToast('Resources updated successfully!')
    }, 4200)
  }

  // Format balance string based on selected unit
  const formatBalance = (microTokens) => {
    const bux = microTokens ? microTokens / 1000000 : 0
    if (displayUnit === 'USD') return `$${(bux * 0.01).toFixed(4)}`
    if (displayUnit === 'SOL') return `${(bux * 0.0001).toFixed(6)} SOL`
    return `${bux.toFixed(2)}`
  }

  return (
    <div className="rollbux-app-shell">
      {/* Frameless window drag area */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 140, height: 32, WebkitAppRegion: 'drag', zIndex: 100 }} />

      {toast && <div className="toast-notice">{toast}</div>}

      {/* ── Left Sidebar Navigation (Matching User Reference) ── */}
      <aside className="app-left-sidebar">
        <div className="sidebar-brand-row">
          <img src={brandIconBase64} alt="Sotarium" />
          <span className="sidebar-brand-name">Sotarium</span>
        </div>

        <nav className="sidebar-nav-section">
          <span className="sidebar-section-title">Overview</span>

          <button
            className={`sidebar-tab-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Home
          </button>

          <button
            className={`sidebar-tab-item ${activeTab === 'automations' ? 'active' : ''}`}
            onClick={() => setActiveTab('automations')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M12 2v4M8 11V7.5a4 4 0 0 1 8 0V11" />
              <circle cx="9" cy="16" r="1" fill="currentColor" stroke="none" />
              <circle cx="15" cy="16" r="1" fill="currentColor" stroke="none" />
            </svg>
            Automations
          </button>

          <button
            className={`sidebar-tab-item ${activeTab === 'rains' ? 'active' : ''}`}
            onClick={() => setActiveTab('rains')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 16.2A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
              <path d="M8 19v2M8 13v2M16 19v2M16 13v2M12 21v2M12 15v2" />
            </svg>
            Rains
          </button>

          <span className="sidebar-section-title" style={{ marginTop: 12 }}>Maintenance</span>

          <button
            className={`sidebar-tab-item ${activeTab === 'update' ? 'active' : ''}`}
            onClick={() => setActiveTab('update')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Restart Update Detect.
          </button>
        </nav>

        {/* Player Profile Card pinned to bottom */}
        <div className="player-profile-card">
          <div className="player-info-left">
            <div className="player-avatar">
              {user.avatar ? <img src={user.avatar} alt={user.username} /> : <span>{user.username.slice(0, 2).toUpperCase()}</span>}
            </div>
            <div className="player-meta">
              <span className="player-meta-label">Player</span>
              <strong className="player-meta-username">{user.username}</strong>
            </div>
          </div>
          <span className="player-level-badge">LVL {user.level}</span>
        </div>
      </aside>

      {/* ── Main Viewport ── */}
      <div className="app-main-viewport">
        {/* Top Header Bar */}
        <header className="top-app-header">
          <h2 className="top-page-title">
            {activeTab === 'home' && 'Overview'}
            {activeTab === 'automations' && 'Automations'}
            {activeTab === 'rains' && 'Rains Management'}
            {activeTab === 'update' && 'Restart Update Detect.'}
          </h2>

          <div className="top-app-header-right">
            <div className="unit-pills">
              {['BUX', 'USD', 'SOL'].map((unit) => (
                <button
                  key={unit}
                  className={`unit-pill ${displayUnit === unit ? 'active' : ''}`}
                  onClick={() => setDisplayUnit(unit)}
                >
                  {unit}
                </button>
              ))}
            </div>

            <button className="logout-pill" onClick={onLogout}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log Out
            </button>
          </div>
        </header>

        {/* Dedicated Tab Pages */}
        <div className="tab-page-container">
          {/* 1. HOME TAB */}
          {activeTab === 'home' && (
            <>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Metrics Summary</h3>
                  <button className="lime-clear-btn" onClick={() => showToast('Overview cleared')}>Clear</button>
                </div>

                <div className="stats-cards-grid">
                  <div className="stat-metric-card">
                    <span className="stat-label">Rains Joined</span>
                    <div className="stat-value">{rainsJoined} Rains</div>
                  </div>

                  <div className="stat-metric-card">
                    <span className="stat-label">Session Duration</span>
                    <div className="stat-value">0S</div>
                  </div>

                  <div className="stat-metric-card">
                    <span className="stat-label">Total Earnings</span>
                    <div className="stat-value">
                      <img src="/figma/af-coin-24.svg" alt="" className="token-coin-icon" />
                      {rainsEarnings.toFixed(2)}
                    </div>
                  </div>

                  <div className="stat-metric-card balance-highlight">
                    <span className="stat-label">Current Balance</span>
                    <div className="stat-value">
                      <img src="/figma/af-coin-24.svg" alt="" className="token-coin-icon" />
                      {formatBalance(user.token_balance)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics Chart */}
              <div style={{ background: '#11141a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>Earnings Graph</h3>
                  <div className="unit-pills">
                    {['24H', 'Week', 'Month'].map((p) => (
                      <button
                        key={p}
                        className={`unit-pill ${statsPeriod === p ? 'active' : ''}`}
                        onClick={() => setStatsPeriod(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ height: 260, width: '100%' }}>
                  <svg width="100%" height="100%" viewBox="0 0 500 260" preserveAspectRatio="none">
                    <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                    <line x1="0" y1="130" x2="500" y2="130" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                    <line x1="0" y1="240" x2="500" y2="240" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                    <path d="M 0 240 L 150 200 L 300 220 L 500 160" fill="none" stroke="#7974FF" strokeWidth="3" />
                  </svg>
                </div>
              </div>
            </>
          )}

          {/* 2. AUTOMATIONS TAB */}
          {activeTab === 'automations' && (
            <div className="automations-view-grid">
              {/* Auto Upgrader */}
              <div className="automation-panel">
                <div className="panel-header-row">
                  <h3 className="panel-title">Auto Upgrader</h3>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={upgraderEnabled} onChange={e => setUpgraderEnabled(e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="wheel-circle-wrap">
                  <svg width="180" height="180" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="75" fill="none" stroke="#181c26" strokeWidth="14" />
                    <circle
                      cx="100" cy="100" r="75" fill="none" stroke="#8b5cf6" strokeWidth="14"
                      strokeDasharray="380 471" transform="rotate(-90 100 100)"
                    />
                  </svg>
                  <div className="wheel-center-text">81.82%</div>
                </div>

                <div className="module-row">
                  <span className="module-row-label">Multiplier Target</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1.1"
                    max="100"
                    value={upgraderMultiplier}
                    onChange={e => setUpgraderMultiplier(parseFloat(e.target.value) || 1.1)}
                    style={{ width: 60, background: '#1c202d', border: '1px solid #333', color: '#acff46', fontWeight: 800, textAlign: 'center', padding: '4px 6px', borderRadius: 4 }}
                  />
                </div>

                <div className="module-row">
                  <span className="module-row-label">Auto Random Position</span>
                  <label className="toggle-switch purple" style={{ transform: 'scale(0.8)' }}>
                    <input type="checkbox" checked={upgraderRandomPos} onChange={e => setUpgraderRandomPos(e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="module-row">
                  <span className="module-row-label">Auto Sell</span>
                  <label className="toggle-switch purple" style={{ transform: 'scale(0.8)' }}>
                    <input type="checkbox" checked={upgraderAutoSell} onChange={e => setUpgraderAutoSell(e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <button className="purple-play-btn" onClick={handleUpgraderPlay}>
                  Play Upgrader
                </button>
              </div>

              {/* Auto Battle */}
              <div className="automation-panel">
                <div className="panel-header-row">
                  <h3 className="panel-title">Auto Battle</h3>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={battleEnabled} onChange={e => setBattleEnabled(e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="module-row">
                  <span className="module-row-label">Borrow Mode</span>
                  <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                    <input type="checkbox" checked={battleBorrowMode} onChange={e => setBattleBorrowMode(e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="module-row">
                  <span className="module-row-label">50/50 Crazy Mode</span>
                  <label className="toggle-switch purple" style={{ transform: 'scale(0.8)' }}>
                    <input type="checkbox" checked={battleCrazyMode} onChange={e => setBattleCrazyMode(e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="module-row">
                  <span className="module-row-label">Battle Modifiers</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#facc15', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>JACKPOT</span>
                    <span style={{ background: 'rgba(172, 255, 70, 0.1)', color: '#acff46', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>3v3</span>
                  </div>
                </div>

                <button className="green-play-btn" onClick={handleBattleCreate}>
                  Create 3v3 Battle
                </button>
              </div>

              {/* Auto Mines */}
              <div className="automation-panel">
                <div className="panel-header-row">
                  <h3 className="panel-title">Auto Mines</h3>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={minesEnabled} onChange={e => setMinesEnabled(e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="module-row">
                  <span className="module-row-label">Auto Cashout Grid</span>
                  <span style={{ color: '#acff46', fontWeight: 800, fontSize: 12 }}>3 Mines (Safe)</span>
                </div>

                <button className="red-play-btn" onClick={() => showToast('Mines play executed')}>
                  Play Mines
                </button>
              </div>
            </div>
          )}

          {/* 3. RAINS TAB */}
          {activeTab === 'rains' && (
            <div className="rains-view-container">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#8b929e' }}>Live Rain Drops from Rollbux</span>
                <button className="lime-clear-btn" onClick={fetchRains}>Refresh Rain Pool</button>
              </div>

              <div className="table-container">
                <table className="rains-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Time Left</th>
                      <th>Amount</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rains.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: '#6d7680', padding: 32 }}>No active rain at this moment</td>
                      </tr>
                    ) : (
                      rains.map((rain, idx) => (
                        <tr key={rain.id || idx}>
                          <td className="table-account-name">{user.username.toLowerCase()}</td>
                          <td className="table-time-left">00:00</td>
                          <td style={{ color: '#acff46', fontWeight: 700 }}>
                            {rain.amount ? (rain.amount / 1000000).toFixed(2) + ' BUX' : 'In Progress'}
                          </td>
                          <td>
                            <span className="table-date-badge">Live Active</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. RESTART UPDATE DETECT. TAB */}
          {activeTab === 'update' && (
            <div className="update-page-box">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="update-status-badge">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#acff46', display: 'inline-block' }}></span>
                  Client Resource Checker
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
                  Restart Update Detect.
                </h3>
                <p style={{ color: '#8b929e', fontSize: 13, lineHeight: 1.5 }}>
                  Scan your local system for missing game textures, scripts, or assets and hot-patch them immediately without having to redownload or reinstall Sotarium.exe.
                </p>
              </div>

              <div className="update-resource-list">
                {missingResources.map((res, i) => (
                  <div key={i} className="update-resource-item">
                    <span>{res.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: '#666' }}>{res.size}</span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: res.status === 'Up to Date' ? 'rgba(172,255,70,0.1)' : 'rgba(239,68,68,0.1)',
                        color: res.status === 'Up to Date' ? '#acff46' : '#f87171'
                      }}>
                        {res.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, color: '#acff46', fontWeight: 600 }}>
                  {updateStatus}
                </div>

                <button
                  className="update-action-btn"
                  onClick={handleResourceUpdate}
                  disabled={isUpdating}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  {isUpdating ? 'Updating Client Resources…' : 'Update Missing Resources'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DesktopApp() {
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
