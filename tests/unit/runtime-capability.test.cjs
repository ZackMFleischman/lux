const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {assertRuntimeCapabilities, capabilities} = require('../../packages/export/src/runtime-capability.cjs');
test('new exports require matching liveness-v2 main and compiled worker while legacy checks remain compatible',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lux-liveness-capability-'));
 const write=(relative,text)=>{const filename=path.join(root,relative);fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,text);};
 const main='apps/render-host/src/main.cjs',worker='apps/render-host/src/compiled-worker.js';
 try{
  for(const [relative,marker] of Object.entries(capabilities))write(relative,marker);
  for(const name of ['supervisor','registry','instance'])write('apps/installed-runtime/src/'+name+'.cjs','fixture');
  write(worker,'old worker');
  assert.doesNotThrow(()=>assertRuntimeCapabilities(root));
  assert.throws(()=>assertRuntimeCapabilities(root,{workerLiveness:true}),/main.cjs lacks lux-main-worker-liveness-v2/);
  write(main,capabilities[main]+' lux-main-worker-liveness-v2');
  assert.throws(()=>assertRuntimeCapabilities(root,{workerLiveness:true}),/compiled-worker.js lacks lux-worker-liveness-v2/);
  write(worker,'lux-worker-liveness-v2');assert.doesNotThrow(()=>assertRuntimeCapabilities(root,{workerLiveness:true}));
  write(main,capabilities[main]);assert.throws(()=>assertRuntimeCapabilities(root,{workerLiveness:true}),/main.cjs lacks/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
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
