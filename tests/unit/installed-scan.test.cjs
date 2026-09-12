const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

test('a host lease removed during directory scan is normal cleanup, while other scan errors remain visible', async () => {
  const runtimeId = 'a'.repeat(64), gone = 'b'.repeat(32), denied = 'c'.repeat(32);
  const local = path.resolve('fixture/local'), root = path.join(local, 'Lux/Installed');
  const runtime = path.join(root, 'runtimes', runtimeId), directory = path.join(root, 'instances', runtimeId);
  const writes = new Map(); let reconciled;
  class Registry {
    entries = new Map(); errors = new Map();
    async reconcile(requests) { reconciled = requests; }
  }
  const context = { __dirname: path.join(runtime, 'apps/installed-runtime/src'), performance: { now: () => 0 },
    setInterval() { return 1; }, clearInterval() {}, setTimeout,
    process: { argv: ['node', 'supervisor', '--lux-runtime-id', runtimeId], env: { LOCALAPPDATA: local }, on() {}, exit() { throw Error('Unexpected exit'); } },
    require(name) {
      if (name === 'node:path' || name === 'node:crypto') return require(name);
      if (name === 'node:fs') return {
        mkdirSync() {}, readdirSync: () => [gone + '.json', denied + '.json'],
        statSync(filename) { throw Object.assign(Error(filename.endsWith(gone + '.json') ? 'Removed after listing' : 'Access denied'),
          { code: filename.endsWith(gone + '.json') ? 'ENOENT' : 'EACCES' }); },
        writeFileSync(filename, value) { writes.set(filename, value); },
      };
      if (name === './registry.cjs') return { InstanceRegistry: Registry, ProducerHealth: class {}, sameInstalledPath: (a, b) => a === b };
      if (name.endsWith('lux_texture_bridge.node')) return { lockSupervisor: () => true };
      if (name.endsWith('package.cjs')) return { validateRuntime() {}, noLinks: value => value };
      throw Error('Unexpected dependency: ' + name);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../apps/installed-runtime/src/supervisor.cjs'), 'utf8'), context);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(reconciled.length, 0);
  assert.equal(writes.has(path.join(directory, gone + '.json.error')), false, 'normal removal must not report a failure');
  assert.match(writes.get(path.join(directory, denied + '.json.error')), /Access denied/);
});
