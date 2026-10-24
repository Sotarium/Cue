const { app, BrowserWindow } = require('electron')
const path = require('path')

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    title: 'Sotarium',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.webContents.once('did-finish-load', async () => {
    if (process.env.SOTARIUM_SMOKE === '1') {
      const bodyText = await window.webContents.executeJavaScript('document.body.innerText')
      console.log(bodyText.includes('Sotarium') && bodyText.includes('Sign up') ? 'SOTARIUM_SMOKE_OK' : bodyText.slice(0, 200))
      app.quit()
    }
  })
  window.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
    if (process.env.SOTARIUM_SMOKE === '1') console.error(`SOTARIUM_SMOKE_FAIL ${errorCode} ${errorDescription}`)
  })
  window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
