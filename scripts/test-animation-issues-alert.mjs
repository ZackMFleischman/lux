import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {createStudioConnection,resolveStudioSession,studioTestEnvironment} from './studio-session.mjs';

const root=resolve(import.meta.dirname,'..').replaceAll('\\','/');
const output=join(root,'artifacts/animation-issues-alert',`native-${Date.now()}`);
await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
const session=resolveStudioSession({workspace:root,env});
const report={
  ok:false,root,profile:session.profile,
  commit:execFileSync('git',['-C',root,'-c',`safe.directory=${root}`,'-c','core.excludesFile=','rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  checks:[],layouts:[],screenshots:[],errors:[],
};
const visualSource=`import { defineVisual } from '@lux/visual-sdk';
import { Color, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene } from 'three/webgpu';

export default defineVisual({
  controls: {
    bass: {type:'number',label:'Bass',default:.25,min:0,max:1,step:.01},
    mids: {type:'number',label:'Mids',default:.4,min:0,max:1,step:.01},
    highs: {type:'number',label:'Highs',default:.55,min:0,max:1,step:.01},
    kick: {type:'number',label:'Kick',default:.7,min:0,max:1,step:.01},
  },
  async create(context) {
    const geometry=new PlaneGeometry(1.5,1.5);
    const material=new MeshBasicNodeMaterial({color:'#7f5cff'});
    const mesh=new Mesh(geometry,material),scene=new Scene();
    scene.background=new Color('#070b16');scene.add(mesh);
    const camera=new OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=1;
    return {
      update(frame){mesh.rotation.z=frame.timeSeconds*.08;material.opacity=.35+(frame.controls.bass+frame.controls.mids+frame.controls.highs+frame.controls.kick)*.125;material.transparent=true;},
      render(target){return context.renderer.render(scene,camera,target);},
      reset(_seed){},dispose(){geometry.dispose();material.dispose();},
    };
  },
});\n`;

let app,page,child;
try{
  app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});
  child=app.process();report.pid=await app.evaluate(()=>process.pid);
  page=await app.firstWindow();page.setDefaultTimeout(15000);
  await page.setViewportSize({width:1360,height:900});
  page.on('pageerror',error=>report.errors.push(error.stack??error.message));
  let endpoint;
  for(let attempt=0;attempt<100;attempt++){
    try{endpoint=JSON.parse(await readFile(session.endpointPath,'utf8'));if(endpoint.pid===report.pid)break;}catch{}
    await page.waitForTimeout(100);
  }
  assert.equal(endpoint?.pid,report.pid);
  const call=createStudioConnection({...session,expectedSessionId:endpoint.sessionId},{timeoutMs:75000});
  async function statusWhen(predicate,label,timeout=60000){
    const end=Date.now()+timeout;
    while(Date.now()<end){const runtime=(await call('status')).authoring;if(predicate(runtime))return runtime;await page.waitForTimeout(50);}
    throw Error(`${label} did not settle`);
  }
  async function capture(name){const path=join(output,`${name}.png`);await page.screenshot({path,timeout:30000});report.screenshots.push(path);return path;}
  async function pauseWhenPlaying(){
    const runtime=(await call('status')).authoring;
    if(runtime?.playback==='playing')await call('playback',{instanceId:runtime.instanceId,expectedGeneration:runtime.generation,action:'pause'});
  }
  const buildButton=page.getByRole('button',{name:'Build',exact:true});
  for(let attempt=0;attempt<900&&!await buildButton.isEnabled();attempt++)await page.waitForTimeout(100);
  assert.equal(await buildButton.isEnabled(),true,'the startup build settles before replacing its source');
  await pauseWhenPlaying();
  let initial;
  for(let attempt=0;attempt<100;attempt++){
    try{initial=await call('read');if(initial?.source)break;}catch{}
    await page.waitForTimeout(100);
  }
  assert.ok(initial?.source,'authoring source is readable before the fixture build');
  await page.getByRole('slider',{name:'Preview resolution scale',exact:true}).focus();await page.keyboard.press('Home');
  await statusWhen(runtime=>runtime?.output.width===640&&runtime.output.height===360,'360p preview resize');
  await pauseWhenPlaying();
  await call('build',{source:{sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':visualSource}},expectedDraftVersion:initial.draftVersion});
  await statusWhen(runtime=>runtime?.playback==='playing'&&runtime.controlSchema?.length===4&&runtime.output.width===640&&runtime.output.height===360,'four-control 360p fixture');
  for(const label of ['Bass','Mids','Highs','Kick']){
    await page.getByRole('button',{name:`Animate ${label}`,exact:true}).click();
    await page.getByRole('button',{name:'Add LFO',exact:true}).click();
    await statusWhen(runtime=>runtime?.controlAnimations?.some(binding=>binding.controlId===label.toLowerCase()),`${label} binding`);
  }
  let runtime=await statusWhen(value=>value?.controlAnimations?.length===4,'four saved bindings');
  assert.deepEqual(runtime.controlAnimationIssues,[]);
  const current=await call('read'),cleanPath=join(output,'four-bindings.lux-scene');
  await call('scene.save',{path:cleanPath,expectedDraftVersion:current.draftVersion,overwrite:false});
  const saved=JSON.parse(await readFile(cleanPath,'utf8'));
  assert.equal(saved.controlAnimations.length,4);
  saved.controlAnimations=saved.controlAnimations.map((binding,index)=>({...binding,definitionHash:String(index+1).repeat(64),schemaHash:String(index+5).repeat(64)}));
  const incompatiblePath=join(output,'four-incompatible-bindings.lux-scene');
  await writeFile(incompatiblePath,`${JSON.stringify(saved,null,2)}\n`);
  await pauseWhenPlaying();
  await call('scene.open',{path:incompatiblePath,expectedDraftVersion:(await call('read')).draftVersion,discardDirty:true});
  runtime=await statusWhen(value=>value?.controlAnimationIssues?.length===4,'four runtime animation issues');
  assert.deepEqual(runtime.controlAnimationIssues.map(issue=>issue.controlId),['bass','mids','highs','kick']);
  assert.ok(runtime.controlAnimationIssues.every(issue=>/changed|incompatible/i.test(issue.message)));
  await pauseWhenPlaying();
  report.fixture={cleanPath,incompatiblePath,issues:runtime.controlAnimationIssues,previewOutput:runtime.output};

  const alert=page.getByRole('alert').filter({hasText:/animation/i});
  await alert.waitFor();assert.equal(await alert.count(),1);
  const details=alert.locator('details'),summary=details.locator('summary');
  assert.equal(await details.count(),1);assert.equal(await summary.count(),1);
  const expectedContext=['bass','mids','highs','kick','Animated control changed and is incompatible with this binding.'];
  async function inspectLayout(name,width,height){
    await page.setViewportSize({width,height});await page.waitForTimeout(150);
    await alert.scrollIntoViewIfNeeded();
    const box=await alert.boundingBox();assert.ok(box,`${name} alert is visible`);
    const measurement=await alert.evaluate(element=>({
      clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,clientHeight:element.clientHeight,scrollHeight:element.scrollHeight,
      viewportWidth:document.documentElement.clientWidth,documentWidth:document.documentElement.scrollWidth,
      right:element.getBoundingClientRect().right,left:element.getBoundingClientRect().left,top:element.getBoundingClientRect().top,bottom:element.getBoundingClientRect().bottom,
    }));
    assert.ok(measurement.scrollWidth<=measurement.clientWidth+1,`${name} alert does not overflow horizontally`);
    assert.ok(measurement.right<=measurement.viewportWidth+1&&measurement.left>=-1,`${name} alert stays inside the viewport`);
    assert.ok(measurement.top>=-1&&measurement.bottom<=height+1,`${name} full alert stays vertically visible`);
    assert.ok(measurement.documentWidth<=measurement.viewportWidth+1,`${name} document has no horizontal overflow`);
    report.layouts.push({name,width,height,alert:box,measurement});
  }
  async function assertExpanded(label){
    assert.equal(await details.getAttribute('open'),'');
    const text=await alert.innerText();for(const expected of expectedContext)assert.match(text,new RegExp(expected,'i'),`${label} shows ${expected}`);
    assert.equal((text.match(/node Scene\/root \[\]/g)??[]).length,4,`${label} shows the exact scene-node context for all four controls`);
  }
  async function assertCollapsed(){assert.equal(await details.getAttribute('open'),null);}

  await assertCollapsed();await inspectLayout('wide-collapsed',1360,900);await capture('wide-collapsed');
  await summary.focus();await page.keyboard.press('Enter');await assertExpanded('wide Enter');
  await inspectLayout('wide-expanded',1360,900);await capture('wide-expanded');
  await page.keyboard.press('Space');await assertCollapsed();
  report.checks.push('Wide alert is compact by default; Enter expands full control context and Space collapses it');

  await page.setViewportSize({width:820,height:720});await page.waitForTimeout(150);
  const inspector=page.locator('.studio-pane-inspector'),beforeInspector=await inspector.boundingBox();assert.ok(beforeInspector);
  const inspectorSash=await page.locator('.dv-sash').evaluateAll((nodes,left)=>nodes.map(node=>{const box=node.getBoundingClientRect();return {x:box.x,y:box.y,width:box.width,height:box.height};}).find(box=>box.height>100&&box.width>0&&box.width<20&&Math.abs(box.x-left)<12),beforeInspector.x);
  assert.ok(inspectorSash,'visible divider next to Inspector');
  const targetInspectorWidth=240,delta=targetInspectorWidth-beforeInspector.width;
  await page.mouse.move(inspectorSash.x+inspectorSash.width/2,inspectorSash.y+inspectorSash.height/2);await page.mouse.down();
  await page.mouse.move(inspectorSash.x-delta,inspectorSash.y+inspectorSash.height/2,{steps:15});await page.mouse.up();
  await page.waitForFunction(target=>document.querySelector('.studio-pane-inspector').getBoundingClientRect().width>=target-2,targetInspectorWidth);
  const afterInspector=await inspector.boundingBox();assert.ok(afterInspector);report.narrowInspector={window:{width:820,height:720},before:beforeInspector.width,after:afterInspector.width,target:targetInspectorWidth};
  await inspectLayout('narrow-collapsed',820,720);await capture('narrow-collapsed');
  await summary.focus();await page.keyboard.press('Space');await assertExpanded('narrow Space');
  await inspectLayout('narrow-expanded',820,720);await capture('narrow-expanded');
  await page.keyboard.press('Enter');await assertCollapsed();
  report.checks.push('Narrow alert stays inside its panel without horizontal overflow; Space expands and Enter collapses it');
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){
  report.error=error.stack??String(error);process.exitCode=1;
  if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});
}finally{
  if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});report.exitCode=child.exitCode;}
  if(report.pid){try{process.kill(report.pid,0);report.processExited=false;}catch{report.processExited=true;}}
  await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({output,...report},null,2));
}
