import { app, BrowserWindow, ipcMain } from 'electron';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { StudioWindows, isTrustedStudioUrl } from './windows.ts';
import { createStudioPage } from './page.ts';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// This process owns presentation windows only. It never creates a render service,
// starts an authoring instance, or terminates a host-owned process.
app.setName('Lux Studio');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.setPath('userData', join(app.getPath('appData'), 'Lux', 'Studio'));
const page = join(app.getPath('userData'), 'studio-shell.html');
const pageUrl = pathToFileURL(page).href;
const owned = new Set<BrowserWindow>();
let mainWindow: BrowserWindow | null = null;
let closing = false;
let compiling = false;
const workspace = resolve(__dirname, '../../..');
function trusted(event: Electron.IpcMainInvokeEvent): boolean {
  const window = BrowserWindow.fromWebContents(event.sender);
  return !!window && owned.has(window) && event.senderFrame === event.sender.mainFrame && isTrustedStudioUrl(event.senderFrame.url, pageUrl);
}
async function compile(source: unknown): Promise<unknown> {
  if (compiling) throw Error('Another compile is in progress');
  const encoded = JSON.stringify(source);
  if (!encoded || Buffer.byteLength(encoded) > 8388608) throw Error('Source request exceeds its limit');
  const executable = process.env.LUX_NODE_EXECUTABLE;
  if (!executable) throw Error('Start Studio with pnpm studio');
  compiling = true;
  try { return await new Promise((done, reject) => {
    const child = spawn(executable, [join(workspace, 'scripts/studio-compile.mjs')], { cwd: workspace, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', bytes = 0;
    const timer = setTimeout(() => { child.kill(); reject(Error('Compile/link deadline exceeded')); }, 75000);
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 18000000) { child.kill(); reject(Error('Compile result exceeded its limit')); } else output += chunk; });
    child.stderr.resume();
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); try { if (code !== 0) throw Error('Compiler process failed'); done(JSON.parse(output)); } catch (error) { reject(error); } });
    child.stdin.on('error', () => {}); child.stdin.end(encoded);
  }); } finally { compiling = false; }
}
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
  ipcMain.handle('studio:authoring', async (event, action: unknown, value: unknown) => {
    if (!trusted(event) || BrowserWindow.fromWebContents(event.sender) !== mainWindow) throw Error('Untrusted authoring sender');
    if (action === 'example') return { sdkVersion: '0.1.0', entry: 'visual.ts', files: { 'visual.ts': await readFile(join(workspace, 'packages/visual-sdk/examples/intensity.ts'), 'utf8') } };
    if (action === 'compile') return compile(value);
    if (action === 'smoke-enabled') return process.env.LUX_STUDIO_SMOKE === '1';
    if (action === 'smoke-result' && process.env.LUX_STUDIO_SMOKE === '1') {
      const directory = join(workspace, 'artifacts/studio-smoke'); await mkdir(directory, { recursive: true });
      const capture = (value as { capture?: { bytes: ArrayBuffer } })?.capture;
      if (capture?.bytes instanceof ArrayBuffer && capture.bytes.byteLength <= 8388608) await writeFile(join(directory, 'output.png'), Buffer.from(capture.bytes));
      await writeFile(join(directory, 'result.json'), JSON.stringify(value, null, 2));
      await writeFile(join(directory, 'studio.png'), (await mainWindow!.webContents.capturePage()).toPNG());
      setTimeout(() => app.exit((value as { ok?: boolean })?.ok ? 0 : 2), 100); return;
    }
    throw Error('Unsupported authoring operation');
  });
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
  if (process.env.LUX_STUDIO_SMOKE === '1') setTimeout(() => { console.error('Studio smoke timeout'); app.exit(3); }, 90000);
  mainWindow.webContents.on('console-message', details => console.log('Studio:', details.message));
  await mainWindow.loadFile(page); mainWindow.show();
}).catch(error => { console.error('Studio startup failed:', error); app.exit(1); });
app.on('second-instance', () => mainWindow?.focus());
app.on('window-all-closed', () => app.quit());
