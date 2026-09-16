import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';

const root=resolve(import.meta.dirname,'..');
const installation=process.argv[2]?JSON.parse(await readFile(process.argv[2],'utf8')):null;
const output=join(root,'artifacts','control-count',`run-${Date.now()}`);
await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
const session=resolveStudioSession({workspace:installation?.workspace??root,env});
const report={ok:false,source:installation?.sourceCommit??execFileSync('git',['-C',root,'-c',`safe.directory=${root}`,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),installation,profile:session.profile,checks:[],errors:[]};
let app,page,child;
try{
 app=await _electron.launch({executablePath:installation?.executable??installedElectron(root),args:installation?[]:[join(root,'apps/studio/dist/main.cjs')],cwd:installation?.directory??root,env,timeout:30000,chromiumSandbox:true});
 child=app.process();report.pid=child.pid;child.stderr?.on('data',data=>void appendFile(join(output,'stderr.log'),data));page=await app.firstWindow();page.setDefaultTimeout(20000);
 page.on('pageerror',error=>report.errors.push(error.stack??error.message));
 const call=createStudioConnection(session,{timeoutMs:60000});
 let current;for(let i=0;i<100;i++){try{current=await call('read');if(current.source)break;}catch{}await page.waitForTimeout(100);}
 assert.ok(current?.source);
 const declarations=Array.from({length:59},(_,n)=>{const i=n+5;return `control${i}:{type:'number',label:'Control ${i+1}',group:'Motion ${Math.floor(i/8)+1}',min:0,max:2,default:.5},`;}).join('\n');
 const sphere=(await readFile(join(root,'skills/lux-visual-creation/assets/noise-sphere.ts'),'utf8')).replace('  controls: {',`  controls: {\n${declarations}`).replace('spikeHeight.value = frame.controls.spikeHeight','spikeHeight.value = frame.controls.control63');
 await call('build',{source:{sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':sphere}},expectedDraftVersion:current.draftVersion});
 let status=await call('status');assert.equal(status.authoring.controlSchema.length,64);
 assert.equal(Object.hasOwn(status.capabilities,'maxParameters'),false);
 const runtime=status.authoring,values={...runtime.controls,control63:.7};
 await call('parameters',{instanceId:runtime.instanceId,expectedGeneration:runtime.generation,expectedRevisionId:runtime.revisionId,expectedControlSchemaHash:runtime.controlSchemaHash,values});
 status=await call('status');assert.equal(Object.keys(status.authoring.controls).length,64);assert.equal(status.authoring.controls.control63,.7);
 await page.getByRole('button',{name:'Animate Control 64',exact:true}).click();
 await page.getByRole('button',{name:'Add LFO',exact:true}).click();
 for(let i=0;i<100;i++){status=await call('status');if(status.authoring.controlAnimations?.some(row=>row.controlId==='control63'))break;await page.waitForTimeout(100);}
 assert.ok(status.authoring.controlAnimations.some(row=>row.controlId==='control63'));
 const effective=status.authoring.effectiveControls.control63;await page.waitForTimeout(300);status=await call('status');
 assert.notEqual(status.authoring.effectiveControls.control63,effective);assert.equal(status.authoring.controls.control63,.7);
 await page.screenshot({path:join(output,'scene-64-controls.png')});
 report.checks.push('64-control scene builds;64-value patch succeeds;Control64 animates with base preserved');
 await page.keyboard.press('Escape');current=await call('read');
 const scenePath=join(output,'many-controls.lux-scene');
 await call('scene.save',{path:scenePath,expectedDraftVersion:current.draftVersion,overwrite:false});
 const saved=JSON.parse(await readFile(scenePath,'utf8'));
 saved.controlAnimations=saved.controls.schema.map(row=>({nodePath:[],definitionHash:saved.controls.schemaHash,schemaHash:saved.controls.schemaHash,controlId:row.id,shape:'sine',periodSeconds:2,amount:.1,phase:0,enabled:true}));
 const animatedPath=join(output,'many-animations.lux-scene');await writeFile(animatedPath,JSON.stringify(saved));
 await call('scene.open',{path:animatedPath,expectedDraftVersion:current.draftVersion,discardDirty:true});
 status=await call('status');assert.equal(status.authoring.controlAnimations.length,64);assert.equal(Object.keys(status.authoring.controls).length,64);assert.equal(status.authoring.controls.control63,.7);
 current=await call('read');const roundtripPath=join(output,'roundtrip.lux-scene');await call('scene.save',{path:roundtripPath,expectedDraftVersion:current.draftVersion,overwrite:false});
 await call('scene.open',{path:roundtripPath,expectedDraftVersion:current.draftVersion,discardDirty:true});
 assert.equal((await call('status')).authoring.controlAnimations.length,64);
 report.checks.push('64 simultaneous animation bindings and all base values survive save/reopen');
 // Start the independent component scenario without stale scene-animation diagnostics.
 const clean=JSON.parse(await readFile(roundtripPath,'utf8'));clean.controlAnimations=[];
 const cleanPath=join(output,'component-start.lux-scene');await writeFile(cleanPath,JSON.stringify(clean));
 current=await call('read');await call('scene.open',{path:cleanPath,expectedDraftVersion:current.draftVersion,discardDirty:true});
 const controls=Object.fromEntries(Array.from({length:64},(_,i)=>[i?'control'+i:'intensity',{type:'number',label:`Component control ${i+1}`,group:`Motion ${Math.floor(i/8)+1}`,min:0,max:1,default:.5}]));
 const component=`import {defineComponent} from '@lux/visual-sdk';
 import {Scene,Mesh,PlaneGeometry,MeshBasicNodeMaterial,OrthographicCamera} from 'three/webgpu';
 import {uniform,vec3} from 'three/tsl';
 export default defineComponent({metadata:{declarationVersion:1,key:'test/many-controls',label:'Many controls',description:'Control-count test',tags:[],inputs:{},outputs:{image:{type:{kind:'image',colorSpace:'linear-srgb',alphaMode:'premultiplied'},label:'Image',description:'Preview'}},controls:${JSON.stringify(controls)},controlDescriptions:${JSON.stringify(Object.fromEntries(Object.keys(controls).map(id=>[id,'Live value'])))},lifecycle:{state:'stateless',reset:'seed'}},async create(){
 const value=uniform(.5),material=new MeshBasicNodeMaterial();material.colorNode=vec3(value,.25,.75);
 const geometry=new PlaneGeometry(2,2),scene=new Scene();scene.add(new Mesh(geometry,material));const camera=new OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=1;
 return {update(frame){value.value=frame.controls.control63;},async evaluate(_inputs,evaluation){return {image:await evaluation.render(scene,camera)};},reset(){},dispose(){geometry.dispose();material.dispose();}};}});`;
 const nodeId='11111111-1111-4111-8111-111111111111',expose=Object.keys(controls).map(id=>({id,nodeId,controlId:id}));
 const composition=`import {defineComposition} from '@lux/visual-sdk';import ball from './ball.ts';export default defineComposition({definitions:{ball},nodes:[{id:'${nodeId}',definition:'ball'}],edges:[],output:{nodeId:'${nodeId}',portId:'image'},expose:${JSON.stringify(expose)}});`;
 current=await call('read');await call('build',{source:{sdkVersion:'0.4.0',entry:'composition.ts',files:{'composition.ts':composition,'ball.ts':component}},expectedDraftVersion:current.draftVersion});
 status=await call('status');assert.equal(status.authoring.controlSchema.length,64);assert.equal(status.authoring.nodeControls.nodes[0].schema.length,64);
 await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('menuitem',{name:'Inspector',exact:true}).click();
 await page.getByRole('button',{name:'Animate Component control 64',exact:true}).click();await page.getByRole('button',{name:'Add LFO',exact:true}).click();
 for(let i=0;i<100;i++){status=await call('status');if(status.authoring.controlAnimations.some(row=>row.nodePath.length&&row.controlId==='control63'))break;await page.waitForTimeout(100);}
 assert.ok(status.authoring.controlAnimations.some(row=>row.nodePath.length&&row.controlId==='control63'));
 await page.screenshot({path:join(output,'component-64-controls.png')});
 report.checks.push('64-control component compiles and exposes64 aliases;late component control animates');
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.failure=error.stack??String(error);process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});}
finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});report.exitCode=child.exitCode;}await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2));}
