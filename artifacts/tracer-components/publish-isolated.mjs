import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {_electron} from 'playwright';
import {installedElectron} from '../../scripts/studio-electron.mjs';
import {resolve} from 'node:path';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from '../../scripts/studio-session.mjs';
const base='C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac';
const root=resolve('.');
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath,LUX_STUDIO_LIBRARY_ROOT:'C:/Users/zFlei/repos/lux/library'};
const call=createStudioConnection(resolveStudioSession({workspace:root,env}),{timeoutMs:75000});
const app=await _electron.launch({executablePath:installedElectron(root),args:[root+'/apps/studio/dist/main.cjs'],cwd:root,env,timeout:30000,chromiumSandbox:true});
try {
const page=await app.firstWindow();
for(let i=0;i<100;i++){try{const s=await call('status');if(s.authoring?.revisionId&&s.authoring?.frameId)break;}catch{}await page.waitForTimeout(100);}
const load=name=>readFile('examples/components/wandering-tracers/'+name,'utf8');
const source=async(entry,names)=>({sdkVersion:'0.4.0',entry,files:Object.fromEntries(await Promise.all(names.map(async name=>[name,await load(name)])))});
const catalog=await call('library.list');
async function ensure(name,description,src){const existing=catalog.find(e=>e.name===name);if(existing){const stored=await call('library.read',{id:existing.id});assert.deepEqual(stored.source,src,'Existing '+name+' differs; do not overwrite');return stored;}return call('library.create',{name,description,source:src});}
const generator=await ensure('Wandering Tracer Paths','Independent animated perimeter path generator. Outputs paths2d for drawing, region cuts, or other scene effects.',await source('paths.ts',['paths.ts','tracer-state.ts']));
await writeFile(base+'/independent-tracer-generator.json',JSON.stringify(generator,null,2));
const renderer=await ensure('Wandering Tracer Renderer','Paints supplied paths2d over an input image with watercolor pigment, randomized hatching and fine outlines. Does not generate paths.',await source('renderer.ts',['renderer.ts','tracer-texture.ts','tracer-spline.ts']));
await writeFile(base+'/independent-tracer-renderer.json',JSON.stringify(renderer,null,2));
const dependencies=[{componentId:generator.id,revision:generator.revision,mountPath:'generator'},{componentId:renderer.id,revision:renderer.revision,mountPath:'renderer'}];
const wrapperSource={sdkVersion:'0.4.0',entry:'overlay.ts',files:{'overlay.ts':(await load('overlay.ts')).replace("'./paths.ts'","'./generator/paths.ts'").replace("'./renderer.ts'","'./renderer/renderer.ts'")}};
const existingWrapper=catalog.find(e=>e.name==='Wandering Tracers');let wrapper;
if(existingWrapper){const current=await call('library.read',{id:existingWrapper.id});wrapper=JSON.stringify(current.source)===JSON.stringify(wrapperSource)&&JSON.stringify(current.dependencies)===JSON.stringify(dependencies)?current:await call('library.update',{id:current.id,expectedRevision:current.revision,name:current.name,description:'Ready-to-use tracer effect referencing the independent path generator and watercolor renderer.',source:wrapperSource,dependencies});}
else wrapper=await call('library.create',{name:'Wandering Tracers',description:'Ready-to-use tracer effect referencing the independent path generator and watercolor renderer.',source:wrapperSource,dependencies});
const readBack=await call('library.read',{id:wrapper.id});assert.deepEqual(readBack.source,wrapperSource);assert.deepEqual(readBack.dependencies,dependencies);
await writeFile(base+'/wandering-tracers-library.json',JSON.stringify(readBack,null,2));
let current=await call('read');
await call('build',{source:{sdkVersion:'0.4.0',entry:'painting-composition.ts',files:{'painting-composition.ts':(await load('painting-composition.ts')).replace("'./paths.ts'","'./generator/paths.ts'").replace("'./renderer.ts'","'./renderer/renderer.ts'"),'painting.ts':await load('painting.ts'),'tracer-texture.ts':await load('tracer-texture.ts')}},expectedDraftVersion:current.draftVersion,libraryLinks:[{componentId:generator.id,mountPath:'generator'},{componentId:renderer.id,mountPath:'renderer'}]});
current=await call('read');const scene=base+'/Living Painting - Independent Library Tracers.lux-scene';await call('scene.save',{path:scene,expectedDraftVersion:current.draftVersion,overwrite:false});
await page.waitForTimeout(12000);
await page.getByRole('button',{name:'Fit',exact:true}).click();
await page.screenshot({path:base+'/independent-library-tracers.png'});
const status=await call('status');assert.equal(status.authoring.fault,null);
console.log(JSON.stringify({generator:{id:generator.id,revision:generator.revision},renderer:{id:renderer.id,revision:renderer.revision},wrapper:{id:wrapper.id,revision:wrapper.revision},scene,fault:status.authoring.fault}));

} finally {await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
