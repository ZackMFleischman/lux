const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const bridge = require('../../native/build/Release/lux_texture_bridge.node');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
test('installed Jobs own independent CPU child processes and strip Electron Node mode', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-installed-cpu-'));
  const script = path.join(directory, 'child with spaces.cjs');
  fs.writeFileSync(script, "require('node:fs').writeFileSync(process.argv[2], JSON.stringify({pid:process.pid,nodeMode:process.env.ELECTRON_RUN_AS_NODE}));setInterval(()=>{},1000)");
  const old = process.env.ELECTRON_RUN_AS_NODE; process.env.ELECTRON_RUN_AS_NODE = '1';
  let first, second;
  try {
    first = bridge.installedStart(process.execPath, script, path.join(directory, 'first.json'));
    second = bridge.installedStart(process.execPath, script, path.join(directory, 'second.json'));
    const deadline = Date.now() + 5000;
    while ((!fs.existsSync(path.join(directory, 'first.json')) || !fs.existsSync(path.join(directory, 'second.json'))) && Date.now() < deadline) await delay(20);
    const a = JSON.parse(fs.readFileSync(path.join(directory, 'first.json'))), b = JSON.parse(fs.readFileSync(path.join(directory, 'second.json')));
    assert.notEqual(a.pid, b.pid); assert.equal(a.nodeMode, undefined); assert.equal(b.nodeMode, undefined);
    assert.equal(bridge.installedRunning(first), true); assert.equal(bridge.installedRunning(second), true);
    bridge.installedStop(first); first = undefined;
    assert.equal(bridge.installedRunning(second), true);
  } finally {
    if (first !== undefined) bridge.installedStop(first);
    if (second !== undefined) bridge.installedStop(second);
    if (old === undefined) delete process.env.ELECTRON_RUN_AS_NODE; else process.env.ELECTRON_RUN_AS_NODE = old;
    for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name)); fs.rmdirSync(directory);
  }
});
