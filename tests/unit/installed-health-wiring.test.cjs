const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');
const registry = require('../../apps/installed-runtime/src/registry.cjs');
test('each attempt gets its own health/profile channel but watches the original host lease', () => {
  const runtimeId = 'a'.repeat(64), instanceId = 'b'.repeat(32), directory = path.resolve('fixture/Installed');
  const runtime = path.join(directory, 'runtimes', runtimeId), instances = path.join(directory, 'instances', runtimeId);
  const source = fs.readFileSync(path.join(__dirname, '../../apps/installed-runtime/src/instance.cjs'), 'utf8');
  function run(attemptId, foreign = false) {
    const requestPath = path.join(instances, foreign ? 'other.attempts' : instanceId + '.attempts', attemptId + '.json');
    const context = { __dirname: path.join(runtime, 'apps/installed-runtime/src'), process: { argv: ['node', 'instance.cjs', requestPath], env: {} },
      require(name) {
        if (name === 'node:fs') return { statSync: () => ({ size: 256 }), readFileSync: () => JSON.stringify({ version: 1, runtimeId, releaseId: 'c'.repeat(64), instanceId, hostPid: 42 }) };
        if (name === 'node:path') return path;
        if (name === './registry.cjs') return registry;
        if (name.endsWith('package.cjs')) return { noLinks: value => value, validateRelease: () => ({ runtimeId, transportHash: 'transport' }) };
        if (name.endsWith('main.cjs')) return {};
        throw Error('Unexpected dependency: ' + name);
      } };
    vm.runInNewContext(source, context); return context;
  }
  const first = run('1'.repeat(32)), second = run('2'.repeat(32));
  assert.equal(first.luxInstalledContext.requestPath, path.join(instances, instanceId + '.json'));
  assert.equal(first.luxInstalledContext.requestPath, second.luxInstalledContext.requestPath);
  assert.notEqual(first.luxInstalledContext.healthPath, second.luxInstalledContext.healthPath);
  assert.notEqual(first.process.env.LUX_GPU_OUTPUT, second.process.env.LUX_GPU_OUTPUT);
  assert.equal(first.luxInstalledContext.protocol, 'lux-installed-render-host-v2');
  assert.throws(() => run('3'.repeat(32), true), /path mismatch/);
});
test('producer main publishes bounded health while Electron loadFile remains pending, without claiming readiness', async () => {
  const intervals = [], files = new Map(), pendingLoad = new Promise(() => {});
  class FakeWindow {
    constructor() { this.webContents = { on() {}, setFrameRate() {} }; }
    setContentSize() {} getContentBounds() { return {}; } loadFile() { return pendingLoad; }
  }
  const app = { commandLine: { appendSwitch() {} }, setPath() {}, whenReady: () => Promise.resolve(), getGPUInfo: () => assert.fail('must still be awaiting loadFile') };
  const context = { globalThis: { luxInstalledContext: { protocol: 'lux-installed-render-host-v2', attemptId: 'a'.repeat(32), healthPath: 'health.status' } },
    __dirname: path.resolve('fixture/runtime/apps/render-host/src'), performance: { now: () => 0 },
    process: { env: { LUX_TRANSPORT_BUNDLE: 'bundle', LUX_TRANSPORT_PLAYBACK: '1', LUX_TRANSPORT_STOP: 'stop', LUX_GPU_OUTPUT: 'output' }, versions: {}, pid: 42, hrtime: { bigint: () => 0n } },
    setInterval(callback, ms) { intervals.push({ callback, ms }); return intervals.length; }, clearInterval() {}, clearTimeout() {},
    require(name) {
      if (name === 'electron') return { app, BrowserWindow: FakeWindow };
      if (name === 'node:fs') return { mkdirSync() {}, writeFileSync(name, data) { files.set(name, data); }, renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); } };
      if (name === 'node:path') return path;
      if (name.endsWith('producer-session.cjs')) return require('../../tools/gpu-spike/producer-session.cjs');
      if (name.endsWith('host-startup.cjs')) return require('../../tools/gpu-spike/host-startup.cjs');
      if (name.endsWith('frame-progress.cjs')) return require('../../tools/gpu-spike/frame-progress.cjs');
      if (name.endsWith('transport-release.cjs')) return { readTransportRelease: () => ({ sourceHash: 'hash', linked: {}, settings: {} }) };
      if (name.endsWith('.node')) return {};
      throw Error('Unexpected dependency: ' + name);
    } };
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../../apps/render-host/src/main.ts'), 'utf8'));
  vm.runInNewContext(source, context); await Promise.resolve();
  const sample = JSON.parse(files.get('health.status')); assert.equal(sample.sequence, 1); assert.equal(sample.ready, false);
  assert.equal(sample.frameId, '0'); assert.equal(sample.completedFrames, 0); assert.ok(Buffer.byteLength(files.get('health.status')) < 512);
  intervals.find(timer => timer.ms === 250).callback();
  assert.equal(JSON.parse(files.get('health.status')).sequence, 2); assert.equal(JSON.parse(files.get('health.status')).ready, false);
});
