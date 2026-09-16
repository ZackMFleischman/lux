import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';
// Test-only deterministic playback adapter. Production component sources are never changed.
const [sourcePath,label='checkpoint',secondsText='18']=process.argv.slice(2);
if(!sourcePath)throw Error('Pass a complete source-bundle JSON, capture label, and checkpoint seconds');
const seconds=Number(secondsText);assert.ok(Number.isFinite(seconds)&&seconds>=0&&seconds<=120);
const root=resolve(import.meta.dirname,'..');const output=join(root,'artifacts/painting-extractions',label);await mkdir(output,{recursive:true});
const source=JSON.parse(await readFile(sourcePath,'utf8'));
for(const [name,text] of Object.entries(source.files)){
 let code=text.replaceAll('update(frame) {',`update(frame) { frame = Object.freeze({...frame,timeSeconds:${seconds},deltaSeconds:0});`);
 if(code.includes('snapshot = stepTracerGenerator(generator, frame, frame.controls);')){
  code=code.replace('snapshot = stepTracerGenerator(generator, frame, frame.controls);',`if(snapshot.paths.length===0){for(let testStep=0;testStep<=${Math.round(seconds*60)};testStep++){snapshot=stepTracerGenerator(generator,{timeSeconds:testStep/60,deltaSeconds:testStep===0?0:1/60},frame.controls);}}`);
 }
 source.files[name]=code;
}
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};const session=resolveStudioSession({workspace:root,env});const call=createStudioConnection(session,{timeoutMs:75000});let app;
try{
 app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});
 app.process().stderr.on('data',data=>void appendFile(join(output,'stderr.log'),data));const page=await app.firstWindow();
 let current;for(let i=0;i<100;i++){try{current=await call('read');if(current.source)break;}catch{}await page.waitForTimeout(100);}
 assert.ok(current?.source);
 let ready=false;for(let readyTry=0;readyTry<600;readyTry++){const status=await call('status');if(status.authoring?.revisionId&&status.authoring?.frameId&&await page.getByRole('button',{name:'Build',exact:true}).isEnabled()){ready=true;break;}await page.waitForTimeout(100);}
 assert.ok(ready,'Initial Studio preview did not become ready');
 current=await call('read');await call('build',{source,expectedDraftVersion:current.draftVersion});await page.waitForTimeout(750);
 const capture=await call('capture');await writeFile(join(output,'frame.png'),Buffer.from(capture.base64,'base64'));await writeFile(join(output,'capture.json'),JSON.stringify(capture.metadata,null,2));
 await page.getByRole('button',{name:'Fit',exact:true}).click();await page.screenshot({path:join(output,'window.png')});
 await writeFile(join(output,'provenance.json'),JSON.stringify({sourcePath:resolve(sourcePath),seconds,profile:session.profile,testOnlyAdapter:'Frozen scene time; generator replayed at fixed 60Hz; unchanged visual controls and shader math.'},null,2));
 await writeFile(join(output,'source.json'),JSON.stringify(source,null,2));console.log(JSON.stringify({output,ok:true}));
}finally{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});}
