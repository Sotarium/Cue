with open(r'C:\Users\olivi\Downloads\Cue-main\Cue-main\src\main.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_screen_start = text.find('function UpdateDetectedScreen')
old_screen_end = text.find('function RollbuxDashboard')

new_screen = """function UpdateDetectedScreen({ onComplete }) {
  const [updating, setUpdating] = useState(false)
  const [currentFile, setCurrentFile] = useState('Updating index.html...')

  const filesToUpdate = [
    'Updating index.html...',
    'Updating homepage.jsx...',
    'Updating styles.css...',
    'Updating rollbux_upgrader_engine.js...',
    'Updating game_audio_pack.bundle...',
    'Verifying checksums and hot-patching runtime...'
  ]

  const handleStartUpdate = () => {
    setUpdating(true)
    let idx = 0
    setCurrentFile(filesToUpdate[0])

    const interval = setInterval(() => {
      idx++
      if (idx < filesToUpdate.length) {
        setCurrentFile(filesToUpdate[idx])
      } else {
        clearInterval(interval)
        setTimeout(() => {
          onComplete()
        }, 600)
      }
    }, 700)
  }

  return (
    <div className="update-fullscreen-overlay">
      <div style={{ position: 'fixed', top: 0, left: 0, right: 140, height: 32, WebkitAppRegion: 'drag', zIndex: 100 }} />

      <div className="update-screen-card">
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', marginTop: 12 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#acff46', fontWeight: 700 }}>
              {currentFile}
            </span>
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 9999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '100%', background: '#acff46' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

"""

text = text[:old_screen_start] + new_screen + text[old_screen_end:]

with open(r'C:\Users\olivi\Downloads\Cue-main\Cue-main\src\main.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated UpdateDetectedScreen cleanly")
