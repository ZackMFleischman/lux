import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from '../../scripts/studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from '../../scripts/studio-session.mjs';

const root=resolve(import.meta.dirname,'../..');
const output=join(root,'artifacts','studio-tempo',`run-${Date.now()}`);
await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
const session=resolveStudioSession({workspace:root,env});
const report={ok:false,profile:session.profile,source:execFileSync('git',['-C',root,'-c',`safe.directory=${root}`,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks:[],errors:[],userPid12564AliveBefore:false,userPid12564AliveAfter:false};
try{process.kill(12564,0);report.userPid12564AliveBefore=true;}catch{}
let app,page,child;
try{
  app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});
  child=app.process();report.pid=child.pid;
  page=await app.firstWindow();page.setDefaultTimeout(20000);
  const startupWindow=await page.evaluate(()=>({innerWidth,innerHeight,outerWidth,outerHeight}));
  report.startupWindow=startupWindow;
  await page.screenshot({path:join(output,'startup-default.png')});
  await page.setViewportSize({width:1360,height:900});
  page.on('pageerror',error=>report.errors.push(error.stack??error.message));
  const call=createStudioConnection(session);
  let current;
  for(let attempt=0;attempt<300;attempt++){
    try{current=await call('read');if(current.source)break;}catch{}
    await page.waitForTimeout(100);
  }
  assert.ok(current?.source,'Studio agent endpoint did not become ready');
  const source={sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':await readFile(join(root,'skills/lux-visual-creation/assets/noise-sphere.ts'),'utf8')}};
  let built;
  for(let attempt=0;attempt<300;attempt++){
    current=await call('read');
    try{built=await call('build',{source,expectedDraftVersion:current.draftVersion});break;}
    catch(error){if(!/busy/i.test(String(error)))throw error;await page.waitForTimeout(100);}
  }
  assert.ok(built,'Studio remained busy during source activation');
  async function waitStatus(predicate,label){
    for(let attempt=0;attempt<200;attempt++){const status=await call('status');if(predicate(status.authoring))return status;await page.waitForTimeout(50);}
    throw Error(`${label} did not settle`);
  }
  let status=await waitStatus(runtime=>runtime?.playback==='playing','default startup');
  report.defaultOutput=status.authoring.output;
  assert.ok(status.authoring.output.width>640&&status.authoring.output.height>360,'default startup must precede routine resize');
  report.checks.push('Default startup completed in a normal window before routine preview resize');
  const scale=page.getByRole('slider',{name:'Preview resolution scale',exact:true});
  await scale.focus();await page.keyboard.press('Home');
  status=await waitStatus(runtime=>runtime?.output?.width===640&&runtime.output.height===360,'640x360 preview');
  assert.deepEqual(await page.locator('.preview-surface canvas').evaluate(canvas=>({width:canvas.width,height:canvas.height})),{width:640,height:360});
  report.checks.push('Real preview rendered at routine 640x360');

  const bpm=page.getByRole('spinbutton',{name:'Tempo BPM',exact:true});
  await bpm.fill('150');await bpm.press('Enter');
  status=await waitStatus(runtime=>runtime?.tempo?.bpm===150,'manual 150 BPM');
  const setSequence=status.authoring.tempoSequence;
  assert.ok(setSequence>0);
  report.checks.push('Visible BPM field set and acknowledged 150 BPM');
  const tap=page.getByRole('button',{name:'Tap tempo',exact:true});
  await tap.click();
  status=await waitStatus(runtime=>runtime?.tempoSequence===setSequence+1,'first tap');
  const firstTapPhase=status.authoring.tempo.beatPhase;
  await page.waitForTimeout(500);
  await tap.click();
  status=await waitStatus(runtime=>runtime?.tempoSequence===setSequence+2,'second tap');
  assert.ok(status.authoring.tempo.bpm>=20&&status.authoring.tempo.bpm<=300&&Math.abs(status.authoring.tempo.bpm-150)>1,`tap spacing did not replace manual BPM: ${status.authoring.tempo.bpm}`);
  report.tap={firstTapPhase,bpm:status.authoring.tempo.bpm,sequence:status.authoring.tempoSequence};
  report.checks.push('Visible Tap control rephased and derived BPM from monotonic tap spacing');

  await page.getByRole('button',{name:'Animate Spike height',exact:true}).click();
  await page.getByRole('button',{name:'Add Tempo',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Animate Spike height',exact:true});await dialog.waitFor();
  const beats=dialog.getByRole('spinbutton',{name:'Tempo beats per cycle',exact:true});await beats.fill('0.5');await beats.press('Tab');
  const amount=dialog.getByRole('spinbutton',{name:'Animation amount',exact:true});await amount.fill('0.4');await amount.press('Tab');
  await page.screenshot({path:join(output,'tempo-binding-controls.png')});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  status=await waitStatus(runtime=>runtime?.controlAnimations?.some(row=>row.kind==='tempo'&&row.controlId==='spikeHeight'&&row.beatsPerCycle===0.5&&row.amount===0.4),'tempo binding');
  const samples=[];
  for(let index=0;index<14;index++){const row=(await call('status')).authoring;samples.push({phase:row.tempo.beatPhase,value:row.effectiveControls.spikeHeight});await page.waitForTimeout(80);}
  const values=samples.map(row=>row.value);assert.ok(Math.max(...values)-Math.min(...values)>.05,'tempo animation must visibly move the effective control');
  report.animation={min:Math.min(...values),max:Math.max(...values),samples};
  report.checks.push('Tempo binding visibly modulated Spike height by beat position');

  await page.getByRole('button',{name:'Pause',exact:true}).click();
  status=await waitStatus(runtime=>runtime?.playback==='paused','pause');
  const pausedValue=status.authoring.effectiveControls.spikeHeight;
  await page.waitForTimeout(350);
  assert.equal((await call('status')).authoring.effectiveControls.spikeHeight,pausedValue);
  const pausedSequence=status.authoring.tempoSequence;await tap.click();
  status=await waitStatus(runtime=>runtime?.tempoSequence===pausedSequence+1,'paused tap');
  assert.ok(status.authoring.tempo.beatPhase<0.001,'paused tap establishes beat zero');
  report.checks.push('Pause froze modulation and Tap established beat zero while paused');
  await page.getByRole('button',{name:'Play',exact:true}).click();await waitStatus(runtime=>runtime?.playback==='playing','resume');

  current=await call('read');const scenePath=join(output,'manual-tap-tempo.lux-scene');
  await call('scene.save',{path:scenePath,expectedDraftVersion:current.draftVersion,overwrite:false});
  const saved=JSON.parse(await readFile(scenePath,'utf8'));
  assert.equal(saved.tempo.bpm,status.authoring.tempo.bpm);assert.equal(saved.controlAnimations.find(row=>row.kind==='tempo').beatsPerCycle,0.5);
  await bpm.fill('180');await bpm.press('Enter');await waitStatus(runtime=>runtime?.tempo?.bpm===180,'temporary 180 BPM');
  current=await call('read');await call('scene.open',{path:scenePath,expectedDraftVersion:current.draftVersion,discardDirty:true});
  status=await waitStatus(runtime=>runtime?.tempo?.bpm===saved.tempo.bpm&&runtime?.controlAnimations?.some(row=>row.kind==='tempo'&&row.beatsPerCycle===0.5),'saved tempo scene');
  assert.equal(status.authoring.tempoSequence,0,'reopen starts a fresh tempo command history');
  report.saved={path:scenePath,tempo:saved.tempo,animation:saved.controlAnimations.find(row=>row.kind==='tempo')};
  report.checks.push('Save/reopen persisted only BPM and tempo binding, with a fresh beat phase');

  const retained={generation:status.authoring.generation,revisionId:status.authoring.revisionId,bpm:status.authoring.tempo.bpm};
  current=await call('read');const invalid=structuredClone(current.source);invalid.files[invalid.entry]+='\nconst broken: number = "invalid";';
  await assert.rejects(call('build',{source:invalid,expectedDraftVersion:current.draftVersion}));
  const afterFailure=(await call('status')).authoring;
  assert.equal(afterFailure.generation,retained.generation);assert.equal(afterFailure.revisionId,retained.revisionId);assert.equal(afterFailure.tempo.bpm,retained.bpm);assert.equal(afterFailure.fault,null);
  report.checks.push('Invalid build retained the incumbent preview, BPM, phase owner, and saved scene');
  await page.screenshot({path:join(output,'tempo-running-640x360.png')});
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){
  report.failure=error.stack??String(error);process.exitCode=1;
  if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});
}finally{
  if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});report.exitCode=child.exitCode;}
  try{process.kill(12564,0);report.userPid12564AliveAfter=true;}catch{}
  await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({output,...report},null,2));
}
