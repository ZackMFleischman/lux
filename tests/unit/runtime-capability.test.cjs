const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {assertRuntimeCapabilities, capabilities} = require('../../packages/export/src/runtime-capability.cjs');
test('export capability checks reject stale DLL, addon and main without executing them', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-capability-'));
  const write = (relative, text) => { const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), {recursive:true}); fs.writeFileSync(target, text); };
  try {
    for (const [relative, marker] of Object.entries(capabilities)) write(relative, marker);
    for (const name of ['supervisor', 'registry', 'instance']) write('apps/installed-runtime/src/' + name + '.cjs', 'fixture');
    assert.doesNotThrow(() => assertRuntimeCapabilities(root));
    for (const [relative, marker] of Object.entries(capabilities)) {
      write(relative, 'old probe payload');
      assert.throws(() => assertRuntimeCapabilities(root), /Rebuild.*installed runtime/);
      write(relative, marker);
    }
  } finally { fs.rmSync(root, {recursive:true, force:true}); }
});
