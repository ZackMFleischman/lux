'use strict';
// Run using the pinned Electron executable in Node mode. This process creates
// no Electron windows or GPU devices. Each producer owns a separate Windows Job.
const fs = require('node:fs'), path = require('node:path');
const {InstanceRegistry, validateRequest} = require('./registry.cjs');
const runtimeDirectory = path.resolve(__dirname, '../../..');
const runtimeId = process.argv[process.argv.indexOf('--lux-runtime-id') + 1];
if (!/^[a-f0-9]{64}$/.test(runtimeId) || path.basename(runtimeDirectory) !== runtimeId) throw Error('Installed runtime identity/path mismatch');
const root = path.resolve(runtimeDirectory, '../..');
if (root !== path.resolve(process.env.LOCALAPPDATA, 'Lux/Installed')) throw Error('Installed playback requires the default install location');
const directory = path.join(root, 'instances', runtimeId);
fs.mkdirSync(directory, {recursive:true});
const bridge = require(path.join(runtimeDirectory, 'native/build/Release/lux_texture_bridge.node'));
if (!bridge.lockSupervisor(runtimeId)) process.exit(0);
const {validateRuntime, validateRelease, noLinks} = require(path.join(runtimeDirectory, 'package.cjs'));
const ready = path.join(directory, 'supervisor.ready');
// Validate the immutable distribution once on cold start, never per loaded copy.
try { validateRuntime(runtimeDirectory, runtimeId); }
catch (error) { fs.writeFileSync(path.join(directory, 'supervisor.error'), String(error.stack || error)); process.exit(2); }
let closing = false, ticking = false, idleSince = Date.now();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const registry = new InstanceRegistry({runtimeId, start: async request => {
  const release = validateRelease(path.join(root, 'releases', request.releaseId), request.releaseId);
  if (release.runtimeId !== runtimeId) throw Error('Source release requires a different installed runtime');
  const requestPath = noLinks(path.join(directory, request.instanceId + '.json'));
  const stopPath = path.join(directory, request.instanceId + '.stop');
  fs.rmSync(stopPath, {force:true});
  const key = bridge.installedStart(path.join(runtimeDirectory, 'electron/electron.exe'), path.join(__dirname, 'instance.cjs'), requestPath);
  let closed = false;
  return {
    get exited() { return closed || !bridge.installedRunning(key); },
    async stop() {
      if (closed) return;
      fs.writeFileSync(stopPath, 'stop');
      const deadline = Date.now() + 3000;
      while (bridge.installedRunning(key) && Date.now() < deadline) await delay(25);
      bridge.installedStop(key); closed = true;
      fs.rmSync(path.join(directory, request.instanceId + '.rendezvous'), {force:true});
    },
  };
}});
async function close() {
  if (closing) return; closing = true; clearInterval(timer);
  await registry.close(); fs.rmSync(ready, {force:true}); process.exit(0);
}
async function tick() {
  if (ticking || closing) return; ticking = true;
  try {
    fs.writeFileSync(ready, String(process.pid));
    const requests = [];
    for (const name of fs.readdirSync(directory).filter(name => /^[a-f0-9]{32}\.json$/.test(name)).slice(0, 64)) {
      try {
        const filename = noLinks(path.join(directory, name)), stat = fs.statSync(filename);
        if (Date.now() - stat.mtimeMs > 10000) { fs.rmSync(filename, {force:true}); continue; }
        if (stat.size > 512) throw Error('Installed request exceeds limit');
        const request = validateRequest(JSON.parse(fs.readFileSync(filename, 'utf8')), runtimeId);
        if (name !== request.instanceId + '.json') throw Error('Instance request filename mismatch');
        try { process.kill(request.hostPid, 0); } catch { continue; }
        requests.push(request);
      } catch (error) { fs.writeFileSync(path.join(directory, name + '.error'), String(error.message || error)); }
    }
    await registry.reconcile(requests, Date.now());
    for (const [instanceId, error] of registry.errors) fs.writeFileSync(path.join(directory, instanceId + '.error'), error);
    if (registry.entries.size) idleSince = Date.now();
    else if (Date.now() - idleSince >= 30000) await close();
  } catch (error) { fs.writeFileSync(path.join(directory, 'supervisor.error'), String(error.stack || error)); await close(); }
  finally { ticking = false; }
}
const timer = setInterval(() => void tick(), 250);
process.on('SIGINT', () => void close()); process.on('SIGTERM', () => void close());
void tick();
