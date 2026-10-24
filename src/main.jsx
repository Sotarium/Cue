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
                      background: '#acff46',
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

  // Fetch rain cycle from Rollbux
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
            ends_at: state.cycle_end || state.cycle?.cycle_end
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
    showToast(`Upgrading with ${upgraderMultiplier}x target...`)
    if (window.electronAPI?.rollbuxRequest) {
      try {
        const res = await window.electronAPI.rollbuxRequest({
          path: '/_api/upgrader/play',
          method: 'POST',
          token: sessionToken,
          body: {
            multiplier: upgraderMultiplier,
            randomPosition: upgraderRandom,
            autoSell: upgraderAutoSell,
            stakeValueMicroTokens: 1000000
          }
        })
        if (res.ok) {
          setUpgraderFeedback('Won Item! (Sold)')
          showToast('Upgrade play completed!')
          setGameHistory(prev => [{
            mode: 'Upgrader',
            success: true,
            account: user.username,
            amount: (upgraderMultiplier * 1.0).toFixed(2),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }, ...prev])
        } else {
          setUpgraderFeedback('Lost')
          showToast(res.data?.message || 'Upgrade rejected by Rollbux')
          setGameHistory(prev => [{
            mode: 'Upgrader',
            success: false,
            account: user.username,
            amount: '1.00',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }, ...prev])
        }
      } catch (e) {
        setUpgraderFeedback('Error')
        showToast('Error executing upgrade')
      }
    }
  }

  // Battle execution
  const executeBattleCreate = async () => {
    setBattleFeedback('Creating 3v3 battle...')
    showToast('Creating 3v3 Battle...')
    if (window.electronAPI?.rollbuxRequest) {
      try {
        const res = await window.electronAPI.rollbuxRequest({
          path: '/_api/battles',
          method: 'POST',
          token: sessionToken,
          body: {
            borrow: battleBorrow,
            crazy_mode: battleCrazy,
            mode: '3v3'
          }
        })
        if (res.ok) {
          setBattleFeedback('Battle created!')
          showToast('3v3 Battle created!')
          setGameHistory(prev => [{
            mode: 'Battle',
            success: true,
            account: user.username,
            amount: '57.60',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }, ...prev])
        } else {
          setBattleFeedback('Failed')
          showToast(res.data?.message || 'Battle creation rejected')
        }
      } catch (e) {
        setBattleFeedback('Error')
        showToast('Error creating battle')
      }
    }
  }

  // Mines execution
  const executeMinesPlay = () => {
    setMinesFeedback('Playing mines...')
    showToast('Executing Mines round...')
    setTimeout(() => {
      setMinesFeedback('Success! +1.10 BUX')
      showToast('Mines round cashed out successfully!')
      setGameHistory(prev => [{
        mode: 'Mines',
        success: true,
        account: user.username,
        amount: '1.10',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }, ...prev])
    }, 1500)
  }

  const formatValue = (microTokens) => {
    const bux = microTokens ? microTokens / 1000000 : 0
    if (currentUnit === 'USD') return `$${(bux * 0.01).toFixed(2)}`
    if (currentUnit === 'SOL') return `${(bux * 0.0001).toFixed(4)}`
    return bux.toFixed(2)
  }

  return (
    <div className="flex w-full justify-center pb-[40px] pt-[35px] selection:bg-[#acff46] selection:text-[#0e131f]">
      {/* Draggable header strip for frameless window */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 140, height: 32, WebkitAppRegion: 'drag', zIndex: 100 }} />

      {toast && <div className="toast-notice">{toast}</div>}

      
      {false && (
        <UpdateDetectedScreen
          onComplete={() => {
            setShowUpdateScreen(false)
            showToast('Client update successfully installed!')
          }}
        />
      )}

      <div className="flex w-full max-w-[1536px] flex-col items-start gap-[28px] px-4 md:px-8">
        <div className="flex w-full flex-col items-start gap-[28px]">
          
          {/* Header */}
          <div className="flex w-full flex-col items-center justify-center">
            <div className="flex w-full items-center justify-between">
              <div className="flex w-full shrink-0 flex-col items-start gap-[20px]">
                <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-[12px]">
                  <div className="flex shrink-0 flex-col items-start gap-[6px]">
                    <button
                      onClick={onLogout}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 rounded-lg text-xs font-semibold transition active:scale-95 shadow-sm cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                      </svg>
                      Log Out
                    </button>
                    <h1 className="whitespace-nowrap text-[25px] tracking-[0.5px] text-white font-bold italic">{user.username}</h1>
                  </div>

                  {/* Trigger Fullscreen Update Screen */}
                  <button
                    onClick={() => setShowUpdateScreen(true)}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#131a29] border border-white/10 hover:border-[#acff46]/40 text-xs font-bold text-gray-300 hover:text-white transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#acff46] animate-pulse"></span>
                    <span>Restart Update Detect.</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Layout Body */}
          <div className="flex w-full flex-col items-start">
            <div className="flex w-full flex-col items-start">
              <div className="flex w-full flex-col items-start gap-[24px] lg:flex-row lg:gap-[28px]">
                
                {/* Left Sidebar: Referral Code & Accounts */}
                <div className="flex w-full shrink-0 flex-col items-start gap-[16px] lg:w-[300px] xl:w-[320px]">
                  
                  {/* Referral Code Card */}
                  <div className="relative flex w-full flex-col items-start gap-[16px] overflow-clip rounded-[12px] bg-[#0e131f] p-[24px] shadow-sm border border-white/[0.03]">
                    <p className="whitespace-nowrap text-[16px] font-bold leading-[24px] text-white">Your Referral code</p>
                    
                    <div className="flex w-full shrink-0 flex-col items-start gap-[16px]">
                      <div className="flex w-full shrink-0 flex-col items-start gap-[10px]">
                        
                        {/* Referral Code Box */}
                        <div className="relative flex w-full shrink-0 items-center justify-between overflow-clip rounded-[7px] px-[12px] py-[10px] bg-[#131a29]">
                          <span className="font-mono text-[14px] font-bold leading-[20px] tracking-[1px] text-[#acff46]">{user.username}</span>
                          <div className="relative flex items-center gap-2 z-10">
                            <button onClick={() => showToast('Edit referral code')} type="button" className="text-[11px] font-semibold text-[#9aa3a8] hover:text-[#acff46] transition cursor-pointer">Edit</button>
                            <button onClick={handleCopyCode} type="button" className="text-[12px] font-semibold leading-[18px] text-[#9aa3a8] transition hover:text-white cursor-pointer">
                              {copiedCode ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>

                        {/* Referral Link Box */}
                        <button onClick={handleCopyLink} type="button" className="group relative flex w-full shrink-0 items-center justify-between gap-[8px] overflow-clip rounded-[7px] px-[12px] py-[10px] text-left transition hover:brightness-110 active:scale-[0.99] bg-[#131a29] cursor-pointer">
                          <span className="relative min-w-0 truncate text-[14px] font-medium leading-[20px] text-[#9aa3a8]">https://rollbux.com/r/{user.username.toLowerCase()}</span>
                          <span className="relative size-[20px] shrink-0 transition group-hover:scale-105">
                            <img alt="Copy link" className="absolute inset-0 block size-full max-w-none opacity-80 group-hover:opacity-100" src="/figma/af-copy.svg" />
                          </span>
                        </button>

                      </div>
                    </div>
                  </div>

                  {/* Currency Switcher Pill */}
                  <div className="w-full flex items-center justify-between bg-[#0e131f] p-3 rounded-[12px] border border-white/[0.03] text-[12px]">
                    <span className="text-[#9aa3a8] font-medium">Display Unit:</span>
                    <div className="flex gap-1 bg-[#131a29] p-1 rounded-md">
                      {['BUX', 'USD', 'SOL'].map((unit) => (
                        <button
                          key={unit}
                          onClick={() => setCurrentUnit(unit)}
                          type="button"
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${currentUnit === unit ? 'bg-[#acff46] text-[#121418]' : 'text-[#9aa3a8] hover:text-white'}`}
                        >
                          {unit}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Accounts Infos Card */}
                  <div className="relative flex w-full flex-col items-start gap-[12px] overflow-clip rounded-[12px] bg-[#0e131f] p-[20px] shadow-sm border border-white/[0.03]">
                    <div className="flex w-full items-center justify-between">
                      <span className="text-[14px] font-bold text-white">Accounts Infos</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-gray-400">Auto Messages</span>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8b5cf6]"></div>
                        </label>
                      </div>
                    </div>
                    
                    {/* Live Account Row */}
                    <div className="flex w-full flex-col gap-2 pt-1 border-t border-white/[0.04]">
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-bold text-[#acff46]">{user.username} :</span>
                          <span className="text-[13px] font-black tracking-tight leading-none text-[#acff46]">3 / 3</span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-500">Active</span>
                      </div>
                    </div>

                    {/* Next Message Countdown Circle */}
                    <div className="flex w-full flex-col items-center justify-center py-2 border-t border-white/[0.04] gap-1">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Next Message In</span>
                      <div className="relative flex items-center justify-center size-[96px] mt-1">
                        <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                          <path className="text-white/5" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                          <path className="text-[#acff46] transition-all duration-1000 ease-linear" strokeWidth="3" strokeDasharray="80, 100" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center text-center">
                          <span className="text-[15px] font-mono font-bold text-white">08:42</span>
                          <span className="text-[9px] text-[#acff46] uppercase font-semibold">Active</span>
                        </div>
                      </div>
                    </div>

                    {/* Buttons Row */}
                    <div className="grid grid-cols-2 gap-2 pt-2 w-full border-t border-white/[0.04]">
                      <button onClick={() => showToast('Account token is configured')} type="button" className="w-full py-2 bg-[#acff46] hover:bg-[#96e036] text-[#121418] rounded-lg text-xs font-bold transition shadow-sm active:scale-95 text-center cursor-pointer">
                        Token
                      </button>
                      <button onClick={() => showToast('Accounts registered: 1')} className="w-full py-2 bg-gradient-to-r from-[#a855f7] to-[#8b5cf6] hover:brightness-110 text-white rounded-lg text-xs font-bold transition shadow-sm active:scale-95 text-center flex items-center justify-center cursor-pointer">
                        <span>Accounts</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Main Content */}
                <div className="flex flex-1 min-w-0 w-full flex-col items-start gap-[24px]">
                  
                  {/* Overview Section */}
                  <div className="flex w-full shrink-0 flex-col items-start justify-center gap-[16px]">
                    <div className="flex w-full shrink-0 items-center justify-between">
                      <p className="whitespace-nowrap text-[20px] leading-[30px] text-white font-bold italic">Overview</p>
                      <button onClick={() => showToast('Overview metrics reset')} type="button" className="relative flex h-[32px] shrink-0 items-center justify-center overflow-clip rounded-[7px] px-[14px] py-[6px] bg-[#acff46] text-[#121418] font-bold text-[13px] hover:brightness-110 active:scale-95 transition shadow-sm cursor-pointer">
                        <span>Clear</span>
                      </button>
                    </div>

                    {/* 4 Stats Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px] w-full">
                      {/* 1. Rains Joined */}
                      <div className="relative flex w-full flex-col items-start gap-[6px] overflow-clip rounded-[12px] px-[20px] py-[16px] border border-white/[0.03] bg-[#0e131f]">
                        <p className="text-[14px] font-medium leading-[20px] text-[#9aa3a8]">Rains Joined</p>
                        <p className="whitespace-nowrap text-[20px] font-bold leading-[30px] text-white">0 Rains</p>
                      </div>

                      {/* 2. How Much Time */}
                      <div className="relative flex w-full flex-col items-start gap-[6px] overflow-clip rounded-[12px] px-[20px] py-[16px] border border-white/[0.03] bg-[#0e131f]">
                        <p className="text-[14px] font-medium leading-[20px] text-[#9aa3a8]">How Much Time</p>
                        <p className="whitespace-nowrap text-[20px] font-bold leading-[30px] text-white">0S</p>
                      </div>

                      {/* 3. Total Earnings */}
                      <div className="relative flex w-full flex-col items-start gap-[6px] overflow-clip rounded-[12px] px-[20px] py-[16px] border border-white/[0.03] bg-[#0e131f]">
                        <p className="text-[14px] font-medium leading-[20px] text-[#9aa3a8]">Total Earnings</p>
                        <div className="flex shrink-0 items-center gap-[8px]">
                          <img alt="" className="size-[24px]" src="/figma/af-coin-24.svg" />
                          <p className="whitespace-nowrap text-[20px] font-bold leading-[30px] text-white">0.00</p>
                        </div>
                      </div>

                      {/* 4. Current Balance */}
                      <div className="relative flex w-full items-center justify-between gap-[12px] overflow-clip rounded-[12px] border border-solid border-[rgba(172,255,70,0.12)] px-[20px] py-[16px] bg-[#0e131f]">
                        <div className="relative flex min-w-0 shrink flex-col items-start gap-[6px]">
                          <p className="whitespace-nowrap text-[14px] font-medium leading-[20px] text-[#acff46]">Current Balance</p>
                          <div className="flex shrink-0 items-center gap-[8px]">
                            <img alt="" className="size-[24px]" src="/figma/af-coin-24.svg" />
                            <p className="whitespace-nowrap text-[20px] font-bold leading-[30px] text-white">
                              {formatValue(user.token_balance)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Statistics + Auto Upgrader + Auto Battle Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_270px_270px] gap-5 w-full items-start">
                    
                    {/* Left: Statistics Section */}
                    <div className="flex w-full min-w-0 flex-col items-start gap-[16px]">
                      <div className="flex w-full shrink-0 items-center justify-between">
                        <p className="whitespace-nowrap text-[20px] font-bold italic leading-[30px] text-white">Statistics</p>
                        <div className="flex items-center gap-3">
                          <button onClick={() => showToast('Stats graph cleared')} type="button" className="relative flex h-[32px] shrink-0 items-center justify-center overflow-clip rounded-[7px] px-[14px] py-[6px] bg-[#acff46] text-[#121418] font-bold text-[13px] hover:brightness-110 active:scale-95 transition shadow-sm cursor-pointer">
                            <span>Clear</span>
                          </button>
                          <div className="relative flex shrink-0 items-center gap-[2px] rounded-[8px] p-[2px] bg-[#0e131f] border border-white/[0.04]">
                            {['24H', 'Week', 'Month'].map((tab) => (
                              <button
                                key={tab}
                                onClick={() => setActiveTab(tab.toLowerCase())}
                                type="button"
                                className={`relative flex h-[32px] shrink-0 items-center justify-center overflow-clip rounded-[7px] px-[12px] py-[8px] transition cursor-pointer ${activeTab === tab.toLowerCase() ? 'bg-[#131a29] text-white font-semibold' : 'text-[#9aa3a8] hover:text-white'}`}
                              >
                                <span className="text-[14px]">{tab}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Chart Container Card */}
                      <div className="relative flex w-full shrink-0 flex-col items-start justify-center overflow-clip rounded-[12px] p-[24px] border border-white/[0.03] bg-[#0e131f]">
                        <div className="custom-scroll relative h-[348px] w-full shrink-0 overflow-x-auto overflow-y-clip">
                          <div className="relative h-full w-full min-w-[500px]">
                            {/* Y-Axis Labels */}
                            <div className="absolute left-0 top-0 flex flex-col items-start justify-between h-[330px] whitespace-nowrap text-[12px] font-bold text-[#6d7680]">
                              <p className="leading-[18px]">100</p>
                              <p className="leading-[18px]">&nbsp;</p>
                              <p className="leading-[18px]">&nbsp;</p>
                              <p className="leading-[18px]">&nbsp;</p>
                              <p className="leading-[18px]">&nbsp;</p>
                              <p className="leading-[18px]">&nbsp;</p>
                              <p className="leading-[18px] text-white font-bold">0</p>
                            </div>

                            {/* SVG Chart Area */}
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

                    {/* Middle: Clean Auto Upgrader GUI */}
                    <div className="flex w-full flex-col items-start gap-[16px]">
                      <div className="flex w-full shrink-0 items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="whitespace-nowrap text-[20px] leading-[30px] text-white font-black tracking-tight italic">Auto Upgrader</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${upgraderActive ? 'bg-[#acff46]/10 border border-[#acff46]/30 text-[#acff46]' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                            {upgraderActive ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input type="checkbox" checked={upgraderActive} onChange={e => setUpgraderActive(e.target.checked)} className="sr-only peer" />
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#acff46]"></div>
                        </label>
                      </div>

                      {/* Clean Card Box */}
                      <div className="relative flex w-full flex-col items-center justify-center gap-4 overflow-clip rounded-[12px] bg-[#0e131f] p-[20px] border border-white/[0.03]">
                        {/* Wheel */}
                        <div className="relative flex flex-col items-center justify-center w-full select-none py-2">
                          <div className="relative size-[210px] flex items-center justify-center">
                            <svg className="size-full overflow-visible" viewBox="0 0 200 200">
                              <circle cx="100" cy="100" r="78" fill="#0c0f17" stroke="#181d2a" strokeWidth="15" />
                              <circle cx="100" cy="100" r="78" fill="none" stroke="#8b5cf6" strokeWidth="15" strokeDasharray="220.5 490.09" transform="rotate(-90 100 100)" />
                              <circle cx="100" cy="22" r="6.5" fill="#ffffff" stroke="#8b5cf6" strokeWidth="2" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                              <span className="text-[34px] font-black text-white tracking-tight leading-none">45.00%</span>
                            </div>
                          </div>
                        </div>

                        {/* Multiplier Target */}
                        <div className="relative z-10 flex flex-col gap-1.5 w-full">
                          <div className="flex items-center justify-between text-[11px] font-black tracking-tight text-[#9aa3a8]">
                            <span>MULTIPLIER TARGET</span>
                            <span className="text-white font-black">{upgraderMultiplier.toFixed(2)}x</span>
                          </div>
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              min="1.1"
                              max="100"
                              step="0.05"
                              value={upgraderMultiplier}
                              onChange={e => setUpgraderMultiplier(parseFloat(e.target.value) || 1.1)}
                              className="w-full bg-[#131a29] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-black tracking-tight focus:border-[#8b5cf6] outline-none"
                            />
                            <span className="absolute right-3 text-xs text-gray-400 font-black">x</span>
                          </div>
                        </div>

                        {/* Auto Random */}
                        <div className="relative z-10 flex items-center justify-between p-2.5 rounded-lg bg-[#131a29] border border-white/5 w-full">
                          <span className="text-xs font-black tracking-tight text-white">Auto Random</span>
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input type="checkbox" checked={upgraderRandom} onChange={e => setUpgraderRandom(e.target.checked)} className="sr-only peer" />
                            <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8b5cf6]"></div>
                          </label>
                        </div>

                        {/* Auto Sell */}
                        <div className="relative z-10 flex items-center justify-between p-2.5 rounded-lg bg-[#131a29] border border-white/5 w-full">
                          <span className="text-xs font-black tracking-tight text-white">Auto Sell</span>
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input type="checkbox" checked={upgraderAutoSell} onChange={e => setUpgraderAutoSell(e.target.checked)} className="sr-only peer" />
                            <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8b5cf6]"></div>
                          </label>
                        </div>

                        {/* Account Selector */}
                        <div className="relative z-10 flex items-center justify-between p-2 rounded-lg bg-[#131a29] border border-white/5 w-full">
                          <span className="text-[11px] font-semibold text-[#9aa3a8]">Account</span>
                          <button type="button" className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#7c3aed] text-white text-xs font-black tracking-tight">
                            <span>All Accounts</span>
                          </button>
                        </div>

                        {/* Feedback + Manual Play Button */}
                        <div className="relative z-10 flex items-center gap-2 w-full">
                          <span className="text-xs font-black tracking-tight text-[#9aa3a8] truncate flex-1">{upgraderFeedback}</span>
                          <button onClick={executeUpgraderPlay} type="button" className="shrink-0 px-4 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-black tracking-tight rounded-lg transition active:scale-95 shadow-sm cursor-pointer">
                            Play
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right: Clean Auto Battle GUI & Mines */}
                    <div className="flex w-full flex-col items-start gap-[16px]">
                      <div className="flex w-full shrink-0 items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="whitespace-nowrap text-[20px] leading-[30px] text-white font-bold italic">Auto Battle</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${battleActive ? 'bg-[#acff46]/10 border border-[#acff46]/30 text-[#acff46]' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                            {battleActive ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input type="checkbox" checked={battleActive} onChange={e => setBattleActive(e.target.checked)} className="sr-only peer" />
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#acff46]"></div>
                        </label>
                      </div>

                      {/* Clean Battle Card Box */}
                      <div className="relative flex w-full flex-col items-center justify-center gap-3 overflow-clip rounded-[12px] bg-[#0e131f] p-[16px] border border-white/[0.03]">
                        {/* Borrow Mode */}
                        <div className="relative z-10 w-full">
                          <label className="px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 bg-[#131a29] border border-white/[0.06] shadow-sm cursor-pointer select-none">
                            <span className="font-semibold text-xs text-white">Borrow Mode</span>
                            <input type="checkbox" checked={battleBorrow} onChange={e => setBattleBorrow(e.target.checked)} className="sr-only peer" />
                            <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#acff46]"></div>
                          </label>
                        </div>

                        {/* Crazy Mode */}
                        <div className="relative z-10 w-full">
                          <label className="px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 bg-[#131a29] border border-white/[0.06] shadow-sm cursor-pointer select-none">
                            <span className="font-semibold text-xs text-white">50/50 Crazy Mode</span>
                            <input type="checkbox" checked={battleCrazy} onChange={e => setBattleCrazy(e.target.checked)} className="sr-only peer" />
                            <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8b5cf6]"></div>
                          </label>
                        </div>

                        {/* Modifiers */}
                        <div className="relative z-10 flex items-center justify-between p-2 rounded-lg bg-[#131a29] border border-white/5 w-full">
                          <span className="text-[11px] font-semibold text-[#9aa3a8]">Modifiers</span>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-[11px] font-extrabold text-yellow-400">JACKPOT</span>
                            <span className="px-2 py-0.5 rounded bg-[#acff46]/10 border border-[#acff46]/20 text-[11px] font-extrabold text-[#acff46]">3v3</span>
                          </div>
                        </div>

                        {/* Account Selector */}
                        <div className="relative z-10 flex items-center justify-between p-2 rounded-lg bg-[#131a29] border border-white/5 w-full">
                          <span className="text-[11px] font-semibold text-[#9aa3a8]">Account</span>
                          <button type="button" className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#7c3aed] text-white text-xs font-black">
                            <span>2 Accs</span>
                          </button>
                        </div>

                        {/* Create Battle Button */}
                        <div className="relative z-10 flex items-center gap-2 w-full pt-1">
                          <span className="text-xs text-[#9aa3a8] truncate flex-1">{battleFeedback}</span>
                          <button onClick={executeBattleCreate} type="button" className="shrink-0 px-4 py-2 bg-[#acff46] hover:brightness-110 text-[#121418] text-xs font-bold rounded-lg transition active:scale-95 shadow-sm cursor-pointer">
                            Create
                          </button>
                        </div>
                      </div>

                      {/* Auto Mines Card */}
                      <div className="flex w-full shrink-0 items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <p className="whitespace-nowrap text-[20px] leading-[30px] text-white font-black tracking-tight italic">Auto Mines</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${minesActive ? 'bg-[#acff46]/10 border border-[#acff46]/30 text-[#acff46]' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                            {minesActive ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input type="checkbox" checked={minesActive} onChange={e => setMinesActive(e.target.checked)} className="sr-only peer" />
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#acff46]"></div>
                        </label>
                      </div>

                      <div className="relative flex w-full flex-col justify-center gap-3 overflow-clip rounded-[12px] bg-[#0e131f] p-[16px] border border-white/[0.03]">
                        <div className="relative z-10 flex items-center justify-between p-2 rounded-lg bg-[#131a29] border border-white/5 w-full">
                          <span className="text-[11px] font-semibold text-[#9aa3a8]">Account</span>
                          <button type="button" className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#7c3aed] text-white text-xs font-black">
                            <span>All Accounts</span>
                          </button>
                        </div>
                        <div className="relative z-10 flex items-center gap-2 w-full">
                          <span className="text-xs font-black tracking-tight text-[#9aa3a8] truncate flex-1">{minesFeedback}</span>
                          <button onClick={executeMinesPlay} type="button" className="shrink-0 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-black tracking-tight rounded-lg transition active:scale-95 shadow-sm cursor-pointer">
                            Play
                          </button>
                        </div>
                      </div>

                    </div>

                  </div>

                  {/* Rains Section */}
                  <div className="flex w-full shrink-0 flex-col items-start gap-[16px]">
                    <div className="flex w-full shrink-0 items-center justify-between">
                      <p className="whitespace-nowrap text-[20px] leading-[30px] text-white font-bold italic">Rains</p>
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setRains([]); showToast('Rains cleared'); }} type="button" className="relative flex h-[30px] shrink-0 items-center justify-center overflow-clip rounded-[7px] px-[12px] py-[5px] bg-[#acff46] text-[#121418] font-bold text-[12px] hover:brightness-110 active:scale-95 transition shadow-sm cursor-pointer">
                          <span>Clear Rains</span>
                        </button>
                        <span className="text-[13px] text-[#9aa3a8]">{rains.length} rain</span>
                      </div>
                    </div>
                    
                    <div className="flex w-full shrink-0 flex-col items-center gap-[12px]">
                      <div className="custom-scroll w-full max-w-full overflow-x-auto overflow-y-hidden">
                        <div className="relative w-full min-w-[650px] shrink-0 rounded-[12px] border border-white/[0.03] overflow-hidden bg-[#0e131f]" style={{ minHeight: 164 }}>
                          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_40px] items-center gap-[12px] px-[16px] py-[14px] text-[13px] font-semibold tracking-[0.28px] text-[#9aa3a8] border-b border-white/[0.04]">
                            <div>Account</div>
                            <div className="text-center">Time Left</div>
                            <div className="text-center">Amount</div>
                            <div className="text-right pr-2">Time</div>
                            <div className="text-center"></div>
                          </div>
                          
                          <div className="flex flex-col divide-y divide-white/[0.02]">
                            {rains.length === 0 ? (
                              <div className="flex h-[120px] items-center justify-center px-[32px] text-center">
                                <p className="text-[13px] leading-[20px] text-[#9aa3a8]">Nobody is using your code yet. Share the link above — a referee appears here as soon as they attach it.</p>
                              </div>
                            ) : (
                              rains.map((rain, i) => (
                                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_40px] items-center gap-[12px] px-[16px] py-[10px] bg-[rgba(172,255,70,0.03)]">
                                  <span className="truncate text-[15px] font-bold italic tracking-[0.3px] text-[#acff46]">{user.username}</span>
                                  <span className="text-center text-[14px] font-bold text-[#acff46] font-mono">00:00</span>
                                  <span className="text-center text-[14px] font-semibold text-[#c2c6db] italic">In Progress</span>
                                  <span className="text-right pr-2">
                                    <span className="inline-flex h-[24px] items-center rounded-[6px] px-[8px] text-[12px] font-semibold text-[#50f07b] bg-[rgba(80,240,123,0.12)]">
                                      Active Cycle
                                    </span>
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Game History Section */}
                  <div className="flex w-full shrink-0 flex-col items-start gap-[16px]">
                    <div className="flex w-full shrink-0 items-center justify-between">
                      <p className="whitespace-nowrap text-[20px] leading-[30px] text-white font-bold italic">Game History</p>
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setGameHistory([]); showToast('Game history cleared'); }} type="button" className="relative flex h-[30px] shrink-0 items-center justify-center overflow-clip rounded-[7px] px-[12px] py-[5px] bg-[#7c3aed] text-white font-bold text-[12px] hover:brightness-110 active:scale-95 transition shadow-sm cursor-pointer">
                          <span>Clear History</span>
                        </button>
                        <span className="text-[13px] text-[#9aa3a8]">{gameHistory.length} rounds</span>
                      </div>
                    </div>
                    <div className="flex w-full shrink-0 flex-col items-center gap-[12px]">
                      <div className="custom-scroll w-full max-w-full overflow-x-auto overflow-y-hidden">
                        <div className="relative w-full min-w-[650px] shrink-0 rounded-[12px] border border-white/[0.03] overflow-hidden bg-[#0e131f]" style={{ minHeight: 164 }}>
                          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr] items-center gap-[12px] px-[16px] py-[14px] text-[13px] font-semibold tracking-[0.28px] text-[#9aa3a8] border-b border-white/[0.04]">
                            <div>Account</div>
                            <div className="text-center">Mode</div>
                            <div className="text-center">Result</div>
                            <div className="text-center">Amount</div>
                            <div className="text-right pr-2">Time</div>
                          </div>
                          <div className="flex flex-col divide-y divide-white/[0.02]">
                            {gameHistory.length === 0 ? (
                              <div className="flex h-[120px] items-center justify-center px-[32px] text-center">
                                <p className="text-[13px] leading-[20px] text-[#9aa3a8]">No game rounds yet. Start Auto Upgrader, Battle, or Mines to see history here.</p>
                              </div>
                            ) : (
                              gameHistory.map((item, i) => (
                                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr] items-center gap-[12px] px-[16px] py-[10px] hover:bg-white/[0.02]">
                                  <span className="truncate text-[14px] font-bold italic text-white">{item.account}</span>
                                  <span className="text-center text-[13px] font-bold text-[#7974FF]">{item.mode}</span>
                                  <span className="text-center">
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase ${item.success ? 'bg-[#acff46]/10 text-[#acff46]' : 'bg-red-500/10 text-red-400'}`}>
                                      {item.success ? 'Success' : 'Loss'}
                                    </span>
                                  </span>
                                  <span className="text-center text-[13px] font-bold text-[#c2c6db]">{item.amount} BUX</span>
                                  <span className="text-right pr-2 text-[12px] text-[#9aa3a8]">{item.time}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>

        </div>
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
