import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
const red = 'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA==';
test('dedicated browser admission worker independently validates source bytes', async () => {
  const bundle = await build({entryPoints:['apps/studio/src/source/admission-worker.mjs'],bundle:true,platform:'browser',format:'iife',write:false,metafile:true});
  const replies = [], scope = {Uint8Array,DataView,TextEncoder,postMessage:reply=>replies.push(JSON.parse(JSON.stringify(reply)))};
  const source = data=>({sourceVersion:2,sdkVersion:'0.2.0',entry:'main.ts',files:{'main.ts':'export {}'},assets:{'assets/red.bmp':{mediaType:'image/bmp',encoding:'base64',data}}});
  runInNewContext(bundle.outputFiles[0].text,scope);
  for (const [id,data] of [[1,red],[2,'AA==']]) {
    scope.requestJson = JSON.stringify({id,source:source(data)});
    runInNewContext('onmessage({data:JSON.parse(requestJson)})',scope);
  }
  assert.deepEqual(replies[0],{id:1,ok:true});
  assert.equal(replies[1].id,2); assert.equal(replies[1].ok,false); assert.equal(replies[1].code,'SOURCE_BOUNDARY_VIOLATION');
  assert.deepEqual(Object.values(bundle.metafile.outputs)[0].imports,[]);
});
