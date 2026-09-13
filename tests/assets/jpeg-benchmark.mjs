// Decoder-only responsiveness evidence; no renderer or full source admission.
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { decodeJpeg } from '../../packages/assets/src/jpeg.mjs';
import { fixture,findSegment } from './jpeg-fixtures.mjs';
const maximum = fixture('maximum-progressive'), malformed = new Uint8Array(maximum);
const noise = fixture('noise-512'), four = fixture('noise-362');
malformed[findSegment(malformed,0xc2)+5] = 255;
function measure(name, action) {
  const times = [], before = process.memoryUsage();
  for (let i = 0; i < 20; i++) { const at = performance.now(); action(); times.push(performance.now()-at); }
  const after = process.memoryUsage(), sorted = [...times].sort((a,b)=>a-b);
  return {name,firstMs:times[0],medianMs:sorted[10],maxMs:Math.max(...times),rssDelta:after.rss-before.rss,arrayBuffersDelta:after.arrayBuffers-before.arrayBuffers};
}
console.log(JSON.stringify({node:process.version,cpu:cpus()[0].model,bytes:{maximum:maximum.length,noise:noise.length,four:four.length},results:[
  measure('512x512 progressive',()=>decodeJpeg(maximum)),
  measure('two 512x512 progressive images (2 MiB RGBA aggregate)',()=>{decodeJpeg(maximum);decodeJpeg(maximum,{maxRgbaBytes:1048576});}),
  measure('512x512 noisy progressive',()=>decodeJpeg(noise)),
  measure('four 362x362 noisy progressive images',()=>{for (let i = 0; i < 4; i++) decodeJpeg(four,{maxRgbaBytes:2097152-i*362*362*4});}),
  measure('forged height',()=>{ try { decodeJpeg(malformed); throw new Error('accepted malformed image'); } catch (error) { if (error.code !== 'ASSET_BOUNDARY_VIOLATION') throw error; } }),
]},null,2));
