// Synthetic CPU-only checks; no test pixels/results are written as host evidence.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import zlib from 'node:zlib';import {createHash} from 'node:crypto';import {fileURLToPath,pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const out=path.dirname(fileURLToPath(import.meta.url)),configuration=JSON.parse(fs.readFileSync(path.join(out,'configuration.json'),'utf8'));
const inspector=fs.readFileSync(path.join(out,'inspect.mjs'),'utf8').replace(/^import .*\r?\n/m,'').replaceAll('import.meta.url','artifactUrl');
for(const badPixel of [false,true]){
 const pixels=Buffer.alloc(1920*1080*4,255),samples=configuration.reference.samples;let index=0;
 for(const y of [.25,.75])for(const x of [.25,.75]){const at=((1079-Math.floor(y*1080))*1920+Math.floor(x*1920))*4;Buffer.from(samples[index++]).copy(pixels,at);}
 if(badPixel)pixels[((1079-270)*1920+480)*4]=0;
 const now=Date.now(),writes=new Map();
 const fakeFs={readFileSync(file){if(file.endsWith('configuration.json'))return JSON.stringify(configuration);if(file.endsWith('last-experiment.json'))return JSON.stringify({id:'synthetic-selftest',outcome:'success',cleanupComplete:true,start:{utc:new Date(now-100).toISOString()},end:{utc:new Date(now+100).toISOString()}});if(file===configuration.final)return pixels;if(file===configuration.hostLog)return '{"kind":"counters","consumed":2}\n{"kind":"host-telemetry-summary","lostRecords":0}\n';throw Error('Unexpected read: '+file);},statSync:()=>({mtimeMs:now}),writeFileSync:(file,bytes)=>writes.set(file,bytes)};
 const process={};vm.runInNewContext(inspector,{fs:fakeFs,path,zlib,createHash,fileURLToPath,artifactUrl:pathToFileURL(path.join(out,'inspect.mjs')).href,Buffer,Date,process,console:{log(){}}});
 const report=JSON.parse(writes.get(path.join(out,'inspection.json')));assert.equal(report.ok,!badPixel);assert.equal(process.exitCode,badPixel?1:undefined);
 const png=writes.get(path.join(out,'host.png')),idat=[];for(let at=8;at<png.length;){const length=png.readUInt32BE(at),type=png.toString('ascii',at+4,at+8);if(type==='IDAT')idat.push(png.subarray(at+8,at+8+length));at+=length+12;}
 const decoded=zlib.inflateSync(Buffer.concat(idat));const at=270*(1920*4+1)+1+480*4;assert.deepEqual([...decoded.subarray(at,at+4)],report.samples[0]);
}
console.log('Synthetic CPU inspector checks passed: matching grid, wrong-pixel rejection, bottom-up conversion and PNG encoding. No host evidence written.');
