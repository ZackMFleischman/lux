// CPU evidence only. This does not represent full source admission or render timing.
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { deflateSync } from 'node:zlib';
import { decodePng } from '../../packages/assets/src/png.mjs';
import { png } from './png-fixtures.mjs';

function fixture(size, type = 6, noisy = false) {
  const channels = type === 6 ? 4 : 1, rows = new Uint8Array(size*(size*channels+1));
  let random = 123;
  for (let y = 0; y < size; y++) for (let x = 1; x <= size*channels; x++) {
    random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
    rows[y*(size*channels+1)+x] = noisy ? random&255 : (x+y)&255;
  }
  return png({width:size,height:size,type,rows});
}
const maximum = fixture(512), noisy = fixture(512,0,true), four = fixture(362);
const bomb = png({compressed:deflateSync(new Uint8Array(4_000_000))});
function measure(name, action, iterations = 20) {
  const durations = [], before = process.memoryUsage();
  for (let i = 0; i < iterations; i++) { const start = performance.now(); action(); durations.push(performance.now()-start); }
  const after = process.memoryUsage(), ordered = [...durations].sort((a,b)=>a-b);
  return {name,iterations,firstMs:durations[0],medianMs:ordered[Math.floor(iterations/2)],maxMs:Math.max(...durations),rssDelta:after.rss-before.rss,arrayBuffersDelta:after.arrayBuffers-before.arrayBuffers};
}
const results = [
  measure('512x512 RGBA',()=>decodePng(maximum)),
  measure('512x512 noisy grayscale',()=>decodePng(noisy)),
  measure('four 362x362 RGBA decodes',()=>{ for (let i = 0; i < 4; i++) decodePng(four,{maxRgbaBytes:2097152-i*362*362*4}); }),
  measure('tiny IHDR with 4 MB expansion',()=>{ try { decodePng(bomb); throw new Error('bomb accepted'); } catch (error) { if (error.code !== 'ASSET_BOUNDARY_VIOLATION') throw error; } }),
];
console.log(JSON.stringify({node:process.version,cpu:cpus()[0].model,platform:process.platform,bytes:{maximum:maximum.length,noisy:noisy.length,four:four.length,bomb:bomb.length},results},null,2));
