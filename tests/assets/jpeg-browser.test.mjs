import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { fixture } from './jpeg-fixtures.mjs';

test('JPEG browser bundle decodes without platform codec or encoder imports', async () => {
  const bundle = await build({entryPoints:['packages/assets/src/jpeg.mjs'],bundle:true,platform:'browser',format:'iife',globalName:'LuxJpeg',write:false,metafile:true,legalComments:'inline'});
  const scope = {Uint8Array,Uint16Array,Uint32Array,Int8Array,Int32Array,DataView};
  runInNewContext(bundle.outputFiles[0].text,scope);
  const result = scope.LuxJpeg.decodeJpeg(fixture('progressive'));
  assert.equal(result.width,32); assert.equal(result.height,24); assert.equal(result.data[3],255);
  const output = Object.values(bundle.metafile.outputs)[0];
  assert.deepEqual(output.imports,[]);
  assert.ok(!Object.entries(output.inputs).some(([path,info])=>path.endsWith('/jpeg-js/lib/encoder.js') && info.bytesInOutput > 0));
});
