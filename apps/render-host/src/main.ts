const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { ProducerSession } = require('../../../tools/gpu-spike/producer-session.cjs');
const bridge = require(path.resolve(__dirname, '../../../native/build/Release/lux_texture_bridge.node'));
const output = process.env.LUX_GPU_OUTPUT || path.resolve(__dirname, '../../../evidence/tracer-0.1/tr02-probe');
const duration = Number(process.env.LUX_GPU_DURATION_MS || 8000);
if (!Number.isInteger(duration) || duration < 1000 || duration > 330000) throw Error('Invalid diagnostic duration');
fs.mkdirSync(output, { recursive: true });
const records = [], session = new ProducerSession(bridge);
let count = 0, dropped = 0, failed = false, finishing = false;
let pollTimer, controlTimer, endTimer;
function record(value) {
  if (records.length < 10000) records.push({ utc: new Date().toISOString(), time: process.hrtime.bigint().toString(), ...value });
  else dropped++;
}
function failure(error) { failed = true; record({ kind: 'failure', reason: String(error) }); }
function finish(closed) {
  if (finishing) return;
  finishing = true;
  clearInterval(pollTimer); clearInterval(controlTimer); clearTimeout(endTimer);
  record({ kind: 'summary', paint: count, held: session.held.size, uncertain: session.uncertain.size, dropped, closed, failed });
  fs.writeFileSync(path.join(output, 'probe.json'), JSON.stringify(records, null, 2));
  // The external supervisor owns the final wall-clock deadline if driver teardown stalls.
  app.exit(closed && !failed && !dropped && count > 0 ? 0 : 2);
}
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.setPath('userData', path.join(output, 'profile'));
app.whenReady().then(async () => {
  record({ kind: 'versions', versions: process.versions, pid: process.pid });
  const win = new BrowserWindow({ width: 1920, height: 1080, frame: false, useContentSize: true, show: false, transparent: true,
    webPreferences: { offscreen: { useSharedTexture: true }, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  win.setContentSize(1920, 1080);
  record({ kind: 'bounds', bounds: win.getContentBounds() });
  win.webContents.on('console-message', (_event, ...args) => record({ kind: 'console', args }));
  win.webContents.on('render-process-gone', (_event, details) => { failure(JSON.stringify(details)); finish(false); });
  win.webContents.on('paint', event => {
    if (!event.texture) { failure('paint without shared texture'); return; }
    try {
      const result = session.submit(event.texture);
      count++;
      if (result.id && (result.width !== 1920 || result.height !== 1080)) failure('Unexpected output dimensions');
      if (count <= 10) record({ kind: 'paint', ...result, info: { ...event.texture.textureInfo, handle: 'borrowed-local-NT' } });
    } catch (error) { failure(error); }
  });
  pollTimer = setInterval(() => {
    try { for (const id of session.poll()) record({ kind: 'copy-complete', id }); }
    catch (error) { failure(error); finish(false); }
  }, 1);
  win.webContents.setFrameRate(60);
  await win.loadFile(path.join(__dirname, 'output.html'));
  record({ kind: 'gpu', info: await app.getGPUInfo('complete') });
  bridge.advertise();
  controlTimer = setInterval(() => {
    try { win.webContents.executeJavaScript('window.setIntensity(' + bridge.control() + ')').catch(failure); }
    catch (error) { failure(error); }
  }, 50);
  endTimer = setTimeout(() => {
    session.stop(); win.webContents.stopPainting();
    clearInterval(pollTimer); clearInterval(controlTimer);
    const deadline = performance.now() + 2000;
    pollTimer = setInterval(() => {
      try {
        if (session.drain()) finish(true);
        else if (performance.now() >= deadline) { failure('Shutdown deadline; outstanding ownership retained'); finish(false); }
      } catch (error) { failure(error); finish(false); }
    }, 10);
  }, duration);
}).catch(error => { failure(error); finish(false); });
