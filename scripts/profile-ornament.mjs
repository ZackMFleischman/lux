import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {decode} from 'fast-png';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';
const [label='performance',sourcePath]=process.argv.slice(2);assert.match(label,/^[a-z0-9-]+$/);
const root=resolve(import.meta.dirname,'..'),folder=join(root,'examples/components/wandering-tracers');
const source=sourcePath?JSON.parse(await readFile(sourcePath,'utf8')):{sdkVersion:'0.4.0',entry:'ornament-composition.ts',files:Object.fromEntries(await Promise.all((await readdir(folder)).filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).map(async f=>[f,await readFile(join(folder,f),'utf8')])))};
for(const f of Object.keys(source.files))source.files[f]=source.files[f].replaceAll(' frame = Object.freeze({...frame,timeSeconds:18,deltaSeconds:0});','');
const output=join(root,'artifacts/living-ornament',label);await mkdir(output,{recursive:true});await writeFile(join(output,'source.json'),JSON.stringify(source,null,2));
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath},session=resolveStudioSession({workspace:root,env}),call=createStudioConnection(session,{timeoutMs:75000});
let app,page,child;const report={profile:session.profile,warmupSeconds:4,measurementSeconds:20,targetFps:60,samples:[],ok:false};
async function ready(){for(let i=0;i<600;i++){try{const s=(await call('status')).authoring;if(s?.revisionId&&s.frameId&&await page.getByRole('button',{name:'Build',exact:true}).isEnabled()){assert.equal(s.fault,null);return s;}}catch{}await page.waitForTimeout(100);}throw Error('Studio readiness timeout');}
try{
 app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});child=app.process();report.pid=child.pid;page=await app.firstWindow();await ready();let r=await call('read');await call('build',{source,expectedDraftVersion:r.draftVersion});await ready();await page.waitForTimeout(4000);
 const start=await call('status'),startAt=performance.now();let sequence=start.performance?.worker?.sequence??0;
 while(performance.now()-startAt<20000){await page.waitForTimeout(250);const s=await call('status');assert.equal(s.authoring.fault,null);assert.equal(s.authoring.playback,'playing');assert.equal(s.authoring.revisionId,start.authoring.revisionId);const w=s.performance?.worker;if(w&&w.sequence>sequence){report.samples.push(w);sequence=w.sequence;}}
 const endAt=performance.now(),end=await call('status');report.elapsedMs=endAt-startAt;report.completedFrames=Number(BigInt(end.authoring.frameId)-BigInt(start.authoring.frameId));report.observedFps=report.completedFrames*1000/report.elapsedMs;
 const frames=report.samples.reduce((n,s)=>n+s.produced.sampleCount,0),ms=report.samples.reduce((n,s)=>n+s.windowEndMs-s.windowStartMs,0);report.workerProducedFps=ms?frames*1000/ms:null;report.minimumIntervalFps=report.samples.length?Math.min(...report.samples.map(s=>s.produced.value??Infinity)):null;
 const gpu=report.samples.map(s=>s.gpu.p95).filter(Number.isFinite);report.maximumReportedGpuP95Ms=gpu.length?Math.max(...gpu):null;report.gpuTimingNote='Sampled GPU pass timings when supported; excludes uploads/copies outside measured passes. Maximum of interval p95 values, not an aggregate frame-time percentile.';
 report.finalStatus=end;const c=await call('capture');const bytes=Buffer.from(c.base64,'base64'),pixels=decode(bytes);report.width=pixels.width;report.height=pixels.height;assert.equal(pixels.width,1920);assert.equal(pixels.height,1080);await writeFile(join(output,'frame.png'),bytes);await page.screenshot({path:join(output,'window.png')});
 if(process.env.LUX_MILESTONE_SAVE_PATH){
  const current=await call('read');report.scenePath=process.env.LUX_MILESTONE_SAVE_PATH;
  await call('scene.save',{path:report.scenePath,expectedDraftVersion:current.draftVersion,overwrite:false});
  const saved=await readFile(report.scenePath);await call('scene.open',{path:report.scenePath,expectedDraftVersion:current.draftVersion,discardDirty:false});await ready();
  const reopened=(await call('status')).authoring;assert.equal(reopened.fault,null);assert.deepEqual(reopened.controls,end.authoring.controls);report.savedAndReopened=true;
  await call('playback',{instanceId:reopened.instanceId,expectedGeneration:reopened.generation,action:'pause'});
  const before=await call('capture');const draft=await call('read');const invalid=structuredClone(draft.source);invalid.files[invalid.entry]='invalid syntax !';
  await assert.rejects(()=>call('build',{source:invalid,expectedDraftVersion:draft.draftVersion}));
  const retained=(await call('status')).authoring;assert.equal(retained.revisionId,reopened.revisionId);assert.equal(retained.fault,null);
  const after=await call('capture');assert.deepEqual(decode(Buffer.from(after.base64,'base64')).data,decode(Buffer.from(before.base64,'base64')).data);assert.deepEqual(await readFile(report.scenePath),saved);report.invalidEditRetained=true;
 }
 report.ok=true;
}catch(error){report.error=error.stack??String(error);process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});}
finally{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});report.exitCode=child?.exitCode;await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,ok:report.ok,fps:report.observedFps,workerFps:report.workerProducedFps,gpuP95:report.maximumReportedGpuP95Ms,error:report.error}));}
