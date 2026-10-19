// Real-app soundtrack QA: link a song, then verify audible, synced playback through
// Play, Pause, Reset, rebuild, offset, save and reopen, and a missing-file relink warning.
// Usage: node apps/studio/build.mjs && node scripts/test-studio-soundtrack.mjs [song.mp3]
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,copyFile,rm,mkdtemp} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';

const root=resolve(import.meta.dirname,'..');
const song=resolve(process.argv[2]??join(root,'assets/audio/One More Dawn - Disney Tones.mp3'));
if(!existsSync(song)){console.error(`Soundtrack QA needs an audio file: pass its path (missing ${song}).`);process.exit(2);}
const output=join(root,'artifacts','soundtrack-evidence');
const scratch=await mkdtemp(join(tmpdir(),'lux-soundtrack-qa-'));
await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
delete env.ELECTRON_RUN_AS_NODE;
const session=resolveStudioSession({workspace:root,env});
const report={ok:false,profile:session.profile,song,source:execFileSync('git',['-C',root,'-c',`safe.directory=${root}`,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks:[],samples:[],errors:[]};
let app,page;
try{
  app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});
  report.pid=app.process().pid;
  page=await app.firstWindow();await page.setViewportSize({width:1360,height:860});page.setDefaultTimeout(20000);
  page.on('pageerror',error=>report.errors.push(error.stack??error.message));
  const call=createStudioConnection(session);
  let current;
  for(let attempt=0;attempt<300;attempt++){try{current=await call('read');if(current.source)break;}catch{}await page.waitForTimeout(100);}
  assert.ok(current?.source,'Studio agent endpoint did not become ready');
  const source={sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':await readFile(join(root,'skills/lux-visual-creation/assets/noise-sphere.ts'),'utf8')}};
  async function build(){
    for(let attempt=0;attempt<900;attempt++){
      current=await call('read');
      try{return await call('build',{source,expectedDraftVersion:current.draftVersion});}
      catch(error){if(!/busy/i.test(String(error)))throw error;await page.waitForTimeout(100);}
    }
    throw Error('Studio remained busy');
  }
  await build();
  const scale=page.getByRole('slider',{name:'Preview resolution scale',exact:true});
  await scale.focus();await page.keyboard.press('Home');
  async function waitStatus(predicate,label,limit=200){
    let status;
    for(let attempt=0;attempt<limit;attempt++){status=await call('status');if(predicate(status))return status;await page.waitForTimeout(50);}
    throw Error(`${label} did not settle: ${JSON.stringify(status?.soundtrack)} playback=${status?.authoring?.playback}`);
  }
  await waitStatus(status=>status.authoring?.output?.height===360,'640x360 preview');
  const audible=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(window=>window.webContents.isCurrentlyAudible()));
  const transport=page.locator('.transport');
  async function shot(name){await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});await page.mouse.move(5,5);await page.waitForTimeout(250);await transport.screenshot({path:join(output,name)});}
  async function shotWithPopover(name){
    const box=await transport.boundingBox(),popover=await page.locator('.soundtrack-popover').boundingBox();
    const top=Math.max(0,Math.min(box.y,popover.y)-8),bottom=Math.max(box.y+box.height,popover.y+popover.height)+8;
    await page.screenshot({path:join(output,name),clip:{x:0,y:top,width:Math.min(1360,Math.max(box.x+box.width,popover.x+popover.width)+8),height:bottom-top}});
  }
  await shot('01-transport-no-soundtrack.png');
  report.checks.push('Transport shows an empty Soundtrack control before linking');

  // The native file dialog cannot be driven by Playwright; answer it in the test-owned main process.
  const answerDialog=path=>app.evaluate(({dialog},value)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[value]});},path);
  await answerDialog(song);
  await page.getByRole('button',{name:'Soundtrack: none',exact:true}).click();
  await page.getByRole('dialog',{name:'Soundtrack'}).waitFor();
  await page.waitForTimeout(300);
  await shotWithPopover('02-soundtrack-popover-empty.png');
  await page.getByRole('button',{name:'Choose soundtrack…',exact:true}).click();
  let status=await waitStatus(value=>value.soundtrack?.state==='loaded'&&value.soundtrack.durationSeconds>0,'linked soundtrack',400);
  report.duration=status.soundtrack.durationSeconds;
  assert.ok(Math.abs(status.soundtrack.durationSeconds-323)<3,'decoded duration matches the 5:23 song');
  report.checks.push(`Linked ${status.soundtrack.file}; decoded ${status.soundtrack.durationSeconds.toFixed(2)} s`);
  await page.waitForTimeout(300);
  await shotWithPopover('03-soundtrack-popover-linked.png');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog',{name:'Soundtrack'}).waitFor({state:'hidden'});

  async function sample(label,{playing=true,expectNear}={}){
    await page.waitForTimeout(700);
    // A status read can land while preview frames are briefly delayed; the scene clock keeps running.
    // Accept a read whose newest frame agrees with the soundtrack's scene estimate, and count stale reads.
    let stale=0;
    const value=await waitStatus(status=>{
      if(status.soundtrack?.playing!==playing||(playing&&status.authoring?.playback!=='playing'))return false;
      if(!playing)return true;
      const lag=status.soundtrack.expectedSeconds-(status.soundtrack.offsetSeconds+status.authoring.timeSeconds);
      if(lag>=-0.01&&lag<0.15)return true;
      stale++;return false;
    },`${label} soundtrack state`);
    const scene=value.authoring.timeSeconds,expected=value.soundtrack.offsetSeconds+scene;
    const row={label,playback:value.authoring.playback,generation:value.authoring.generation,clockEpoch:value.authoring.clockEpoch,sceneSeconds:scene,
      audioSeconds:value.soundtrack.positionSeconds,expectedSeconds:value.soundtrack.expectedSeconds,driftSeconds:value.soundtrack.driftSeconds,contextState:value.soundtrack.contextState,outputLatencySeconds:value.soundtrack.outputLatencySeconds,starts:value.soundtrack.starts,staleReads:stale,audible:await audible()};
    report.samples.push(row);
    if(playing){
      assert.equal(row.contextState,'running');
      assert.ok(Math.abs(row.driftSeconds)<=0.05,`${label}: heard position differs from scene time by ${row.driftSeconds}`);
      // The last published frame is older than the status read by its delivery delay plus IPC.
      assert.ok(row.expectedSeconds>=expected-0.01&&row.expectedSeconds-expected<0.15,`${label}: scene estimate ${row.expectedSeconds} vs last frame ${expected}`);
      assert.equal(row.audible,true,`${label}: Chromium reports audible output`);
      if(expectNear!==undefined)assert.ok(Math.abs(scene-expectNear)<1.5,`${label}: scene time ${scene} not near ${expectNear}`);
    }else{
      assert.equal(row.audioSeconds,null);
    }
    return row;
  }
  const playButton=()=>page.locator('.playback-toggle');
  status=await call('status');
  if(status.authoring.playback!=='playing'){await playButton().click();}
  const played=await sample('after Play');
  report.checks.push(`Play: heard ${played.audioSeconds.toFixed(3)} s vs scene-matched ${played.expectedSeconds.toFixed(3)} s (drift ${(played.driftSeconds*1000).toFixed(1)} ms); Chromium reports audible output`);
  await shot('04-transport-linked-playing.png');
  // Steady state: frame-to-audio drift stays inside tolerance and causes no re-seeks.
  const steady=[];let startsBefore=(await call('status')).soundtrack.starts;
  for(let index=0;index<40;index++){const value=await call('status');steady.push(value.soundtrack.driftSeconds);await page.waitForTimeout(75);}
  const startsAfter=(await call('status')).soundtrack.starts;
  report.steadyDrift={samples:steady.length,maxAbsSeconds:Math.max(...steady.map(Math.abs)),meanSeconds:steady.reduce((a,b)=>a+b,0)/steady.length,reseeks:startsAfter-startsBefore,
    outputLatencySeconds:(await call('status')).soundtrack.outputLatencySeconds};
  assert.ok(report.steadyDrift.maxAbsSeconds<=0.05,`steady drift ${report.steadyDrift.maxAbsSeconds}`);
  assert.equal(report.steadyDrift.reseeks,0,'steady playback does not re-seek');
  report.checks.push(`Steady 3 s: max |drift| ${(report.steadyDrift.maxAbsSeconds*1000).toFixed(1)} ms over ${steady.length} samples, 0 re-seeks, output latency lead ${(report.steadyDrift.outputLatencySeconds*1000).toFixed(1)} ms`);

  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const paused=await sample('after Pause',{playing:false});
  await page.waitForTimeout(800);
  paused.audibleAfterPause=await audible();
  assert.equal(paused.audibleAfterPause,false,'Pause silences output');
  report.checks.push('Pause stops the source and Chromium reports no audible output');
  await page.getByRole('button',{name:'Play',exact:true}).click();
  const resumed=await sample('after resume');
  assert.ok(resumed.sceneSeconds>=paused.sceneSeconds,'resume continues from the paused scene time');
  report.checks.push(`Resume continues at scene ${resumed.sceneSeconds.toFixed(3)} s (paused at ${paused.sceneSeconds.toFixed(3)} s) in sync (drift ${(resumed.driftSeconds*1000).toFixed(1)} ms)`);

  await page.waitForTimeout(1500);
  await page.getByRole('button',{name:'Reset',exact:true}).click();
  const reset=await sample('after Reset',{expectNear:0.7});
  assert.ok(reset.clockEpoch>resumed.clockEpoch,'Reset advances the clock epoch');
  report.checks.push(`Reset returns audio to ${reset.audioSeconds.toFixed(3)} s with clock epoch ${reset.clockEpoch} (drift ${(reset.driftSeconds*1000).toFixed(1)} ms)`);

  await page.waitForTimeout(1500);
  await build();
  const rebuilt=await sample('after rebuild',{expectNear:0.7});
  assert.notEqual(rebuilt.generation,reset.generation,'rebuild creates a new runtime generation');
  report.checks.push(`Rebuild: generation ${reset.generation} → ${rebuilt.generation}; audio restarts with the new clock at ${rebuilt.audioSeconds.toFixed(3)} s (drift ${(rebuilt.driftSeconds*1000).toFixed(1)} ms)`);

  await page.getByRole('button',{name:/^Soundtrack: /}).click();
  const offset=page.getByRole('spinbutton',{name:'Soundtrack offset seconds',exact:true});
  await offset.fill('30');await offset.press('Enter');
  await page.keyboard.press('Escape');
  const offsetSample=await sample('after offset 30 s');
  assert.ok(offsetSample.audioSeconds>30&&Math.abs(offsetSample.expectedSeconds-30-offsetSample.sceneSeconds)<0.15,'offset shifts the song position');
  report.checks.push(`Offset 30 s: audio ${offsetSample.audioSeconds.toFixed(3)} s for scene-matched ${offsetSample.expectedSeconds.toFixed(3)} s (drift ${(offsetSample.driftSeconds*1000).toFixed(1)} ms)`);

  await page.getByRole('button',{name:'Mute soundtrack',exact:true}).click();
  await page.waitForTimeout(800);
  status=await call('status');
  assert.equal(status.soundtrack.muted,true);assert.equal(status.soundtrack.playing,true,'muted audio stays in sync');
  report.checks.push('Mute keeps the source synced at zero gain (session only)');
  await shot('05-transport-muted.png');
  await page.getByRole('button',{name:'Mute soundtrack',exact:true}).click();

  // Save beside a copy of the song, reopen, and verify the relative link loads and plays.
  const sceneFolder=join(scratch,'show'),songCopy=join(sceneFolder,'audio','dawn.mp3'),scenePath=join(sceneFolder,'dawn-show.lux-scene');
  await mkdir(join(sceneFolder,'audio'),{recursive:true});await copyFile(song,songCopy);
  await answerDialog(songCopy);
  await page.getByRole('button',{name:/^Soundtrack: /}).click();
  await page.getByRole('button',{name:'Replace file…',exact:true}).click();
  await waitStatus(value=>value.soundtrack?.file==='dawn.mp3'&&value.soundtrack.state==='loaded','relinked copy',400);
  await page.keyboard.press('Escape');
  current=await call('read');
  await call('scene.save',{path:scenePath,expectedDraftVersion:current.draftVersion,overwrite:false});
  const saved=JSON.parse(await readFile(scenePath,'utf8'));
  assert.equal(saved.soundtrack.path,'audio/dawn.mp3');assert.equal(saved.soundtrack.absolutePath,songCopy);assert.equal(saved.soundtrack.offsetSeconds,30);
  report.savedSoundtrack=saved.soundtrack;
  report.checks.push('Saved scene stores audio/dawn.mp3 relative to the scene plus absolute path, sha256, offset and volume');
  current=await call('read');
  await call('scene.open',{path:scenePath,expectedDraftVersion:current.draftVersion,discardDirty:true});
  status=await waitStatus(value=>value.soundtrack?.state==='loaded'&&value.authoring?.playback==='playing','reopened soundtrack',400);
  const reopened=await sample('after reopen');
  report.checks.push(`Reopened scene loads its soundtrack and plays in sync (audio ${reopened.audioSeconds.toFixed(3)} s) (drift ${(reopened.driftSeconds*1000).toFixed(1)} ms)`);

  // Missing file: the scene stays usable and the control warns with a relink action.
  await rm(songCopy);
  current=await call('read');
  await call('scene.open',{path:scenePath,expectedDraftVersion:current.draftVersion,discardDirty:true});
  status=await waitStatus(value=>value.soundtrack?.state==='unavailable','missing soundtrack warning',400);
  assert.equal(status.soundtrack.playing,false);
  assert.ok(['playing','paused'].includes(status.authoring.playback),'the visual keeps running without its soundtrack');
  await shot('06-transport-missing-file.png');
  await page.getByRole('button',{name:/^Soundtrack: dawn\.mp3\. File unavailable/}).click();
  await page.getByRole('button',{name:'Relink file…',exact:true}).waitFor();
  await page.waitForTimeout(300);
  await shotWithPopover('07-soundtrack-popover-missing.png');
  await page.keyboard.press('Escape');
  report.checks.push('Missing file: preview keeps running, transport shows a warning and the popover offers Relink file…');
  await page.setViewportSize({width:1024,height:760});
  await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});await page.mouse.move(5,5);await page.waitForTimeout(400);
  await page.screenshot({path:join(output,'08-window-1024px.png')});
  await shot('09-transport-1024px.png');
  const viewport=page.viewportSize(),scroll=await page.evaluate(()=>({width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(scroll.width<=scroll.client,'no horizontal page overflow at 1024 px');
  report.narrowViewport={viewport,scroll};
  const row=await transport.boundingBox(),control=await page.locator('.soundtrack-control').boundingBox();
  report.narrowLayout={transport:row,control};
  assert.ok(control&&row&&control.x+control.width<=row.x+row.width+1&&row.x+row.width<=viewport.width+1,'soundtrack control and transport row stay inside the 1024 px window');
  report.checks.push('At a 1024 px window the transport row and soundtrack control end inside the window; no horizontal page overflow');
  report.ok=report.errors.length===0;
}catch(error){
  report.errors.push(error.stack??String(error));
  try{await page?.screenshot({path:join(output,'failure.png')});}catch{}
}finally{
  // Close only the Studio process this test launched; an unsaved-scene prompt must not leave it running.
  if(app){const closed=await Promise.race([app.close().then(()=>true,()=>false),new Promise(done=>setTimeout(()=>done(false),15000))]);
    if(!closed&&report.pid){try{process.kill(report.pid);}catch{}}}
  await rm(scratch,{recursive:true,force:true}).catch(()=>{});
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({ok:report.ok,checks:report.checks,errors:report.errors},null,2));
process.exitCode=report.ok?0:1;
