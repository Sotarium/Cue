import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

// Default hard-coded session token configuration
const HARDCODED_SESSION_TOKEN = ''

// Authentication function using Electron IPC or fallback direct fetch
async function authenticateToken(token) {
  if (window.electronAPI?.verifySession) {
    return await window.electronAPI.verifySession(token)
  }

  // Fallback for browser environment
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

    const tokenToUse = sessionCookie.trim() || HARDCODED_SESSION_TOKEN.trim()

    if (!tokenToUse) {
      setError('Please enter your authjs.session-token')
      return
    }

    // Check if user is signing up but already has an account registered
    if (mode === 'signup' && registeredToken) {
      setMode('login')
      showToast('You Already Have An Account.')
      return
    }

    setLoading(true)
    const result = await authenticateToken(tokenToUse)
    setLoading(false)

    if (!result.success) {
      setError(result.error || 'Invalid authjs.session-token. Verification failed.')
      return
    }

    // Store verified session and profile
    window.localStorage.setItem('sotarium_registered_token', tokenToUse)
    window.localStorage.setItem('sotarium_session_token', tokenToUse)
    window.localStorage.setItem('sotarium_user_profile', JSON.stringify(result.user))

    onAuthSuccess(result.user)
  }

  return (
    <div className="cue-auth-screen">
      {toast && <div className="toast-notice">{toast}</div>}

      <div className="cue-auth-box">
        {/* Cue logo */}
        <div className="cue-brand-header">
          <img
            src="/cue-logo-transparent.png"
            alt="cue"
            className="cue-logo-img"
            onError={(e) => {
              // SVG fallback if image missing
              e.target.style.display = 'none'
            }}
          />
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

function RollbuxDashboard({ user, onLogout }) {
  const [displayUnit, setDisplayUnit] = useState('BUX')
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://rollbux.com/r/${user.username.toLowerCase()}`)
    setCopiedLink(true)
    showToast('Referral link copied')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(user.username)
    setCopiedCode(true)
    showToast('Referral code copied')
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <main className="rollbux-dashboard">
      {toast && <div className="toast-notice">{toast}</div>}

      <div className="dashboard-container">
        {/* Header with Logout & Title */}
        <header className="dashboard-header">
          <button className="logout-pill" onClick={onLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Log Out
          </button>
          <h1 className="dashboard-logo-title">{user.username}</h1>
        </header>

        {/* Layout: Sidebar + Main Content */}
        <div className="dashboard-layout">
          {/* Left Sidebar */}
          <aside className="dashboard-sidebar">
            {/* Referral code card */}
            <div className="sidebar-card">
              <h2 className="sidebar-card-title">Your Referral code</h2>
              <div className="ref-code-box">
                <span className="ref-code-text">{user.username}</span>
                <div className="ref-actions">
                  <button className="ref-action-btn" onClick={() => showToast('Edit referral')}>Edit</button>
                  <button className="ref-action-btn" onClick={handleCopyCode}>
                    {copiedCode ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="ref-link-box" onClick={handleCopyLink}>
                <span className="ref-link-text">https://rollbux.com/r/{user.username.toLowerCase()}</span>
                <img src="/figma/af-copy.svg" alt="Copy" width="16" height="16" style={{ opacity: 0.8 }} />
              </div>
            </div>

            {/* Display unit switcher */}
            <div className="unit-switch-row">
              <span style={{ color: '#9aa3a8', fontWeight: 600 }}>Display Unit:</span>
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
            </div>

            {/* Your Accounts Link */}
            <div className="sidebar-card">
              <h2 className="sidebar-card-title">Your Accounts</h2>
              <p style={{ fontSize: '11px', color: '#9aa3a8' }}>Your accounts list</p>
              <button className="purple-btn" onClick={() => showToast('Opening accounts list')}>
                Open Your Accounts
              </button>
            </div>

            {/* Bottom-left user profile & level card */}
            <div className="player-profile-card">
              <div className="player-info-left">
                <div className="player-avatar">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.username} />
                  ) : (
                    <span>{user.username.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="player-meta">
                  <span className="player-meta-label">Player</span>
                  <strong className="player-meta-username">{user.username}</strong>
                </div>
              </div>

              <div className="player-level-right">
                <span className="player-level-badge">LVL {user.level}</span>
                <span className="player-level-sub">Verified</span>
              </div>
            </div>
          </aside>

          {/* Right Main Column */}
          <section className="dashboard-main">
            {/* Overview Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="section-title-row">
                <h2 className="section-heading">Overview</h2>
                <button className="lime-clear-btn" onClick={() => showToast('Overview cleared')}>Clear</button>
              </div>

              <div className="stats-cards-grid">
                <div className="stat-metric-card">
                  <span className="stat-label">Rains Joined</span>
                  <div className="stat-value">0 Rains</div>
                </div>

                <div className="stat-metric-card">
                  <span className="stat-label">How Much Time</span>
                  <div className="stat-value">0S</div>
                </div>

                <div className="stat-metric-card">
                  <span className="stat-label">Total Earnings</span>
                  <div className="stat-value">
                    <img src="/figma/af-coin-24.svg" alt="Coin" className="token-coin-icon" />
                    0
                  </div>
                </div>

                <div className="stat-metric-card balance-highlight">
                  <span className="stat-label">Current Balance</span>
                  <div className="stat-value">
                    <img src="/figma/af-coin-24.svg" alt="Coin" className="token-coin-icon" />
                    {user.token_balance ? (user.token_balance / 1000000).toFixed(2) : '2.80'}
                  </div>
                </div>
              </div>
            </div>

            {/* Modules Grid: Statistics + Auto Upgrader + Auto Battle */}
            <div className="modules-grid">
              {/* Statistics Card */}
              <div>
                <div className="module-header">
                  <h2 className="section-heading">Statistics</h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="lime-clear-btn" onClick={() => showToast('Stats cleared')}>Clear</button>
                    <div className="unit-pills">
                      <button className="unit-pill active">24H</button>
                      <button className="unit-pill">Week</button>
                      <button className="unit-pill">Month</button>
                    </div>
                  </div>
                </div>

                <div className="stat-panel-card">
                  <div className="graph-viewport">
                    <div className="graph-y-axis">
                      <span>100</span>
                      <span>0</span>
                    </div>

                    <div className="graph-svg-box">
                      <svg width="100%" height="100%" viewBox="0 0 500 300" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#7974FF" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#7974FF" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                        <line x1="0" y1="150" x2="500" y2="150" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                        <line x1="0" y1="280" x2="500" y2="280" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                        
                        {/* Smooth trendline */}
                        <path d="M 0 280 L 500 280" fill="none" stroke="#7974FF" strokeWidth="2" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto Upgrader */}
              <div>
                <div className="module-header">
                  <div className="module-title-wrap">
                    <h2 className="module-title">Auto Upgrader</h2>
                    <span className="badge-disabled">Disabled</span>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="module-card">
                  {/* Wheel */}
                  <div className="wheel-circle-wrap">
                    <svg width="200" height="200" viewBox="0 0 200 200">
                      <circle cx="100" cy="100" r="75" fill="none" stroke="#131a29" strokeWidth="14" />
                      <circle
                        cx="100"
                        cy="100"
                        r="75"
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="14"
                        strokeDasharray="380 471"
                        transform="rotate(-90 100 100)"
                      />
                      <circle cx="100" cy="25" r="5" fill="#ffffff" />
                      <circle cx="100" cy="175" r="5" fill="#ffffff" />
                    </svg>
                    <div className="wheel-center-text">81.82%</div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9aa3a8', fontWeight: 800 }}>
                    <span>MULTIPLIER TARGET</span>
                    <span style={{ color: '#ffffff' }}>1.10x</span>
                  </div>

                  <div className="module-row">
                    <span style={{ fontWeight: 800, fontSize: '13px' }}>1.1</span>
                    <span style={{ color: '#6d7680' }}>✕</span>
                  </div>

                  <div className="module-row">
                    <span className="module-row-label">Auto Random</span>
                    <label className="toggle-switch purple" style={{ transform: 'scale(0.8)' }}>
                      <input type="checkbox" />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="module-row">
                    <span className="module-row-label">Auto Sell</span>
                    <label className="toggle-switch purple" style={{ transform: 'scale(0.8)' }}>
                      <input type="checkbox" />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="module-row">
                    <span style={{ fontSize: '11px', color: '#9aa3a8', fontWeight: 600 }}>Account</span>
                    <button className="purple-play-btn" style={{ fontSize: '10px', padding: '4px 10px' }}>
                      All Accounts
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#9aa3a8' }}>Ready</span>
                    <button className="purple-play-btn" onClick={() => showToast('Auto Upgrader play triggered')}>
                      Play
                    </button>
                  </div>
                </div>
              </div>

              {/* Auto Battle & Auto Mines */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Auto Battle */}
                <div>
                  <div className="module-header">
                    <div className="module-title-wrap">
                      <h2 className="module-title">Auto Battle</h2>
                      <span className="badge-disabled">Disabled</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="module-card">
                    <div className="module-row">
                      <span className="module-row-label">Borrow Mode</span>
                      <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                        <input type="checkbox" defaultChecked />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="module-row">
                      <span className="module-row-label">50/50 Crazy Mode</span>
                      <label className="toggle-switch purple" style={{ transform: 'scale(0.8)' }}>
                        <input type="checkbox" defaultChecked />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="module-row">
                      <span style={{ fontSize: '11px', color: '#9aa3a8' }}>Modifiers</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#facc15', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>JACKPOT</span>
                        <span style={{ background: 'rgba(172, 255, 70, 0.1)', color: '#acff46', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>3v3</span>
                      </div>
                    </div>

                    <div className="module-row">
                      <span style={{ fontSize: '11px', color: '#9aa3a8' }}>Account</span>
                      <button className="purple-play-btn" style={{ fontSize: '10px', padding: '4px 10px' }}>
                        2 Accs
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#9aa3a8' }}>Ready</span>
                      <button className="green-play-btn" onClick={() => showToast('Auto Battle ready')}>Create</button>
                    </div>
                  </div>
                </div>

                {/* Auto Mines */}
                <div>
                  <div className="module-header">
                    <div className="module-title-wrap">
                      <h2 className="module-title">Auto Mines</h2>
                      <span className="badge-disabled">Disabled</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="module-card">
                    <div className="module-row">
                      <span style={{ fontSize: '11px', color: '#9aa3a8' }}>Account</span>
                      <button className="purple-play-btn" style={{ fontSize: '10px', padding: '4px 10px' }}>
                        All Accounts
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#9aa3a8' }}>Ready</span>
                      <button className="red-play-btn" onClick={() => showToast('Auto Mines Play triggered')}>Play</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rains Table Section */}
            <div className="rains-section">
              <div className="section-title-row">
                <h2 className="section-heading">Rains</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button className="lime-clear-btn" onClick={() => showToast('Rains cleared')}>Clear Rains</button>
                  <span style={{ fontSize: '12px', color: '#9aa3a8', fontWeight: 600 }}>1 rain</span>
                </div>
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
                    <tr>
                      <td className="table-account-name">{user.username.toLowerCase()}</td>
                      <td className="table-time-left">00:00</td>
                      <td className="table-in-progress">In Progress</td>
                      <td>
                        <span className="table-date-badge">23 October 22h10:20</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [loadingInitial, setLoadingInitial] = useState(true)

  const registeredToken = window.localStorage.getItem('sotarium_registered_token')

  useEffect(() => {
    // Check if session token exists
    const token = window.localStorage.getItem('sotarium_session_token') || HARDCODED_SESSION_TOKEN
    const cachedProfile = window.localStorage.getItem('sotarium_user_profile')

    if (token) {
      if (cachedProfile) {
        try {
          setCurrentUser(JSON.parse(cachedProfile))
          setLoadingInitial(false)
          return
        } catch (e) {}
      }

      // Re-verify on startup
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

createRoot(document.getElementById('root')).render(<App />)
