import { app, BrowserWindow, ipcMain } from 'electron';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { StudioWindows, isTrustedStudioUrl } from './windows.ts';
import { createStudioPage } from './page.ts';

// This process owns presentation windows only. It never creates a render service,
// starts an authoring instance, or terminates a host-owned process.
app.setName('Lux Studio');
app.setPath('userData', join(app.getPath('appData'), 'Lux', 'Studio'));
const page = join(app.getPath('userData'), 'studio-shell.html');
const pageUrl = pathToFileURL(page).href;
const owned = new Set<BrowserWindow>();
let mainWindow: BrowserWindow | null = null;
let closing = false;
const coordinator = new StudioWindows(async closed => {
  const window = createWindow(true);
  window.once('closed', closed);
  try { await window.loadFile(page, { query: { view: 'preview' } }); }
  catch (error) { window.destroy(); throw error; }
  if (window.isDestroyed()) throw Error('Preview window closed before it was ready');
  window.show(); return window;
}, () => publishState());

function publishState(): void {
  for (const window of owned) if (!window.isDestroyed()) window.webContents.send('studio:window-state', {
    detached: coordinator.detached, fullscreen: window.isFullScreen(),
  });
}
function createWindow(preview: boolean): BrowserWindow {
  const window = new BrowserWindow({
    width: preview ? 1100 : 1440, height: preview ? 720 : 900, minWidth: 620, minHeight: 480,
    show: false, backgroundColor: '#111217', title: preview ? 'Lux — Preview' : 'Lux Studio', autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  owned.add(window);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.on('enter-full-screen', publishState); window.on('leave-full-screen', publishState);
  window.once('closed', () => owned.delete(window));
  return window;
}

app.whenReady().then(async () => {
  // The single-instance lock prevents another UI process overwriting this
  // session's nonce-bearing local page. No renderer service lock is involved.
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  await mkdir(app.getPath('userData'), { recursive: true });
  const template = await readFile(join(__dirname, 'index.html'), 'utf8');
  await writeFile(page, createStudioPage(template, pathToFileURL(__dirname + sep).href, randomBytes(24).toString('base64')));
  ipcMain.handle('studio:window', (event, action: unknown, value: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || !owned.has(window) || event.senderFrame !== event.sender.mainFrame ||
      !isTrustedStudioUrl(event.senderFrame.url, pageUrl)) throw Error('Untrusted Studio window');
    switch (action) {
      case 'state': return { detached: coordinator.detached, fullscreen: window.isFullScreen() };
      case 'popout': if (closing) throw Error('Studio is closing'); return coordinator.popout();
      case 'dock': coordinator.dock(); return;
      case 'fullscreen':
        if (typeof value !== 'boolean') throw Error('Fullscreen requires a boolean');
        window.setFullScreen(value); return;
      default: throw Error('Unsupported presentation action');
    }
  });
  mainWindow = createWindow(false);
  mainWindow.on('close', () => { closing = true; coordinator.dock(); });
  await mainWindow.loadFile(page); mainWindow.show();
}).catch(error => { console.error('Studio startup failed:', error); app.exit(1); });
app.on('second-instance', () => mainWindow?.focus());
app.on('window-all-closed', () => app.quit());
