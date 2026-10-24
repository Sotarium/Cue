import React, { useMemo, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

// Default hard-coded session token configuration
const HARDCODED_SESSION_TOKEN = ''

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

// ============================================================================
// Original Website Components (Downloads Page, Marketing, etc.)
// ============================================================================

const iconPaths = {
  plus: <><path d="M12 5v14M5 12h14" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
  sliders: <><path d="M4 6h16M7 12h13M4 18h16" /><circle cx="8" cy="6" r="1.7" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r="1.7" fill="currentColor" stroke="none" /></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  list: <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" /></>,
  chevron: <path d="m8 10 4 4 4-4" />,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  arrowUp: <><path d="M5 16 16 5" /><path d="M7 5h9v9" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  play: <path d="m9 6 9 6-9 6V6Z" fill="currentColor" stroke="none" />,
  settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 .1.1a1.6 1.6 0 0 1-2.3 2.3l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a1.6 1.6 0 0 1-3.2 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a1.6 1.6 0 0 1-2.3-2.3l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.2a1.6 1.6 0 0 1 0-3.2h.2A1.6 1.6 0 0 0 6.2 6.4l-.1-.1a1.6 1.6 0 0 1 2.3-2.3l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.2a1.6 1.6 0 0 1 3.2 0V3a1.6 1.6 0 0 0 2.7 1.1l.1-.1a1.6 1.6 0 0 1 2.3 2.3l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a1.6 1.6 0 0 1 0 3.2h-.2a1.6 1.6 0 0 0-1.1 2.7Z" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 21h4" /></>,
  x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  checkCircle: <><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  command: <><path d="M18 4a3 3 0 1 0 0 6h-6V4h6Z" /><path d="M6 20a3 3 0 1 0 0-6h6v6H6Z" /><path d="M4 6a3 3 0 1 0 6 0V4H4v2ZM20 18a3 3 0 1 0-6 0v2h6v-2Z" /><path d="M12 10h2a3 3 0 1 1 0 6h-2V10Z" /></>,
  monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  bot: <><rect x="5" y="7" width="14" height="12" rx="3" /><path d="M12 3v4M9 13h.01M15 13h.01M9 16h6" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  zap: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
  folder: <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z" />,
  plug: <><path d="M8 12V5M16 12V5M5 9h14" /><path d="M7 12a5 5 0 0 0 10 0" /><path d="M12 17v4" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  activity: <><path d="M4 12h3l2-6 4 12 2-6h5" /></>,
  pencil: <><path d="m4 17.5-.8 3.3 3.3-.8L18.9 7.6a2.1 2.1 0 0 0-3-3L4 17.5Z" /><path d="m14.5 6.5 3 3" /></>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  shield: <><path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  users: <><path d="M16 20v-1.5a4.5 4.5 0 0 0-9 0V20" /><circle cx="11.5" cy="8" r="3" /><path d="M17 11a3 3 0 0 1 3 3v1M16.5 5.2a3 3 0 0 1 0 5.6" /></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.7-4L3 10" /><path d="M3 5v5h5M4 13a8 8 0 0 0 14.7 4L21 14" /><path d="M21 19v-5h-5" /></>,
}

function Icon({ name, size = 18, className = '' }) {
  return <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name] || iconPaths.more}</svg>
}

function Logo() {
  return <div className="brand" aria-label="Sotarium home"><span className="brand-mark"><i></i><i></i><i></i><i></i><i></i><i></i></span><span>Sotarium<span className="brand-dot">.</span></span></div>
}

function DownloadPage() {
  return <main className="download-page"><div className="download-card"><div className="download-logo"><span className="download-mark"><i></i><i></i><i></i><i></i><i></i><i></i></span><strong>Sotarium</strong></div><h1>Download Sotarium</h1><a className="download-button" href="https://github.com/Sotarium/Cue/releases/latest/download/Sotarium.exe">Download for Windows</a></div></main>
}

// ============================================================================
// Electron Desktop App Experience (Cue Sign-up / Login + Rollbux Dashboard)
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

    const tokenToUse = sessionCookie.trim() || HARDCODED_SESSION_TOKEN.trim()

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
      setError(result.error || 'Invalid authjs.session-token. Verification failed.')
      return
    }

    window.localStorage.setItem('sotarium_registered_token', tokenToUse)
    window.localStorage.setItem('sotarium_session_token', tokenToUse)
    window.localStorage.setItem('sotarium_user_profile', JSON.stringify(result.user))

    onAuthSuccess(result.user)
  }

  return (
    <div className="cue-auth-screen">
      {toast && <div className="toast-notice">{toast}</div>}

      <div className="cue-auth-box">
        <div className="cue-brand-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <img
            src="/sotarium-brand-icon.png"
            alt="Sotarium Icon"
            className="sotarium-brand-icon-img"
          />
          <span style={{ fontSize: '24px', fontWeight: 800, fontStyle: 'italic', letterSpacing: '0.5px', color: '#ffffff' }}>
            Sotarium<span style={{ color: '#acff46' }}>.</span>
          </span>
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
        <header className="dashboard-header">
          <button className="logout-pill" onClick={onLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Log Out
          </button>
          <h1 className="dashboard-logo-title">{user.username}</h1>
        </header>

        <div className="dashboard-layout">
          <aside className="dashboard-sidebar">
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

          <section className="dashboard-main">
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

            <div className="modules-grid">
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
                        <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                        <line x1="0" y1="150" x2="500" y2="150" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                        <line x1="0" y1="280" x2="500" y2="280" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                        <path d="M 0 280 L 500 280" fill="none" stroke="#7974FF" strokeWidth="2" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

function DesktopApp() {
  const [currentUser, setCurrentUser] = useState(null)
  const [loadingInitial, setLoadingInitial] = useState(true)

  const registeredToken = window.localStorage.getItem('sotarium_registered_token')

  useEffect(() => {
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
  // Check if running inside Electron or desktop mode
  const isDesktopApp = window.location.protocol === 'file:' || window.location.pathname === '/app' || !!window.electronAPI

  if (!isDesktopApp) {
    // Preserve the website homepage & download page for browser visitors
    return <DownloadPage />
  }

  // Inside the Electron Sotarium.exe app:
  return <DesktopApp />
}

createRoot(document.getElementById('root')).render(<App />)
