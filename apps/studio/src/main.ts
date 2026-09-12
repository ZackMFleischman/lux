import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { StudioWindows, isTrustedStudioUrl } from './windows.ts';
import { createStudioPage } from './page.ts';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { SceneFileStore } from '../../../packages/core/src/scene-file.ts';
import { createAgentBridge } from './agent-bridge.ts';

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
const files = new SceneFileStore();
let dirty = false, closeConfirmed = false;
const agentRequests = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
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
    if (action === 'dirty') { if (typeof value !== 'boolean') throw Error('Invalid dirty state'); dirty = value; return; }
    if (action === 'open') {
      const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile'], filters: [{ name: 'Lux visual', extensions: ['lux-scene'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      return files.open(result.filePaths[0]);
    }
    if (action === 'save') {
      const request = value as { token?: string; document?: unknown; saveAs?: boolean };
      if (request?.token && !request.saveAs) return files.save(request.token, request.document);
      const result = await dialog.showSaveDialog(mainWindow!, { defaultPath: 'Untitled.lux-scene', filters: [{ name: 'Lux visual', extensions: ['lux-scene'] }] });
      if (result.canceled || !result.filePath) return null;
      return files.saveAs(result.filePath, request?.document);
    }
    if (action === 'smoke-save' && process.env.LUX_STUDIO_SMOKE === '1') {
      const folder = join(workspace, 'artifacts/studio-smoke'); await mkdir(folder, { recursive: true });
      const path = join(folder, 'roundtrip.lux-scene'); await files.saveAs(path, value); return files.open(path);
    }
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
  ipcMain.handle('studio:agent-result', (event, id: string, result: { ok: boolean; result?: unknown; error?: string }) => {
    if (!trusted(event) || BrowserWindow.fromWebContents(event.sender) !== mainWindow) throw Error('Untrusted authoring reply');
    const pending = agentRequests.get(id); if (!pending) return;
    clearTimeout(pending.timer); agentRequests.delete(id);
    result.ok ? pending.resolve(result.result) : pending.reject(Error(result.error || 'Authoring operation failed'));
  });
  const bridge = await createAgentBridge((method, params) => new Promise((resolve, reject) => {
    if (process.env.LUX_STUDIO_MCP_TEST === '1' && method === 'status' && (params as { shutdown?: boolean })?.shutdown) {
      resolve({ closing: true }); setTimeout(() => app.exit(0), 100); return;
    }
    if (!mainWindow || mainWindow.isDestroyed()) { reject(Error('Studio is closed')); return; }
    const id = randomBytes(16).toString('hex');
    const timer = setTimeout(() => { agentRequests.delete(id); reject(Error('Studio did not finish the operation in time')); }, 70000);
    agentRequests.set(id, { resolve, reject, timer }); mainWindow.webContents.send('studio:agent-command', { id, method, params });
  }));
  await writeFile(join(app.getPath('userData'), 'agent-endpoint.json'), JSON.stringify({ url: bridge.url, token: bridge.token, pid: process.pid }));
  app.once('will-quit', () => { bridge.close(); for (const pending of agentRequests.values()) { clearTimeout(pending.timer); pending.reject(Error('Studio closed')); } agentRequests.clear(); });
  mainWindow.on('close', event => {
    if (!dirty || closeConfirmed || process.env.LUX_STUDIO_SMOKE === '1') return;
    event.preventDefault();
    void dialog.showMessageBox(mainWindow!, { type: 'question', message: 'Close without saving your changes?', buttons: ['Keep editing', 'Discard changes'], defaultId: 0, cancelId: 0 }).then(result => {
      if (result.response === 1) { closeConfirmed = true; mainWindow?.close(); }
    });
  });
  mainWindow.on('close', () => { closing = true; coordinator.dock(); });
  if (process.env.LUX_STUDIO_SMOKE === '1') setTimeout(() => { console.error('Studio smoke timeout'); app.exit(3); }, 90000);
  if (process.env.LUX_STUDIO_MCP_TEST === '1') setTimeout(() => { console.error('Studio MCP test timeout'); app.exit(3); }, 120000);
  mainWindow.webContents.on('console-message', details => console.log('Studio:', details.message));
  await mainWindow.loadFile(page); mainWindow.show();
}).catch(error => { console.error('Studio startup failed:', error); app.exit(1); });
app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
});
app.on('window-all-closed', () => app.quit());
