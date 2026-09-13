import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { png } from './png-fixtures.mjs';

test('browser bundle decodes without platform codecs and excludes encoder payload', async () => {
  const bundle = await build({entryPoints:['packages/assets/src/png.mjs'],bundle:true,platform:'browser',format:'iife',globalName:'LuxPng',write:false,metafile:true,legalComments:'inline'});
  const scope = {Uint8Array,Uint16Array,Uint32Array,Int32Array,DataView,TextDecoder,TextEncoder};
  runInNewContext(bundle.outputFiles[0].text,scope);
  assert.deepEqual([...scope.LuxPng.decodePng(png()).data],[255,0,0,128]);
  assert.throws(()=>scope.LuxPng.decodePng(png({compressed:new Uint8Array([1,2,3])})),{code:'ASSET_BOUNDARY_VIOLATION'});
  const output = Object.values(bundle.metafile.outputs)[0];
  assert.deepEqual(output.imports,[]);
  const inputs = Object.entries(output.inputs).filter(([,info])=>info.bytesInOutput > 0).map(([path])=>path);
  assert.ok(inputs.some(path=>path.includes('png_decoder.js')));
  assert.ok(!inputs.some(path=>path.includes('png_encoder.js') || path.includes('node-worker') || path.endsWith('/pako/lib/deflate.js')));
});
