const { app, BrowserWindow, shell, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = Number(process.env.REMO_PORT || 3000);
let mainWindow = null;
let serverProcess = null;
let shuttingDown = false;

const isPackaged = app.isPackaged;
const appRoot = isPackaged ? process.resourcesPath : path.resolve(__dirname, '..');
const serverEntry = isPackaged
  ? path.join(appRoot, 'app.asar', 'dist', 'server.cjs')
  : path.join(appRoot, 'dist', 'server.cjs');

function log(...args) {
  console.log('[REMO PRO Desktop]', ...args);
}

function startServer() {
  if (serverProcess) return;

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT),
    ELECTRON_DESKTOP: '1',
  };

  // Electron can run the bundled Node/Express server through its embedded Node runtime.
  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: isPackaged ? path.join(process.resourcesPath, 'app.asar') : appRoot,
    env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  serverProcess.stdout.on('data', data => process.stdout.write(`[server] ${data}`));
  serverProcess.stderr.on('data', data => process.stderr.write(`[server] ${data}`));
  serverProcess.on('error', err => {
    log('Server process error:', err);
    if (!shuttingDown) showStartupError(err);
  });
  serverProcess.on('exit', (code, signal) => {
    log(`Server exited code=${code} signal=${signal || 'none'}`);
    serverProcess = null;
    if (!shuttingDown && mainWindow) {
      dialog.showErrorBox('REMO PRO', `خدمة النظام توقفت بشكل غير متوقع.\nCode: ${code ?? 'unknown'}`);
    }
  });
}

function showStartupError(err) {
  dialog.showErrorBox('REMO PRO', `تعذر تشغيل خدمة النظام.\n${err?.message || err}`);
}

function waitForServer(timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${PORT}/api/health`, res => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 500) return resolve();
        retry();
      });
      req.on('error', retry);
      req.setTimeout(1500, () => req.destroy());
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) return reject(new Error(`Server did not become ready on port ${PORT}`));
      setTimeout(check, 300);
    };
    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f5f7fa',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  return mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
}

async function boot() {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  await app.whenReady();
  startServer();
  try {
    await waitForServer();
    await createWindow();
  } catch (err) {
    log(err);
    showStartupError(err);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (serverProcess) {
    try {
      serverProcess.kill('SIGTERM');
      setTimeout(() => {
        if (serverProcess) serverProcess.kill('SIGKILL');
      }, 5000).unref();
    } catch (_) {}
  }
}

app.on('before-quit', shutdown);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

boot().catch(err => {
  console.error(err);
  app.quit();
});
