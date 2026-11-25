import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from 'file:///C:/Users/zFlei/repos/lux/scripts/studio-electron.mjs';
import {createStudioConnection,resolveStudioSession,studioTestEnvironment} from 'file:///C:/Users/zFlei/repos/lux/scripts/studio-session.mjs';

const root="C:\\Users\\zFlei\\repos\\lux";
const installation={"version":1,"name":"Lux","sourceCommit":"4311980789fe5eb89368f0075b1951dafd7ffed6","sourceTree":"working tree snapshot","canonicalLibraryRoot":"C:\\Users\\zFlei\\repos\\lux\\library","electron":{"version":"44.3.0","archiveName":"electron-v44.3.0-win32-x64.zip","sha256":"26bf9a617d58d81772b3d68305d59ee48272969c15083c06db634a77358a8d9d","source":"https://github.com/electron/electron/releases/download/v44.3.0/electron-v44.3.0-win32-x64.zip"},"installedAt":"2026-09-16T10:55:29.707Z","directory":"C:\\Users\\zFlei\\AppData\\Local\\Programs\\Lux\\builds\\43119807-c5bad848","executable":"C:\\Users\\zFlei\\AppData\\Local\\Programs\\Lux\\builds\\43119807-c5bad848\\Lux.exe","workspace":"C:\\Users\\zFlei\\AppData\\Local\\Programs\\Lux\\builds\\43119807-c5bad848\\resources\\app\\runtime","node":"C:\\Users\\zFlei\\AppData\\Local\\Programs\\Lux\\builds\\43119807-c5bad848\\resources\\app\\node.exe","adapter":"C:\\Users\\zFlei\\AppData\\Local\\Programs\\Lux\\builds\\43119807-c5bad848\\resources\\app\\runtime\\scripts\\studio-installed-mcp.mjs","profile":"desktop","sourceDigest":"0a223199df5afa006472789d4beabd5402c3bb3772c7947cf81943634bd22ccb"};
const output=join(root,'artifacts/feedback-01a0a7bb/tempo-limit-qa',`lifecycle-${Date.now()}`);
await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
const session=resolveStudioSession({workspace:installation.workspace,env});
const report={installation,ok:false,profile:session.profile,source:execFileSync('git',['-C',root,'-c',`safe.directory=${root}`,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks:[],errors:[]};
let app,page,child;
try{
  app=await _electron.launch({executablePath:installation.executable,args: [],cwd: installation.directory, env,timeout:30000,chromiumSandbox:true});
  child=app.process();report.pid=child.pid;
  page=await app.firstWindow();page.setDefaultTimeout(20000);
  page.on('pageerror',error=>report.errors.push(error.stack??error.message));
  const call=createStudioConnection(session);
  let current;
  for(let attempt=0;attempt<300;attempt++){
    try{current=await call('read');if(current.status?.authoring)break;}catch{}
    await page.waitForTimeout(100);
  }
  report.startupStatus=current; await page.screenshot({path:join(output,'startup-observed.png')});
  assert.equal(current.status.authoring.playback,'playing');
  assert.equal(await page.locator('.preview-surface canvas').count(),1);
  await page.screenshot({path:join(output,'startup-playing.png')});
  report.checks.push('Normal startup built and played the initial visual without a Build action');
  await page.getByRole('slider',{name:'Preview resolution scale',exact:true}).press('Home');
  await page.waitForFunction(()=>{
    const canvas=document.querySelector('.preview-surface canvas');
    return canvas?.width===640&&canvas?.height===360&&document.querySelector('.preview-resolution-value')?.textContent==='640 × 360';
  });
  const lowResolution=(await call('status')).authoring.output;
  assert.equal(lowResolution.width,640);assert.equal(lowResolution.height,360);
  report.interactionOutput=lowResolution;

  const code=await readFile(join(root,'skills/lux-visual-creation/assets/noise-sphere.ts'),'utf8');
  const source={sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':code}};
  let built=await call('build',{source,expectedDraftVersion:current.draftVersion});
  let runtime=built.status.authoring;
  await page.getByRole('button',{name:'View',exact:true}).click();
  await page.getByRole('menuitem',{name:'Inspector',exact:true}).click();
  await page.getByRole('button',{name:'Animate Spike height',exact:true}).click();
  await page.getByRole('button',{name:'Add LFO',exact:true}).click();
  await page.getByRole('spinbutton',{name:'Animation amount',exact:true}).waitFor();
  for(let attempt=0;attempt<300;attempt++){
    runtime=(await call('status')).authoring;
    if(runtime.controlAnimations?.length===1)break;
    await page.waitForTimeout(50);
  }
  assert.equal(runtime.controlAnimations.length,1);

  current=await call('read');
  const delayed={...source,files:{'visual.ts':code.replace('async create(context) {','async create(context) {\n    await new Promise(resolve => setTimeout(resolve, 3000));')}};
  const originalCanvas=await page.locator('.preview-surface canvas').evaluate(element=>{element.dataset.lifecycleOwner='original';return element.dataset.lifecycleOwner;});
  const replacing=call('build',{source:delayed,expectedDraftVersion:current.draftVersion});
  await page.getByRole('button',{name:'Build',exact:true}).waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('[aria-label="Build"]')?.getAttribute('aria-busy')==='true');
  assert.equal(await page.locator('.preview-surface canvas[data-lifecycle-owner="original"]').count(),1);
  const before=await call('status'),target=before.authoring;
  const control=call('parameters',{instanceId:target.instanceId,expectedGeneration:target.generation,expectedRevisionId:target.revisionId,
    expectedControlSchemaHash:target.controlSchemaHash,values:{spikeHeight:1.7}});
  const amount=page.getByRole('spinbutton',{name:'Animation amount',exact:true});
  assert.equal(await amount.isDisabled(),false);
  await amount.fill('0.6');await amount.press('Enter');
  const pause=call('playback',{instanceId:target.instanceId,expectedGeneration:target.generation,action:'pause'});
  await Promise.all([control,pause]);
  for(let attempt=0;attempt<300;attempt++){
    const status=(await call('status')).authoring;
    if(status.controls.spikeHeight===1.7&&status.controlAnimations?.[0]?.amount===.6&&status.playback==='paused')break;
    await page.waitForTimeout(25);
  }
  const during=(await call('status')).authoring;
  assert.equal(during.generation,target.generation);
  assert.equal(during.controls.spikeHeight,1.7);assert.equal(during.controlAnimations[0].amount,.6);assert.equal(during.playback,'paused');
  assert.equal(await page.locator('.preview-surface canvas[data-lifecycle-owner="original"]').count(),1);
  await page.screenshot({path:join(output,'background-build-edits.png')});
  built=await replacing;runtime=built.status.authoring;
  assert.ok(runtime.generation>target.generation);
  assert.equal(runtime.controls.spikeHeight,1.7);assert.equal(runtime.controlAnimations[0].amount,.6);assert.equal(runtime.playback,'paused');
  assert.equal(await page.locator('.preview-surface canvas[data-lifecycle-owner="original"]').count(),0);
  await page.screenshot({path:join(output,'promoted-paused.png')});
  report.checks.push('Background candidate kept the old canvas and editable controls, then promoted with latest control, animation, and Pause state');

  current=await call('read');const accepted={revisionId:runtime.revisionId,generation:runtime.generation,controls:runtime.controls,animations:runtime.controlAnimations,playback:runtime.playback};
  await assert.rejects(call('build',{expectedDraftVersion:current.draftVersion,source:{...delayed,files:{'visual.ts':'not valid TypeScript !!!'}}}));
  const retained=(await call('status')).authoring;
  assert.equal(retained.revisionId,accepted.revisionId);assert.equal(retained.generation,accepted.generation);
  assert.deepEqual(retained.controls,accepted.controls);assert.deepEqual(retained.controlAnimations,accepted.animations);assert.equal(retained.playback,accepted.playback);
  await page.screenshot({path:join(output,'invalid-build-retained.png')});
  report.checks.push('Invalid replacement retained the promoted visual, base controls, animation, and explicit Pause');
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.failure=error.stack??String(error);process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});}
finally{
  if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});report.exitCode=child.exitCode;}
  await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({output,...report},null,2));
}

