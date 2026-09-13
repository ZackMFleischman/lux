import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
const main='apps/render-host/src/main.ts';
// TypeScript 7 does not expose the old transpileModule API. The experimental
// entrypoint is CommonJS with erasable types; Node performs syntax-only emission.
fs.writeFileSync('apps/render-host/src/main.cjs',stripTypeScriptTypes(fs.readFileSync(main,'utf8')));
await build({entryPoints:['tools/gpu-spike/runtime-validation.mjs'],outfile:'tools/gpu-spike/runtime-validation.cjs',bundle:true,platform:'node',format:'cjs',target:'node24'});
await build({entryPoints:['apps/studio/src/visual-worker.mjs'],outfile:'apps/render-host/src/compiled-worker.js',
  bundle:true,platform:'browser',format:'esm',target:'chrome140'});
for(const filename of ['apps/render-host/src/main.cjs','apps/render-host/src/visual-worker.js','tools/gpu-spike/recorder.cjs','tools/gpu-spike/producer-session.cjs']) {
 const check=spawnSync(process.execPath,['--check',filename],{encoding:'utf8'});
 if(check.status!==0)throw new Error(check.stderr);
}
console.log('GPU spike main emitted; worker/recorder syntax checked (not a semantic TypeScript check).');
