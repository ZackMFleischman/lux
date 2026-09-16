import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir,appendFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';

// Keep each scenario below Studio's bounded test-process lifetime.
const mode=process.argv[2]??'painting';
if(!['painting','overlay','library'].includes(mode))throw Error('Use painting, overlay, or library');
const root=resolve(import.meta.dirname,'..'),output=join(root,'artifacts/tracer-components',`gpu-${mode}-${Date.now()}`);
await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
const session=resolveStudioSession({workspace:root,env}),call=createStudioConnection(session,{timeoutMs:75000});
let app,page;
const report={ok:false,profile:session.profile,checks:[],errors:[]};
async function capture(name){
 const result=await call('capture');
 await writeFile(join(output,`${name}.json`),JSON.stringify(result.metadata,null,2));
 assert.ok(result.base64);
 await writeFile(join(output,`${name}.png`),Buffer.from(result.base64,'base64'));
 await page.getByRole('button',{name:'Fit',exact:true}).click();
 await page.screenshot({path:join(output,`${name}-window.png`)});
}
try{
 app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});
 app.process().stderr.on('data',data=>void appendFile(join(output,'stderr.log'),data));
 page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(error.stack??error.message));
 page.on('console',message=>void appendFile(join(output,'console.log'),message.type()+': '+message.text()+'\n'));
 let current;for(let i=0;i<80;i++){try{current=await call('read');if(current.source)break;}catch{}await page.waitForTimeout(100);}
 assert.ok(current?.source);
 const files={};for(const file of await readdir(join(root,'examples/components/wandering-tracers'))){if(file.endsWith('.ts')&&!file.endsWith('.test.ts'))files[file]=await readFile(join(root,'examples/components/wandering-tracers',file),'utf8');}
 for(const [entry,name] of [['composition.ts','overlay'],['painting-composition.ts','painting']].filter(([,name])=>name===mode)){
  current=await call('read');
  console.log(`Building ${name}`);
  const build=await call('build',{source:{sdkVersion:'0.4.0',entry,files},expectedDraftVersion:current.draftVersion});
  await writeFile(join(output,`${name}-source.json`),JSON.stringify({sdkVersion:'0.4.0',entry,files},null,2));
  await writeFile(join(output,`${name}-build.json`),JSON.stringify(build,null,2));
  await page.waitForTimeout(18000);
  const status=await call('status');await writeFile(join(output,`${name}-status.json`),JSON.stringify(status,null,2));
  assert.equal(status.authoring?.sdkVersion,'0.4.0',JSON.stringify(status));assert.ok(!status.authoring.fault,JSON.stringify(status.authoring.fault));
  await capture(name);report.checks.push(`${name} rendered`);
  current=await call('read');const path=join(output,`${name}.lux-scene`);
  await call('scene.save',{path,expectedDraftVersion:current.draftVersion,overwrite:false});
  await call('scene.open',{path,expectedDraftVersion:current.draftVersion,discardDirty:true});
  await page.waitForTimeout(1000);report.checks.push(`${name} saved and reopened`);
 }
 if(mode==='library'){
 const libraryFiles=Object.fromEntries(['overlay.ts','paths.ts','tracer-state.ts','renderer.ts','tracer-texture.ts','tracer-spline.ts'].map(file=>[file,files[file]]));
 const library=await call('library.create',{name:'Wandering Tracers',description:'Fine watercolor tracers over an image, with shared path generation and independent appearance controls.',source:{sdkVersion:'0.4.0',entry:'overlay.ts',files:libraryFiles}});
 await writeFile(join(output,'library.json'),JSON.stringify(library,null,2));
 const id=library.id;assert.ok(id);
 current=await call('read');
 await call('build',{source:{sdkVersion:'0.4.0',entry:'composition.ts',files:{'composition.ts':files['composition.ts'].replace("'./overlay.ts'","'./shared/overlay.ts'"),'background.ts':files['background.ts']}},expectedDraftVersion:current.draftVersion,libraryLinks:[{componentId:id,mountPath:'shared'}]});
 current=await call('read');assert.ok(current.source.files['shared/overlay.ts']);
 await page.waitForTimeout(3000);
 await capture('library-before-open');
 const linkedPath=join(output,'library-linked.lux-scene');
 await call('scene.save',{path:linkedPath,expectedDraftVersion:current.draftVersion,overwrite:false});
 await call('scene.open',{path:linkedPath,expectedDraftVersion:current.draftVersion,discardDirty:true});
 await capture('library');
 report.checks.push('Library wrapper created, linked, saved and reopened');
 }
 current=await call('read');const before=(await call('status')).authoring.revisionId;
 const invalid=structuredClone(current.source);invalid.files[invalid.entry]='invalid syntax !';
 await assert.rejects(()=>call('build',{source:invalid,expectedDraftVersion:current.draftVersion}));
 assert.equal((await call('status')).authoring.revisionId,before);report.checks.push('Invalid edit preserved accepted preview');
 report.ok=true;
}catch(error){report.failure=error.stack??String(error);process.exitCode=1;await page?.screenshot({path:join(output,'failure.png')}).catch(()=>{});}
finally{
 await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});
 await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2));
}
