import test from 'node:test';import assert from 'node:assert/strict';
import {decodePixelMarker,inspectPixelCorrelation} from '../../tools/gpu-spike/pixel-correlation-inspect.mjs';
const encode=(step,frame)=>{const bits=(step|(frame<<4)|(0xa5<<20)|(((step+frame)&7)<<28)|((step&1)<<31))>>>0;return Array.from({length:32},(_,i)=>{const b=(bits>>>i&1)*255;return [b,b,b,255];});};
function fixture(){const instanceId='a'.repeat(32),revisionId='b'.repeat(64),releaseId='c'.repeat(64),frequency='1000';const samples=[],controls=[],opportunities=[];
 for(let step=0;step<=8;step++){const before=100+step*500;samples.push({sequence:step+1,before:String(before),after:String(before+2),readStart:String(before+3),readEnd:String(before+4),rgba:encode(step,step+1)});opportunities.push({kind:'host-opportunity',instanceId,sequence:step+1,at:String(before+1),present:true,generation:1,frameId:String(step+1)});if(step)controls.push({step,due:String(500+(step-1)*500),before:String(500+(step-1)*500),after:String(501+(step-1)*500),accepted:true});}
 return {experiment:{id:'run',outcome:'success',cleanupComplete:true,timeoutMs:30000,child:{pid:42},result:{cleanupComplete:true,exitCode:0,timeout:false,cancelled:false}},probe:{mode:'pixel-correlation-v1',runId:'run',hostPid:42,ok:true,deinstantiated:true,deinitialized:true,elapsedMs:5000,lostRecords:0,clock:{domain:'qpc',frequency},samples,controls},host:[{kind:'native-clock',domain:'qpc',frequency},...opportunities,{kind:'host-telemetry-summary',instanceId,lostRecords:0,recorded:9}],expected:{revisionId,releaseId},lifecycle:[{kind:'restart-trigger',instanceId,revisionId,releaseId,attemptId:'d'.repeat(32),clock:{domain:'qpc',frequency,at:'10'},incomplete:false,lostRecords:0}]};
}
test('binary marker independently decodes all eight versions, frame and derived effect',()=>{for(let step=0;step<=8;step++)assert.deepEqual(decodePixelMarker(encode(step,456)),{step,frame:456,effect:step%2});
 for(const pixels of [encode(9,1),encode(0,0),encode(1,1).reverse()])assert.throws(()=>decodePixelMarker(pixels));
 for(const mutate of [p=>p[20].fill(128),p=>p[0][3]=0,p=>p[31]=[0,0,0,255],p=>p[28]=[255,255,255,255]]){const p=encode(1,1);mutate(p);assert.throws(()=>decodePixelMarker(p));}
});
test('exact pixels join real callback ordinals and immutable selected frame identities',()=>{const r=inspectPixelCorrelation(fixture());assert.equal(r.matchedVersions.length,8);assert.equal(r.latencyAcceptance,false);assert.equal(r.intrusiveReadback,true);});
test('held frames and new transport copies of the same worker image do not invent renders',()=>{
 for(const newTransport of [false,true]){const f=fixture(),s={...f.probe.samples[1],before:'650',after:'652',readStart:'653',readEnd:'654'};
  f.probe.samples.splice(2,0,s);f.probe.samples.forEach((row,i)=>row.sequence=i+1);
  const row={...f.host[2],at:'651'};if(newTransport){row.frameId='3';for(const later of f.host.slice(3,-1))later.frameId=String(Number(later.frameId)+1);}
  f.host.splice(3,0,row);f.host.filter(x=>x.kind==='host-opportunity').forEach((row,i)=>row.sequence=i+1);f.host.at(-1).recorded++;
  const result=inspectPixelCorrelation(f);assert.equal(result.matchedVersions.length,8);assert.equal(result.uniqueWorkerImages,9);assert.equal(result.duplicateWorkerImages,1);assert.equal(result.selectedTransportFrames,newTransport?10:9);
 }
});
test('missing, stale, equivocal and unbound evidence fails rather than becoming a latency sample',()=>{
 for(const mutate of [f=>f.probe.samples[2].rgba=encode(2,2),f=>f.lifecycle.push({...f.lifecycle[0],kind:'stop-requested',force:true,clock:{domain:'qpc',frequency:'1000',at:'2000'}}),f=>f.lifecycle[0].clock.frequency='999',f=>f.host.push({kind:'bounded-unload-unsupported'}),f=>f.probe.samples[1].rgba=encode(0,2),f=>f.probe.samples[2].rgba=encode(3,3),f=>f.probe.samples[2].rgba=encode(2,1),f=>f.host[2].frameId='1',f=>f.host[3].generation=2,f=>f.host[2].sequence=1,f=>f.host[2].at='1',f=>f.host.pop(),f=>f.host.at(-1).lostRecords=1,f=>f.probe.lostRecords=1,f=>f.probe.controls.pop(),f=>f.probe.controls[1].due='501',f=>f.probe.elapsedMs=15001,f=>f.experiment.timeoutMs=30001,f=>f.lifecycle[0].revisionId='f'.repeat(64),f=>f.lifecycle.push({...f.lifecycle[0],attemptId:'e'.repeat(32)}),f=>f.probe.samples[0].rgba=encode(1,1),f=>f.probe.samples[3].rgba[0][3]=0]){const f=fixture();mutate(f);assert.throws(()=>inspectPixelCorrelation(f));}
});
