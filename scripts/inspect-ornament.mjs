import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';

const label=process.argv[2]??'batch1-first';
const seconds=Number(process.argv[3]??18);
assert.ok(Number.isFinite(seconds)&&seconds>=0&&seconds<=120);
assert.match(label,/^[a-z0-9-]+$/);
const root=resolve(import.meta.dirname,'..'),folder=join(root,'examples/components/wandering-tracers');
const output=join(root,'artifacts/living-ornament',label);await mkdir(output,{recursive:true});
const files=Object.fromEntries(await Promise.all((await readdir(folder)).filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).map(async f=>[f,(await readFile(join(folder,f),'utf8')).replaceAll('update(frame) {',`update(frame) { frame = Object.freeze({...frame,timeSeconds:${seconds},deltaSeconds:0});`)])));
const source={sdkVersion:'0.4.0',entry:'ornament-composition.ts',files};
await writeFile(join(output,'source.json'),JSON.stringify(source,null,2));
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
const session=resolveStudioSession({workspace:root,env}),call=createStudioConnection(session,{timeoutMs:75000});
let app,page,child;const report={label,profile:session.profile,seconds,testOnly:'Frozen time; controls and shader code otherwise unchanged',captures:[],ok:false};
async function ready(){for(let i=0;i<600;i++){try{const s=(await call('status')).authoring;if(s?.revisionId&&s.frameId&&await page.getByRole('button',{name:'Build',exact:true}).isEnabled()){assert.equal(s.fault,null);return s;}}catch{}await page.waitForTimeout(100);}throw Error('Studio readiness timeout');}
async function patch(values){const s=(await call('status')).authoring;await call('parameters',{instanceId:s.instanceId,expectedGeneration:s.generation,expectedRevisionId:s.revisionId,expectedControlSchemaHash:s.controlSchemaHash,values});await page.waitForTimeout(500);}
async function capture(name){const c=await call('capture');await writeFile(join(output,name+'.png'),Buffer.from(c.base64,'base64'));await writeFile(join(output,name+'.json'),JSON.stringify(c.metadata,null,2));report.captures.push({name,metadata:c.metadata});}
try{
 app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});child=app.process();report.pid=child.pid;child.stderr.on('data',d=>void appendFile(join(output,'stderr.log'),d));page=await app.firstWindow();
 await ready();const current=await call('read');await call('build',{source,expectedDraftVersion:current.draftVersion});await ready();await page.waitForTimeout(750);
 for(const seed of [7,19,43]){await patch({seed});await capture('seed-'+seed);}
 await patch({seed:7});await page.getByRole('button',{name:'Fit',exact:true}).click();await page.screenshot({path:join(output,'window.png')});
 await patch({ornamentSize:1.45});await capture('detail-seed-7');await page.screenshot({path:join(output,'detail-window.png')});
 report.ok=true;
}catch(error){report.error=error.stack??String(error);process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});}
finally{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});report.exitCode=child?.exitCode;await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,ok:report.ok,error:report.error}));}
