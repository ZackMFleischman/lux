import {readFile,writeFile} from 'node:fs/promises';
import {resolveStudioSession,createStudioConnection} from '../../scripts/studio-session.mjs';
import {readDesktopInstallation,desktopInfo} from '../../scripts/studio-desktop.mjs';
const root=process.cwd(),base='C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac';
const installation=await readDesktopInstallation();
const receipt=await desktopInfo(installation,{start:true});
await writeFile(base+'/tracer-components-launch.json',JSON.stringify(receipt,null,2));
const session=resolveStudioSession({workspace:installation.workspace,env:{...process.env,...receipt.mcp.env}});
const call=createStudioConnection(session,{timeoutMs:75000});
const load=file=>readFile(root+'/examples/components/wandering-tracers/'+file,'utf8');
const source={sdkVersion:'0.4.0',entry:'overlay.ts',files:{}};
for(const file of ['overlay.ts','paths.ts','tracer-state.ts','renderer.ts','tracer-texture.ts','tracer-spline.ts'])source.files[file]=await load(file);
const entries=await call('library.list'),existing=entries.find(entry=>entry.name==='Wandering Tracers');
if(existing)throw Error('Wandering Tracers already exists; read its source before updating instead of creating a duplicate.');
const component=await call('library.create',{name:'Wandering Tracers',description:'Fine watercolor tracers over any image. Separate path generation and rendering; shared paths can also drive region carving.',source});
await writeFile(base+'/wandering-tracers-library.json',JSON.stringify(component,null,2));
const libraryLinks=[{componentId:component.id,mountPath:'tracers'}];
let current=await call('read');
await call('build',{source:{sdkVersion:'0.4.0',entry:'composition.ts',files:{'composition.ts':(await load('composition.ts')).replace("'./overlay.ts'","'./tracers/overlay.ts'"),'background.ts':await load('background.ts')}},expectedDraftVersion:current.draftVersion,libraryLinks});
current=await call('read');await call('scene.save',{path:base+'/Wandering Tracers - Reusable Overlay.lux-scene',expectedDraftVersion:current.draftVersion,overwrite:false});
await call('build',{source:{sdkVersion:'0.4.0',entry:'painting-composition.ts',files:{
 'painting-composition.ts':(await load('painting-composition.ts')).replace("'./paths.ts'","'./tracers/paths.ts'").replace("'./renderer.ts'","'./tracers/renderer.ts'"),
 'painting.ts':(await load('painting.ts')).replace("'./tracer-spline.ts'","'./tracers/tracer-spline.ts'"),
}},expectedDraftVersion:current.draftVersion,libraryLinks});
await new Promise(resolve=>setTimeout(resolve,3000));
current=await call('read');const scene=base+'/Living Painting - Reusable Tracers.lux-scene';
await call('scene.save',{path:scene,expectedDraftVersion:current.draftVersion,overwrite:false});
await call('scene.open',{path:scene,expectedDraftVersion:current.draftVersion,discardDirty:true});
const status=await call('status');await writeFile(base+'/tracer-components-status.json',JSON.stringify(status,null,2));
console.log(JSON.stringify({scene,libraryId:component.id,revision:component.revision,session:receipt.studioSession,fault:status.authoring?.fault}));
