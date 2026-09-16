import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';

const root=resolve(import.meta.dirname,'..').replaceAll('\\','/');
const output=join(root,'artifacts/inspector-hit-area',`native-${Date.now()}`);
await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
const session=resolveStudioSession({workspace:root,env});
const report={ok:false,root,profile:session.profile,commit:execFileSync('git',['-C',root,'-c',`safe.directory=${root}`,'-c','core.excludesFile=','rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks:[],alignments:[],screenshots:[],errors:[]};
let app,page,child;
try{
  app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});
  child=app.process();report.pid=await app.evaluate(()=>process.pid);
  page=await app.firstWindow();page.setDefaultTimeout(15000);
  await page.setViewportSize({width:1360,height:900});
  page.on('pageerror',error=>report.errors.push(error.stack??error.message));
  let endpoint;
  for(let attempt=0;attempt<100;attempt++){try{endpoint=JSON.parse(await readFile(session.endpointPath,'utf8'));if(endpoint.pid===report.pid)break;}catch{}await page.waitForTimeout(100);}
  assert.equal(endpoint?.pid,report.pid);
  const call=createStudioConnection({...session,expectedSessionId:endpoint.sessionId});
  async function statusWhen(predicate,label,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){const runtime=(await call('status')).authoring;if(predicate(runtime))return runtime;await page.waitForTimeout(50);}throw Error(`${label} did not settle`);}
  async function capture(name){const path=join(output,`${name}.png`);await page.screenshot({path});report.screenshots.push(path);}
  await statusWhen(runtime=>runtime?.playback==='playing','initial startup',60000);
  await page.getByRole('slider',{name:'Preview resolution scale',exact:true}).focus();await page.keyboard.press('Home');
  await statusWhen(runtime=>runtime?.output.width===640&&runtime.output.height===360,'360p preview');
  const source={sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':await readFile(join(root,'skills/lux-visual-creation/assets/noise-sphere.ts'),'utf8')}};
  const draft=await call('read');await call('build',{source,expectedDraftVersion:draft.draftVersion});
  let runtime=await statusWhen(runtime=>runtime?.playback==='playing'&&runtime.controls?.spikeHeight!==undefined,'fixture');
  assert.equal(runtime.output.width,640);assert.equal(runtime.output.height,360);
  const definition=runtime.controlSchema.find(control=>control.id==='spikeHeight');
  const row=page.locator('[data-control-id="spikeHeight"]');
  const number=row.getByRole('spinbutton',{name:'Spike height value',exact:true});
  const animate=row.getByRole('button',{name:'Animate Spike height',exact:true});
  const reset=row.getByRole('button',{name:'Reset Spike height to default',exact:true});
  const slider=row.getByRole('slider',{name:'Spike height',exact:true});
  const track=row.locator('.MuiSlider-root'),thumb=row.locator('.MuiSlider-thumb');
  const step=definition.step??(definition.max-definition.min)/100;
  async function setValue(value){await number.fill(String(value));await number.press('Enter');return statusWhen(state=>state.controls.spikeHeight===value,`base ${value}`);}
  async function align(target,label){
    const targetBox=await target.boundingBox(),trackBox=await track.boundingBox();assert.ok(targetBox&&trackBox);
    let center=targetBox.x+targetBox.width/2;const fraction=Math.max(0,Math.min(1,(center-trackBox.x)/trackBox.width));
    const value=Number((definition.min+Math.round(fraction*(definition.max-definition.min)/step)*step).toFixed(6));
    await setValue(value);let thumbBox,distance=Infinity;
    for(let attempt=0;attempt<40;attempt++){const current=await target.boundingBox();assert.ok(current);center=current.x+current.width/2;thumbBox=await thumb.boundingBox();assert.ok(thumbBox);distance=Math.abs(thumbBox.x+thumbBox.width/2-center);if(distance<2)break;await page.waitForTimeout(50);}
    assert.ok(distance<2,`${label} is horizontally aligned with thumb (${distance}px)`);
    report.alignments.push({label,value,targetX:center,thumbX:thumbBox.x+thumbBox.width/2,distance});
    return value;
  }
  async function pointerClick(target,options={}){const box=await target.boundingBox();assert.ok(box);await target.click({...options,position:{x:box.width/2,y:box.height-3}});}
  // The original failure is preserved in the LUX-150 native receipt. Keep this
  // positive regression on the unmodified candidate stylesheet and its CSP.
  for(const [size,width,height] of [['wide',1360,900],['narrow',820,720]]){
    report.stage=size;await page.setViewportSize({width,height});
    await align(animate,`${size} Animate`);await pointerClick(animate);
    const dialog=page.getByRole('dialog',{name:'Animate Spike height',exact:true});await dialog.waitFor();
    await capture(`${size}-animate`);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    await align(reset,`${size} Reset`);await pointerClick(reset);
    await statusWhen(state=>state.controls.spikeHeight===definition.default,`${size} reset default`);
    await align(number,`${size} numeric`);await pointerClick(number);assert.equal(await number.evaluate(input=>input===document.activeElement),true);
    await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('1.2');await page.keyboard.press('Enter');
    await statusWhen(state=>state.controls.spikeHeight===1.2,`${size} pointer-selected numeric edit`);
    const box=await track.boundingBox(),start=await thumb.boundingBox();assert.ok(box&&start);
    await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();
    await page.mouse.move(box.x+box.width*.35,start.y+start.height/2,{steps:8});await page.mouse.up();
    runtime=await statusWhen(state=>state.controls.spikeHeight!==1.2,`${size} slider drag`);
    const dragged=runtime.controls.spikeHeight;assert.ok(Math.abs(dragged-(definition.min+.35*(definition.max-definition.min)))<=step);
    await slider.focus();await page.keyboard.press('ArrowRight');
    await statusWhen(state=>Math.abs(state.controls.spikeHeight-(dragged+step))<1e-6,`${size} slider keyboard step`);
    await number.focus();await page.keyboard.press('Tab');assert.equal(await animate.evaluate(button=>button===document.activeElement),true);
    await page.keyboard.press('Enter');await dialog.waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    await capture(`${size}-controls`);
    report.checks.push(`${size}: ordinary pointer Animate/Reset/numeric clicks with aligned thumb, pointer drag, slider ArrowRight, Tab/Enter activation and Escape all pass`);
  }
  runtime=(await call('status')).authoring;assert.equal(runtime.output.width,640);assert.equal(runtime.output.height,360);
  report.previewOutput=runtime.output;assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=error.stack??String(error);process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});}
finally{
  if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});report.exitCode=child.exitCode;}
  if(report.pid){try{process.kill(report.pid,0);report.processExited=false;}catch{report.processExited=true;}}
  await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2));
}
