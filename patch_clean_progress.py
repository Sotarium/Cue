with open(r'C:\Users\olivi\Downloads\Cue-main\Cue-main\src\main.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add import for checkIconBase64 if not already there
if 'checkIconBase64' not in text:
    text = text.replace("import { brandIconBase64 } from './brandIcon.js'", "import { brandIconBase64 } from './brandIcon.js'\nimport { checkIconBase64 } from './checkIcon.js'")

old_screen_start = text.find('function UpdateDetectedScreen')
old_screen_end = text.find('function RollbuxDashboard')

new_screen = """function UpdateDetectedScreen({ onComplete }) {
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

"""

text = text[:old_screen_start] + new_screen + text[old_screen_end:]

with open(r'C:\Users\olivi\Downloads\Cue-main\Cue-main\src\main.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated screen to progress bar only + Updated Sotarium with checkmark")
