import { app, BrowserWindow, dialog, shell } from 'electron';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let initialHash = '';

function parseProtocolUrl(value: string | undefined): string | null {
  if (!value || !value.startsWith('vaultui:')) return null;

  const fragmentIndex = value.indexOf('#');
  if (fragmentIndex === -1) return null;

  // Windows normalises a "?" in a custom protocol URL to "~".
  return value.slice(fragmentIndex + 1).replace('~', '?');
}

function setInitialPath(value: string | undefined): void {
  const hash = parseProtocolUrl(value);
  if (!hash) return;

  initialHash = hash.startsWith('/') ? hash : `/${hash}`;
  if (mainWindow) {
    void loadApplication(mainWindow);
  }
}

if (process.argv.length > 1) {
  const protocolHash = parseProtocolUrl(process.argv[process.argv.length - 1]);
  if (protocolHash) initialHash = protocolHash;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    setInitialPath(commandLine[commandLine.length - 1]);
  });
}

app.setAsDefaultProtocolClient('vaultui');

app.on('open-url', (event, openUrl) => {
  event.preventDefault();
  setInitialPath(openUrl);
});

async function loadApplication(window: BrowserWindow): Promise<void> {
  if (devServerUrl) {
    const target = new URL(devServerUrl);
    target.hash = initialHash;
    await window.loadURL(target.toString());
    return;
  }

  const indexFile = path.join(__dirname, '..', 'dist', 'index.html');
  await window.loadFile(indexFile, initialHash ? { hash: initialHash } : undefined);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    title: 'Vault-UI',
    backgroundColor: '#121212',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Vault is usually deployed without CORS headers and the desktop build
      // talks to arbitrary Vault addresses directly. Disabling the renderer
      // same-origin policy keeps that flow working; Node integration remains
      // disabled and the app only loads local content.
      webSecurity: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('http://') || target.startsWith('https://')) {
      void shell.openExternal(target);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, target) => {
    const current = mainWindow?.webContents.getURL() ?? '';
    if (current && target.split('#')[0] === current.split('#')[0]) return;
    event.preventDefault();
    if (target.startsWith('http://') || target.startsWith('https://')) {
      void shell.openExternal(target);
    }
  });

  void loadApplication(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('certificate-error', (event, _webContents, _url, error, _certificate, callback) => {
  event.preventDefault();

  void dialog
    .showMessageBox({
      type: 'warning',
      title: 'Server TLS Certificate Error',
      message: 'The validity of the TLS connection with the remote server cannot be verified.',
      detail: `${error}\n\nWould you like to proceed anyway?`,
      buttons: ['Yes', 'No'],
      defaultId: 1,
      cancelId: 1,
    })
    .then(({ response }) => callback(response === 0));
});
