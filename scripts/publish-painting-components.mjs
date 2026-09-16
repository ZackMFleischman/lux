import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';
// One publication at a time; the manifest lists only visually verified extractions.
const [manifestPath,label,sceneDirectory]=process.argv.slice(2);
assert.ok(manifestPath&&label&&sceneDirectory,'Pass manifest JSON, milestone label, and persistent scene directory');
const root=resolve(import.meta.dirname,'..'),folder=join(root,'examples/components/wandering-tracers');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const output=join(root,'artifacts/painting-extractions',label+'-publication');await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath,LUX_STUDIO_LIBRARY_ROOT:resolve(manifest.libraryRoot)};
const call=createStudioConnection(resolveStudioSession({workspace:root,env}),{timeoutMs:75000});let app;
try{
 app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});
 const page=await app.firstWindow();
 let ready=false;for(let i=0;i<600;i++){try{const s=await call('status');if(s.authoring?.revisionId&&s.authoring?.frameId&&await page.getByRole('button',{name:'Build',exact:true}).isEnabled()){ready=true;break;}}catch{}await page.waitForTimeout(100);}
 assert.ok(ready,'Initial Studio preview did not become ready');
 const catalog=await call('library.list'),parts=[];
 for(const part of manifest.parts){
  const source={sdkVersion:'0.4.0',entry:part.entry,files:Object.fromEntries(await Promise.all(part.files.map(async f=>[f,await readFile(join(folder,f),'utf8')])))};
  const matches=catalog.filter(row=>row.name===part.name);
  assert.ok(matches.length<=1,'Ambiguous Library name: '+part.name);
  const existing=matches[0];
  const stored=existing?await call('library.read',{id:existing.id}):await call('library.create',{name:part.name,description:part.description,source});
  assert.deepEqual(stored.source,source,'Existing Library source differs: '+part.name);
  assert.ok(!stored.dependencies?.length,'Expected an independent dependency-free leaf: '+part.name);
  parts.push({...part,id:stored.id,revision:stored.revision});
 }
 const files={};
 for(const f of await readdir(folder)){if(f.endsWith('.ts')&&!f.endsWith('.test.ts'))files[f]=await readFile(join(folder,f),'utf8');}
 for(const part of parts){
  for(const file of part.files)delete files[file];
  for(const [file,text] of Object.entries(files)) files[file]=text.replaceAll("'./"+part.entry+"'","'./"+part.mountPath+'/'+part.entry+"'");
 }
 let current=await call('read');
 await call('build',{source:{sdkVersion:'0.4.0',entry:'painting-composition.ts',files},expectedDraftVersion:current.draftVersion,libraryLinks:parts.map(p=>({componentId:p.id,mountPath:p.mountPath}))});
 await page.waitForTimeout(12000);
 current=await call('read');
 for(const part of parts){
  const link=current.libraryLinks.find(link=>link.componentId===part.id&&link.mountPath===part.mountPath);
  assert.equal(link?.resolvedRevision,part.revision,'Library changed during build: '+part.name);
  for(const file of part.files)assert.equal(current.source.files[part.mountPath+'/'+file],await readFile(join(folder,file),'utf8'),'Resolved source differs: '+part.name+'/'+file);
 }
 await writeFile(join(output,'resolved-source.json'),JSON.stringify(current.source,null,2));
 const scenePath=join(resolve(sceneDirectory),'Living Painting - '+label+'.lux-scene');
 await call('scene.save',{path:scenePath,expectedDraftVersion:current.draftVersion,overwrite:false});
 const status=(await call('status')).authoring;assert.equal(status.fault,null);
 await call('playback',{instanceId:status.instanceId,expectedGeneration:status.generation,action:'pause'});
 await call('scene.open',{path:scenePath,expectedDraftVersion:current.draftVersion,discardDirty:false});
 assert.equal((await call('status')).authoring.fault,null);
 const capture=await call('capture');await writeFile(join(output,'frame.png'),Buffer.from(capture.base64,'base64'));
 await page.getByRole('button',{name:'Fit',exact:true}).click();await page.screenshot({path:join(output,'window.png')});
 const inspected=page.locator('.graph-node').filter({hasText:manifest.inspectLabel??parts.at(-1).name});
 assert.equal(await inspected.count(),1,'Published component must be selectable in the graph');
 await inspected.click();assert.equal(await inspected.getAttribute('aria-pressed'),'true','Published graph node is selected');await page.screenshot({path:join(output,'component-controls.png')});
 current=await call('read');const before=(await call('status')).authoring.revisionId;
 const invalid=structuredClone(current.source);invalid.files[invalid.entry]='invalid syntax !';
 await assert.rejects(()=>call('build',{source:invalid,expectedDraftVersion:current.draftVersion}));
 assert.equal((await call('status')).authoring.revisionId,before);
 const report={ok:true,parts:parts.map(({id,revision,name})=>({id,revision,name})),scenePath,checks:['Library readback exact','Linked painting rendered','Saved and reopened','Invalid edit retained last accepted preview','Published graph node selected with own controls'],profile:env.LUX_STUDIO_PROFILE};
 await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report}));
}finally{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});}
