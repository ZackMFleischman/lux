// CPU-only inspection. Uses Node builtins, no Electron, image codec or dev module.
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const out=path.dirname(fileURLToPath(import.meta.url)),c=JSON.parse(fs.readFileSync(path.join(out,'configuration.json'),'utf8'));
const report={ok:false,scope:'single-installed-native-fixture-pixel-check',actualResolumeTested:false,performanceAcceptance:false,releaseId:c.releaseId,runtimeId:c.runtimeId,tolerance:5,limitations:c.limitations};
try{
 const experiment=JSON.parse(fs.readFileSync(path.join(out,'last-experiment.json'),'utf8'));report.experiment={id:experiment.id,outcome:experiment.outcome,cleanupComplete:experiment.cleanupComplete};
 if(experiment.outcome!=='success'||experiment.cleanupComplete!==true)throw Error('Fixture or supervised cleanup did not succeed');
 const bytes=fs.readFileSync(c.final),width=1920,height=1080;if(bytes.length!==width*height*4)throw Error('Invalid native capture size');
 const modified=fs.statSync(c.final).mtimeMs;if(modified<Date.parse(experiment.start.utc)-1000||modified>Date.parse(experiment.end.utc)+1000)throw Error('Capture is outside the experiment window');
 report.captureSha256=createHash('sha256').update(bytes).digest('hex');
 report.samples=[0.25,0.75].flatMap(y=>[0.25,0.75].map(x=>{const at=((height-1-Math.floor(y*height))*width+Math.floor(x*width))*4;return [...bytes.subarray(at,at+4)];}));
 report.expected=c.reference.samples;report.referenceMetadata=c.reference.metadata;
 report.grid=report.samples.map((actual,index)=>({actual,expected:report.expected[index],pass:actual.every((value,channel)=>Math.abs(value-report.expected[index][channel])<=report.tolerance)}));
 const scanlines=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)bytes.copy(scanlines,y*(width*4+1)+1,(height-1-y)*width*4,(height-y)*width*4);
 const crc32=buffer=>{let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
 const chunk=(name,data)=>{const type=Buffer.from(name),n=Buffer.alloc(4),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([n,type,data,crc]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
 fs.writeFileSync(path.join(out,'host.png'),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(scanlines)),chunk('IEND',Buffer.alloc(0))]));
 const rows=fs.readFileSync(c.hostLog,'utf8').trim().split(/\r?\n/).filter(Boolean).map(row=>JSON.parse(row));
 report.failures=rows.filter(row=>['failure','bounded-unload-unsupported'].includes(row.kind));
 report.lastCounters=rows.findLast(row=>row.kind==='counters');
 report.telemetrySummaries=rows.filter(row=>row.kind==='host-telemetry-summary');
 report.opportunities=rows.filter(row=>row.kind==='host-opportunity').length;
 report.telemetryComplete=report.telemetrySummaries.length===1&&report.telemetrySummaries[0].lostRecords===0;
 if(report.failures.length)throw Error('Native receiver recorded failure');
 if(!report.lastCounters||report.lastCounters.consumed<2)throw Error('Continuing native receiver consumption was not observed');
 if(!report.grid.every(row=>row.pass))throw Error('Host grid differs from reopened Studio reference');
 report.ok=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;}
fs.writeFileSync(path.join(out,'inspection.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
