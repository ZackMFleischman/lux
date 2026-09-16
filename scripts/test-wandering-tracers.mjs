import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir,appendFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';

// Keep each scenario below Studio's bounded test-process lifetime.
const mode=process.argv[2]??'painting';
if(!['painting','overlay','library','independent-wrapper','independent-direct'].includes(mode))throw Error('Use painting, overlay, library, independent-wrapper, or independent-direct');
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
 if(mode.startsWith('independent-')){
 const makeSource=(entry,names)=>({sdkVersion:'0.4.0',entry,files:Object.fromEntries(names.map(name=>[name,files[name]]))});
 const generator=await call('library.create',{name:'Wandering Tracer Paths',description:'Independent perimeter path generator.',source:makeSource('paths.ts',['paths.ts','tracer-state.ts'])});
 const renderer=await call('library.create',{name:'Wandering Tracer Renderer',description:'Independent watercolor path renderer over an image.',source:makeSource('renderer.ts',['renderer.ts','tracer-texture.ts','tracer-spline.ts'])});
 const dependencies=[{componentId:generator.id,revision:generator.revision,mountPath:'generator'},{componentId:renderer.id,revision:renderer.revision,mountPath:'renderer'}];
 const overlaySource=files['overlay.ts'].replace("'./paths.ts'","'./generator/paths.ts'").replace("'./renderer.ts'","'./renderer/renderer.ts'");
 let wrapper;
 if(mode==='independent-wrapper'){
 wrapper=await call('library.create',{name:'Wandering Tracers',description:'Composition referencing the independent generator and renderer.',source:{sdkVersion:'0.4.0',entry:'overlay.ts',files:{'overlay.ts':overlaySource}},dependencies});
 const stored=await call('library.read',{id:wrapper.id});assert.deepEqual(Object.keys(stored.source.files),['overlay.ts']);assert.deepEqual(stored.dependencies,dependencies);
 await writeFile(join(output,'independent-library.json'),JSON.stringify({generator,renderer,wrapper:stored},null,2));
 }else{await writeFile(join(output,'independent-library.json'),JSON.stringify({generator,renderer},null,2));}
 current=await call('read');
 if(mode==='independent-wrapper'){
 await call('build',{source:{sdkVersion:'0.4.0',entry:'composition.ts',files:{'composition.ts':files['composition.ts'].replace("'./overlay.ts'","'./shared/overlay.ts'"),'background.ts':files['background.ts']}},expectedDraftVersion:current.draftVersion,libraryLinks:[{componentId:wrapper.id,mountPath:'shared'}]});
 }else{
 await call('build',{source:{sdkVersion:'0.4.0',entry:'painting-composition.ts',files:{'painting-composition.ts':files['painting-composition.ts'].replace("'./paths.ts'","'./generator/paths.ts'").replace("'./renderer.ts'","'./renderer/renderer.ts'"),'painting.ts':files['painting.ts'],'tracer-texture.ts':files['tracer-texture.ts']}},expectedDraftVersion:current.draftVersion,libraryLinks:[{componentId:generator.id,mountPath:'generator'},{componentId:renderer.id,mountPath:'renderer'}]});
 }
 await page.waitForTimeout(12000);await capture(mode);
 current=await call('read');await writeFile(join(output,'resolved-source.json'),JSON.stringify(current.source,null,2));const path=join(output,mode+'.lux-scene');
 await call('scene.save',{path,expectedDraftVersion:current.draftVersion,overwrite:false});
 const beforeOpen=(await call('status')).authoring;
 await call('playback',{instanceId:beforeOpen.instanceId,expectedGeneration:beforeOpen.generation,action:'pause'});
 await call('scene.open',{path,expectedDraftVersion:current.draftVersion,discardDirty:false});
 assert.ok(!(await call('status')).authoring.fault);
 report.checks.push('Independent typed entries published; wrapper stores references only; '+mode+' rendered, saved and reopened');
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
