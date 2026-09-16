import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';

const root=resolve(import.meta.dirname,'..');
const output=join(root,'artifacts','studio-kick',`run-${Date.now()}`);
await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
const session=resolveStudioSession({workspace:root,env});
const report={ok:false,profile:session.profile,source:execFileSync('git',['-C',root,'-c',`safe.directory=${root}`,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks:[],errors:[]};
let app,page,child;
try{
  app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});
  child=app.process();report.pid=child.pid;
  page=await app.firstWindow();await page.setViewportSize({width:1360,height:900});page.setDefaultTimeout(20000);
  page.on('pageerror',error=>report.errors.push(error.stack??error.message));
  const call=createStudioConnection(session);
  let current;
  for(let attempt=0;attempt<100;attempt++){
    try{current=await call('read');if(current.source)break;}catch{}
    await page.waitForTimeout(100);
  }
  assert.ok(current?.source,'Studio agent endpoint did not become ready');
  const source={sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':await readFile(join(root,'skills/lux-visual-creation/assets/noise-sphere.ts'),'utf8')}};
  let built=false;
  for(let attempt=0;attempt<100&&!built;attempt++){
    current=await call('read');
    try{await call('build',{source,expectedDraftVersion:current.draftVersion});built=true;}
    catch(error){if(!/busy/i.test(String(error)))throw error;await page.waitForTimeout(100);}
  }
  assert.equal(built,true,'Studio remained busy during source activation');
  const scale=page.getByRole('slider',{name:'Preview resolution scale',exact:true});
  await scale.focus();await page.keyboard.press('Home');
  async function waitStatus(predicate,label){
    for(let attempt=0;attempt<160;attempt++){const status=await call('status');if(predicate(status.authoring))return status;await page.waitForTimeout(50);}
    throw Error(`${label} did not settle`);
  }
  let status=await waitStatus(runtime=>runtime?.output?.width===640&&runtime.output.height===360,'640x360 preview');
  const canvasSize=await page.locator('.preview-surface canvas').evaluate(canvas=>({width:canvas.width,height:canvas.height}));
  assert.deepEqual(canvasSize,{width:640,height:360});
  report.checks.push('Real preview resized through Scale Home and rendered at 640x360');

  async function addKick(label){
    await page.getByRole('button',{name:`Animate ${label}`,exact:true}).click();
    await page.getByRole('button',{name:'Add Kick',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:`Animate ${label}`,exact:true});
    await dialog.waitFor();
    const amount=dialog.getByRole('spinbutton',{name:'Animation amount',exact:true});
    await amount.fill('0.9');await amount.press('Tab');
    const sensitivity=dialog.getByRole('spinbutton',{name:'Kick sensitivity',exact:true});
    await sensitivity.fill('1');await sensitivity.press('Tab');
    const retrigger=dialog.getByRole('spinbutton',{name:'Kick retrigger milliseconds',exact:true});
    await retrigger.fill('0');await retrigger.press('Tab');
    const release=dialog.getByRole('spinbutton',{name:'Audio release milliseconds',exact:true});
    await release.fill('500');await release.press('Tab');
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  }
  async function addAudio(label,band,amount){
    await page.getByRole('button',{name:`Animate ${label}`,exact:true}).click();
    await page.getByRole('button',{name:'Add Audio',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:`Animate ${label}`,exact:true});
    await dialog.waitFor();
    if(band!=='bass'){
      await dialog.getByRole('combobox').click();
      await page.getByRole('option',{name:band[0].toUpperCase()+band.slice(1),exact:true}).click();
    }
    const amountInput=dialog.getByRole('spinbutton',{name:'Animation amount',exact:true});
    await amountInput.fill(String(amount));await amountInput.press('Tab');
    const attack=dialog.getByRole('spinbutton',{name:'Audio attack milliseconds',exact:true});
    await attack.fill('0');await attack.press('Tab');
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  }
  await addKick('Spike height');
  await addAudio('Noise scale','highs',3);
  status=await waitStatus(runtime=>runtime?.controlAnimations?.length===2&&runtime.controlAnimations.some(row=>row.kind==='kick')&&runtime.controlAnimations.some(row=>row.kind==='audio'),'kick and audio bindings');
  const kick=status.authoring.controlAnimations.find(row=>row.kind==='kick');
  const audio=status.authoring.controlAnimations.find(row=>row.kind==='audio');
  assert.equal(kick.source.kind,'audio-kick');
  assert.equal(kick.sensitivity,1);assert.equal(kick.retriggerMs,0);assert.equal(kick.envelope,'exponential');
  assert.equal(JSON.stringify(kick.source.analyzer),JSON.stringify(audio.source.analyzer));
  report.checks.push('Kick and normal band bindings share one portable analyzer configuration');

  await page.getByRole('button',{name:'Connect audio',exact:true}).click();
  await page.getByLabel('Audio input Connected',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Disconnect',exact:true}).click();
  await page.getByLabel('Audio input Disconnected',{exact:true}).waitFor();
  const device=page.getByRole('combobox',{name:'Audio input device',exact:true});
  await device.click();
  const inputOptions=page.locator('li[role="option"]'),inputLabels=(await inputOptions.allTextContents()).map(label=>label.trim());
  const hardwareIndex=inputLabels.findIndex(label=>/eMeet C960/i.test(label));
  const selectedIndex=hardwareIndex>=0?hardwareIndex:inputLabels.findIndex(label=>label!=='Default input');
  assert.ok(selectedIndex>=0,'an operating-system audio input is available after explicit first capture');
  const hardware=inputOptions.nth(selectedIndex),hardwareLabel=inputLabels[selectedIndex];
  await hardware.click();
  await page.getByRole('button',{name:'Connect',exact:true}).click();
  await page.getByLabel('Audio input Connected',{exact:true}).waitFor();
  report.audioInput=hardwareLabel;
  report.checks.push(/eMeet C960/i.test(hardwareLabel)?'Explicit permission connected the enumerated eMeet hardware microphone':'Explicit permission connected an enumerated Windows audio input; Chromium withheld its friendly hardware label');

  const samples=[];
  for(let index=0;index<200;index++){
    status=await call('status');
    samples.push({time:index*80,spike:status.authoring.effectiveControls.spikeHeight,noise:status.authoring.effectiveControls.noiseScale});
    if(samples.some(row=>row.spike>.85001)&&index>=20)break;
    await page.waitForTimeout(80);
  }
  const spikeValues=samples.map(row=>row.spike),noiseValues=samples.map(row=>row.noise);
  assert.ok(Math.max(...noiseValues)>3.40001,'Actual microphone highs must drive the preserved band binding');
  assert.ok(Math.max(...spikeValues)>.85001,'Actual microphone input must produce a detected kick transient');
  assert.ok(spikeValues.some((value,index)=>index>0&&value<spikeValues[index-1]),'Kick envelope must visibly release after its transient');
  report.connectedRanges={spike:[Math.min(...spikeValues),Math.max(...spikeValues)],noise:[Math.min(...noiseValues),Math.max(...noiseValues)],samples:samples.length};
  report.checks.push('Actual microphone input drives one kick envelope and preserves the normal audio-band response');

  await page.getByRole('spinbutton',{name:'Spike height value',exact:true}).fill('1');
  await page.getByRole('spinbutton',{name:'Spike height value',exact:true}).press('Enter');
  status=await waitStatus(runtime=>runtime?.controls?.spikeHeight===1,'manual base edit');
  current=await call('read');
  const scenePath=join(output,'kick-and-band-audio.lux-scene');
  await call('scene.save',{path:scenePath,expectedDraftVersion:current.draftVersion,overwrite:false});
  const saved=JSON.parse(await readFile(scenePath,'utf8'));
  assert.deepEqual(saved.settings,{width:640,height:360,fps:60,seed:0});
  assert.equal(saved.controlAnimations.length,2);assert.equal(saved.controls.values.spikeHeight,1);
  assert.equal(JSON.stringify(saved).includes('deviceId'),false);assert.equal(JSON.stringify(saved).includes('eMeet'),false);
  await call('scene.open',{path:scenePath,expectedDraftVersion:current.draftVersion,discardDirty:true});
  status=await waitStatus(runtime=>runtime?.output?.width===640&&runtime.output.height===360&&runtime.controlAnimations?.length===2&&runtime.controls?.spikeHeight===1,'saved kick scene');
  const reopened=status.authoring.controlAnimations.find(row=>row.kind==='kick');
  assert.equal(reopened.sensitivity,1);assert.equal(reopened.retriggerMs,0);assert.equal(reopened.envelope,'exponential');assert.equal(reopened.releaseMs,500);
  report.checks.push('Save/reopen preserves 640x360, manual base, both bindings, kick settings, and excludes the local device');

  await page.getByRole('button',{name:'Animate Spike height',exact:true}).click();
  await page.getByRole('dialog',{name:'Animate Spike height',exact:true}).waitFor();
  await page.screenshot({path:join(output,'connected-kick-controls.png')});
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Play',exact:true}).waitFor();
  await page.waitForTimeout(600);
  const paused=(await call('status')).authoring.effectiveControls.spikeHeight;
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.waitForTimeout(100);
  const resumed=(await call('status')).authoring.effectiveControls.spikeHeight;
  assert.ok(Math.abs(resumed-paused)<.01,'Kicks sampled during pause must not replay on resume');
  report.checks.push('Pause fences sampled kick events instead of replaying them on resume');

  await page.getByRole('button',{name:'Disconnect',exact:true}).click();
  const releaseSamples=[];
  for(let index=0;index<12;index++){releaseSamples.push((await call('status')).authoring.effectiveControls);await page.waitForTimeout(80);}
  const afterDisconnect=releaseSamples.at(-1);
  assert.ok(Math.abs(afterDisconnect.spikeHeight-1)<.01&&Math.abs(afterDisconnect.noiseScale-3.4)<.01,'Disconnected contributions must release to manual bases');
  report.release={samples:releaseSamples,after:afterDisconnect};
  report.checks.push('Disconnect releases kick and audio contributions to their manual bases');
  await page.screenshot({path:join(output,'disconnected-kick-base.png')});
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){
  report.failure=error.stack??String(error);process.exitCode=1;
  if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});
}finally{
  if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});report.exitCode=child.exitCode;}
  await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({output,...report},null,2));
}
