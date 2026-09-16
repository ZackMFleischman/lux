import { app, BrowserWindow, ipcMain, dialog, clipboard } from 'electron';
import { join, sep, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { StudioWindows, isTrustedStudioUrl } from './windows.ts';
import { createStudioPage } from './page.ts';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { SceneFileStore } from '../../../packages/core/src/scene-file.ts';
import { createAgentBridge } from './agent-bridge.ts';
import { observeFullscreen } from './fullscreen.ts';
import { createExportService, runExportChild } from './export-process.ts';
import { createCloseConfirmation } from './close-confirmation.ts';
import { resolveStudioSession } from '../../../scripts/studio-session.mjs';
import { ComponentLibraryStore } from '../../../packages/core/src/component-library-store.ts';
import { LookStore } from '../../../packages/core/src/look-store.ts';
import type { SourceBundle } from '../../../packages/runtime-contracts/src/index.ts';
import { resolveStandardLibrary } from './standard-library.ts';

// This process owns presentation windows only. It never creates a render service,
// starts an authoring instance, or terminates a host-owned process.
app.setName('Lux Studio');
if (process.platform === 'win32') app.setAppUserModelId('Lux.Studio');
app.commandLine.appendSwitch('force_high_performance_gpu');
const workspace = process.env.LUX_WORKSPACE ? resolve(process.env.LUX_WORKSPACE) : resolve(__dirname, '../../..');
const studioProfile = resolveStudioSession({ workspace, appData: app.getPath('appData') });
const studioSession = { profile: studioProfile.profile, workspace: studioProfile.workspace,
  sessionId: randomBytes(18).toString('hex'), pid: process.pid };
mkdirSync(studioProfile.directory, { recursive: true });
app.setPath('userData', studioProfile.directory);
app.setPath('sessionData', studioProfile.directory);
const page = join(app.getPath('userData'), 'studio-shell.html');
const pageUrl = pathToFileURL(page).href;
const owned = new Set<BrowserWindow>();
const fullscreenStates = new Map<BrowserWindow, () => boolean>();
let mainWindow: BrowserWindow | null = null;
let closing = false;
let compiling = false;
const files = new SceneFileStore();
const standardLibrary = resolveStandardLibrary({ workspace, appData: app.getPath('appData'),
  desktop: process.env.LUX_STUDIO_DESKTOP === '1', overrideRoot: process.env.LUX_STUDIO_LIBRARY_ROOT,
  canonicalRoot: process.env.LUX_STUDIO_CANONICAL_LIBRARY_ROOT });
const library = new ComponentLibraryStore(standardLibrary.root,{legacyPath:join(studioProfile.directory,'component-library.json'),
 seedRoots:standardLibrary.seedRoots,validateCandidate:async source=>{
  const result=await compile({...source,sdkVersion:'0.3.0'} as SourceBundle) as {ok?:boolean;linked?:{linkedVersion?:number};diagnostics?:readonly {message?:string}[]};
  if(!result.ok)throw Error(result.diagnostics?.map(item=>item.message).filter(Boolean).join('; ')||'Library component candidate did not compile');
  if(result.linked?.linkedVersion!==4)throw Error('Library component candidate did not produce a component build');
}});
let dirty = false;
const closeConfirmation = createCloseConfirmation(() => randomBytes(16).toString('hex'), id => mainWindow?.webContents.send('studio:close-request', id));
const agentRequests = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
const exportShutdown = new AbortController();
const exportService = createExportService({
  chooseDirectory: async () => {
    if (!mainWindow || mainWindow.isDestroyed() || closing) throw Error('Studio is closing');
    const selection = await dialog.showOpenDialog(mainWindow, { title: 'Choose export output folder', properties: ['openDirectory', 'createDirectory'] });
    return selection.canceled ? null : selection.filePaths[0] ?? null;
  },
  run: request => {
    const executable = process.env.LUX_NODE_EXECUTABLE;
    if (!executable) throw Error('Start Studio with pnpm studio');
    return runExportChild(request, { workspace, executable, signal: exportShutdown.signal });
  },
});
app.once('will-quit', () => exportShutdown.abort());
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
    detached: coordinator.detached, fullscreen: fullscreenStates.get(window)?.() ?? window.isFullScreen(),
  });
}
function createWindow(preview: boolean): BrowserWindow {
  const window = new BrowserWindow({
    width: preview ? 1100 : 1440, height: preview ? 720 : 900, minWidth: 620, minHeight: 480,
    show: false, backgroundColor: '#111217', title: preview ? 'Lux — Preview' : 'Lux Studio', autoHideMenuBar: true,
    icon: join(__dirname, 'lux-icon.png'),
    webPreferences: { preload: join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true,
      additionalArguments: process.env.LUX_STUDIO_DESKTOP === '1' ? ['--lux-no-export'] : [] },
  });
  owned.add(window);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  fullscreenStates.set(window, observeFullscreen(window, publishState));
  window.once('closed', () => { owned.delete(window); fullscreenStates.delete(window); });
  return window;
}

app.whenReady().then(async () => {
  // The single-instance lock prevents another UI process overwriting this
  // session's nonce-bearing local page. No renderer service lock is involved.
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  let markAgentReady = () => {};
  const agentReady = new Promise<void>(resolve => { markAgentReady = resolve; });
  ipcMain.handle('studio:agent-ready', event => {
    if (!trusted(event)) throw Error('Untrusted agent listener');
    if (BrowserWindow.fromWebContents(event.sender) === mainWindow) markAgentReady();
  });
  await mkdir(app.getPath('userData'), { recursive: true });
  const template = await readFile(join(__dirname, 'index.html'), 'utf8');
  await writeFile(page, createStudioPage(template, pathToFileURL(__dirname + sep).href, randomBytes(24).toString('base64')));
  ipcMain.handle('studio:export', (event, request: unknown) => {
    if (!trusted(event) || BrowserWindow.fromWebContents(event.sender) !== mainWindow) throw Error('Untrusted export sender');
    if (process.env.LUX_STUDIO_DESKTOP === '1') throw Error('Resolume export is not included in this desktop build.');
    return exportService.create(request);
  });
  ipcMain.handle('studio:library',async(event,action:unknown,value:unknown)=>{
    if(!trusted(event)||BrowserWindow.fromWebContents(event.sender)!==mainWindow)throw Error('Untrusted library sender');
    if(action==='location')return standardLibrary;
    if(action==='list')return library.list();
    if(action==='read')return library.read(value as string);
    if(action==='create')return library.create(value as Parameters<ComponentLibraryStore['create']>[0]);
    if(action==='update')return library.update(value as Parameters<ComponentLibraryStore['update']>[0]);
    if(action==='copy-request'){
      const component=await library.read(value as string);
      const request=`Read the current Lux scene with lux.studio.read. Read library component ${component.name} (${component.id}) with lux.library.read. Add one linked instance under a unique library/<name> mount path. Preserve the existing scene source and libraryLinks. Submit the complete source with lux.studio.build and include the component ID and mountPath in libraryLinks. Then confirm the actual preview.`;
      clipboard.writeText(request);return request;
    }
    throw Error('Unsupported library operation');
  });
  const looks = new LookStore(join(studioProfile.directory, 'looks'));
  ipcMain.handle('studio:looks', async (event, action: unknown, value: unknown) => {
    if (!trusted(event) || BrowserWindow.fromWebContents(event.sender) !== mainWindow) throw Error('Untrusted Looks sender');
    if (action === 'list') return looks.list();
    if (action === 'read') return looks.read(value as string);
    if (action === 'save') return looks.save(value as Parameters<LookStore['save']>[0]);
    throw Error('Unsupported Looks operation');
  });
  ipcMain.handle('studio:authoring', async (event, action: unknown, value: unknown) => {
    if (!trusted(event) || BrowserWindow.fromWebContents(event.sender) !== mainWindow) throw Error('Untrusted authoring sender');
    if (action === 'example') return { sdkVersion: '0.1.0', entry: 'visual.ts', files: { 'visual.ts': await readFile(join(workspace, 'packages/visual-sdk/examples/intensity.ts'), 'utf8') } };
    if (action === 'compile') return compile(value);
    if (action === 'smoke-enabled') return process.env.LUX_STUDIO_SMOKE === '1';
    if (action === 'dirty') { if (typeof value !== 'boolean') throw Error('Invalid dirty state'); dirty = value; return; }
    if (action === 'close-confirmation') {
      const answer = value as { id?: unknown; discard?: unknown };
      if (typeof answer?.id !== 'string' || typeof answer.discard !== 'boolean') throw Error('Invalid close confirmation');
      if (closeConfirmation.reply(answer.id, answer.discard)) setTimeout(() => mainWindow?.close(), 0);
      return;
    }
    if (action === 'open') {
      const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile'], filters: [{ name: 'Lux visual', extensions: ['lux-scene'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      return files.open(result.filePaths[0]);
    }
    if (action === 'open-path') {
      if (typeof value !== 'string' || !isAbsolute(value) || !value.toLowerCase().endsWith('.lux-scene')) throw Error('Use an absolute .lux-scene path');
      return files.open(value);
    }
    if (action === 'save') {
      const request = value as { token?: string; document?: unknown; saveAs?: boolean };
      if (request?.token && !request.saveAs) return files.save(request.token, request.document);
      const result = await dialog.showSaveDialog(mainWindow!, { defaultPath: 'Untitled.lux-scene', filters: [{ name: 'Lux visual', extensions: ['lux-scene'] }] });
      if (result.canceled || !result.filePath) return null;
      return files.saveAs(result.filePath, request?.document,{overwrite:true});
    }
    if (action === 'save-path') {
      const request=value as {path?:unknown;document?:unknown;overwrite?:unknown};
      if(typeof request?.path!=='string'||!isAbsolute(request.path)||!request.path.toLowerCase().endsWith('.lux-scene')||typeof request.overwrite!=='boolean')throw Error('Use an absolute .lux-scene path and explicit overwrite flag');
      return files.saveAs(request.path,request.document,{overwrite:request.overwrite});
    }
    if (action === 'smoke-save' && process.env.LUX_STUDIO_SMOKE === '1') {
      const folder = join(workspace, 'artifacts/studio-smoke'); await mkdir(folder, { recursive: true });
      const path = join(folder, 'roundtrip.lux-scene'); await files.saveAs(path, value,{overwrite:true}); return files.open(path);
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
      case 'state': return { detached: coordinator.detached, fullscreen: fullscreenStates.get(window)?.() ?? window.isFullScreen() };
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
    agentRequests.set(id, { resolve: result => resolve(method === 'status' ? { ...(result as object), studioSession } : result), reject, timer }); mainWindow.webContents.send('studio:agent-command', { id, method, params });
  }));
  app.once('will-quit', () => { bridge.close(); for (const pending of agentRequests.values()) { clearTimeout(pending.timer); pending.reject(Error('Studio closed')); } agentRequests.clear(); });
  mainWindow.on('close', event => {
    if (process.env.LUX_STUDIO_SMOKE !== '1' && !closeConfirmation.allowClose(dirty)) { event.preventDefault(); return; }
    closing = true; coordinator.dock();
  });
  if (process.env.LUX_STUDIO_SMOKE === '1') setTimeout(() => { console.error('Studio smoke timeout'); app.exit(3); }, 90000);
  if (process.env.LUX_STUDIO_MCP_TEST === '1') setTimeout(() => { console.error('Studio MCP test timeout'); app.exit(3); }, 120000);
  mainWindow.webContents.on('console-message', details => console.log('Studio:', details.message));
  await mainWindow.loadFile(page);
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([agentReady, new Promise<never>((_, reject) => {
      readyTimer = setTimeout(() => reject(Error('Studio agent listener did not become ready')), 30000);
    })]);
  } finally { clearTimeout(readyTimer); }
  const endpointTemp = `${studioProfile.endpointPath}.${studioSession.sessionId}.tmp`;
  await writeFile(endpointTemp, JSON.stringify({ version: 1, ...studioSession, url: bridge.url, token: bridge.token }));
  await rename(endpointTemp, studioProfile.endpointPath);
  mainWindow.show();
}).catch(error => { console.error('Studio startup failed:', error); app.exit(1); });
app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
});
app.on('window-all-closed', () => app.quit());
