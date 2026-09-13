import fs from 'node:fs';import path from 'node:path';import {build} from 'esbuild';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {prepareTransportScene} from '../transport-prepare.mjs';import {plan,order} from './method.mjs';
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.argv[3]??path.join(root,'artifacts/gpu-paired'));
if(!process.argv[2])throw Error('Usage: node scripts/gpu-paired/build.mjs <accepted-sphere.lux-scene> [new output]');
if(fs.existsSync(path.join(out,'plan.json')))throw Error('Use fresh output directory');fs.mkdirSync(out,{recursive:true});
const scene=JSON.parse(fs.readFileSync(process.argv[2]));
const prepared=await prepareTransportScene(path.resolve(process.argv[2]),path.join(out,'prepared'));
if(prepared.sourceHash!==scene.controls.sourceHash)throw Error('Saved source/control provenance mismatch');
const transport=JSON.parse(fs.readFileSync(prepared.path));transport.savedControls=prepared.savedControls;
fs.writeFileSync(path.join(out,'transport.json'),JSON.stringify(transport));
const sourcePath=path.join(root,'apps/studio/src/visual-worker.mjs');let worker=fs.readFileSync(sourcePath,'utf8');
function replace(a,b){if(worker.split(a).length!==2)throw Error('Worker instrumentation anchor changed: '+a.slice(0,70));worker=worker.replace(a,b);}
replace("let performanceMode='routine';",`let performanceMode='routine';
let referenceTimer,diagnosticAdapter,diagnosticRaw=[];
function diagnosticSample(timer,frame,ms,complete,raw){if(diagnosticRaw.length>=64)return false;diagnosticRaw.push({timer,frame,ms,complete,raw});return true;}`);
replace("if(profiling)gpuTimer.begin(frame+1);","if(frame+1>=16)referenceTimer.begin(frame+1-15); if(profiling)gpuTimer.begin(frame+1);");
replace("else collector.record(completed,frame);","else collector.record(completed,frame); referenceTimer.end();");
replace("performanceMode==='routine'&&gpuCapability.timestampQuerySupported","gpuCapability.timestampQuerySupported");
replace("gpuTimer=createGpuPassTimer(device,(frame,ms,complete)=>collector?.recordGpu(frame,ms,complete)??false,{mode:performanceMode});",`diagnosticAdapter={vendor:adapter.info?.vendor,architecture:adapter.info?.architecture,device:adapter.info?.device,description:adapter.info?.description};
  referenceTimer=createGpuPassTimer(device,(frame,...args)=>diagnosticSample('reference',frame+15,...args));
  gpuTimer=createGpuPassTimer(device,(frame,ms,complete,raw)=>{diagnosticSample('routine',frame,ms,complete,raw);return collector?.recordGpu(frame,ms,complete)??false;},{mode:performanceMode});`);
replace("if (message.type === 'frame') {",`if(message.type==='diagnostic-finalize'){
      const until=performance.now()+5000;
      while((referenceTimer.status().pendingSamples||gpuTimer.status().pendingSamples)&&performance.now()<until)await new Promise(resolve=>setTimeout(resolve,10));
      send('diagnostic-finalize',{requestId:message.requestId,raw:diagnosticRaw,reference:referenceTimer.status(),routine:gpuTimer.status(),adapter:diagnosticAdapter,performanceMode,...state()});
    } else if (message.type === 'frame') {`);
replace("gpuTimer?.dispose();","gpuTimer?.dispose(); referenceTimer?.dispose();");
replace("gpuTimer.dispose(); await visual.dispose();","gpuTimer.dispose(); referenceTimer.dispose(); await visual.dispose();");
replace("device.destroy(); close();","device.destroy(); send('diagnostic-disposed',{requestId:message.requestId}); close();");
fs.writeFileSync(path.join(out,'instrumented-worker.mjs'),worker);
// Diagnostic bundle only: expose the already-read uint64 pairs. Production timer
// code, allocation policy, query schedule and API remain unchanged on disk.
await build({stdin:{contents:worker,resolveDir:path.dirname(sourcePath),sourcefile:sourcePath,loader:'js'},bundle:true,format:'esm',platform:'browser',outfile:path.join(out,'worker.js'),plugins:[{name:'retain-raw-pass-timestamps',setup(builder){builder.onLoad({filter:/gpu-pass\.mjs$/},args=>{
 const source=fs.readFileSync(args.path,'utf8'),anchor='if(onSample(slot.frame,ms,!slot.nonPass)===false)';
 if(source.split(anchor).length!==2)throw Error('Raw timestamp anchor changed');
 return {contents:source.replace(anchor,"if(onSample(slot.frame,ms,!slot.nonPass,{timestampsNs:Array.from(values.subarray(0,slot.count),value=>value.toString()),passCount:slot.count/2,submittedBuffers:slot.submitted})===false)"),loader:'js',resolveDir:path.dirname(args.path)};
});}}]});
await build({entryPoints:[path.join(import.meta.dirname,'renderer.mjs')],bundle:true,format:'esm',platform:'browser',outfile:path.join(out,'renderer.js')});
fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><meta charset="utf-8"><title>Lux paired GPU diagnostic</title><style>html,body{margin:0;width:100%;height:100%;background:#070b16;color:white}</style><body>Bounded paired GPU diagnostic<script type="module" src="renderer.js"></script>');
const hash=f=>({path:f,sha256:createHash('sha256').update(fs.readFileSync(f)).digest('hex')});
const electronExecutable=fs.realpathSync(createRequire(import.meta.url)('electron'));
const manifest={plan,order,electronExecutable,sourceHash:prepared.sourceHash,linkedHash:prepared.linkedHash,controlSchemaHash:transport.linked.controlSchemaHash,
 savedControls:prepared.savedControls,simulation:'Paused at time0 throughout each new worker; exact tick/frame/control sequence, no gestures.',
 probe:'Same timestamp-query feature and independent reference query pool in both modes. Referenceframes16,46; actual routinequeries1,31. Disjoint measured passes.',
 scope:'Short diagnostic warmup60frames (~1s) then240frames (~4s) perleg, not acceptance30s warmup. Five alternating pairs (AB3/BA2).',
 exclusions:['uploads','copies','clears outside passes','query resolve/readback','direct routine GPU-query frames','native bridge/compositor'],
 rawLimitPerLeg:64,files:[sourcePath,path.join(root,'packages/performance/gpu-pass.mjs'),...['build.mjs','renderer.mjs','method.mjs','main.cjs','run.mjs','launch.mjs'].map(n=>path.join(import.meta.dirname,n)),...['instrumented-worker.mjs','worker.js','renderer.js','index.html','transport.json'].map(n=>path.join(out,n))].map(hash)};
fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify(manifest,null,2));
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);
const binaries=[process.execPath,...files(path.dirname(electronExecutable))].map(hash);
const sources=[...manifest.files,hash(path.join(out,'plan.json')),...['experiment-runner.mjs','experiment-job.ps1','experiment-job.cs'].map(n=>hash(path.join(root,'scripts',n)))];
fs.writeFileSync(path.join(out,'review-request.json'),JSON.stringify({schema:1,authorized:false,reviewer:null,expiresUtc:null,hostClosedConfirmed:false,
 hypothesis:'Five alternating baseline/reference and routine/reference pairs measure GPU render/compute pass perturbation on disjoint reference frames; no total GPU overhead verdict.',
 executable:process.execPath,args:[path.join(import.meta.dirname,'run.mjs'),'--hardware-authorized',out],diagnosticTimeoutMs:120000,sources,binaries},null,2));
console.log(JSON.stringify({out,review:path.join(out,'review-request.json'),sourceHash:prepared.sourceHash,...plan}));
