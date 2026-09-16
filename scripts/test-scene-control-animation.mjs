import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';
import {prismaticCompositionSource} from '../tests/studio/fixtures/prismatic-composition/source-bundle.mjs';

const root=resolve(import.meta.dirname,'..');
const output=join(root,'artifacts','scene-animation',`run-${Date.now()}`);
await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
const session=resolveStudioSession({workspace:root,env});
const report={ok:false,profile:session.profile,source:execFileSync('git',['-C',root,'-c',`safe.directory=${root}`,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks:[],errors:[]};
let app,page,child;
try {
  app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});
  child=app.process();report.pid=child.pid;
  page=await app.firstWindow();page.setDefaultTimeout(15000);
  page.on('pageerror',error=>report.errors.push(error.stack??error.message));
  const call=createStudioConnection(session);
  let current;
  for(let attempt=0;attempt<80;attempt++){
    try{current=await call('read');if(current.source)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(current?.source);
  const source={sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':await readFile(join(root,'skills/lux-visual-creation/assets/noise-sphere.ts'),'utf8')}};
  await call('build',{source,expectedDraftVersion:current.draftVersion});
  await page.getByRole('button',{name:'Animate Spike height',exact:true}).click();
  await page.getByRole('button',{name:'Add LFO',exact:true}).click();
  await page.getByRole('checkbox',{name:'On',exact:true}).waitFor();
  async function animatedStatus(predicate){for(let attempt=0;attempt<100;attempt++){const value=await call('status');if(predicate(value.authoring))return value;await page.waitForTimeout(50);}throw Error('Animation status did not settle');}
  let status=await animatedStatus(runtime=>runtime.controlAnimations?.length===1);
  assert.equal(status.authoring.controlAnimations.length,1);
  assert.deepEqual(status.authoring.controlAnimations[0].nodePath,[]);
  assert.equal(status.authoring.controls.spikeHeight,.85);
  const before=status.authoring.effectiveControls.spikeHeight;
  await page.waitForTimeout(350);
  status=await call('status');
  assert.notEqual(status.authoring.effectiveControls.spikeHeight,before);
  await page.screenshot({path:join(output,'scene-animation.png')});
  report.checks.push('Flat SDK 0.2 scene animation changes effective output while preserving base');
  const group=page.locator('details.parameter-group').filter({has:page.locator('summary',{hasText:'Shape'})});
  await group.locator('summary').focus();
  await page.keyboard.press('Space');
  await page.getByRole('dialog',{name:'Animate Spike height',exact:true}).waitFor({state:'hidden'});
  assert.equal(await group.getAttribute('open'),null);
  await page.screenshot({path:join(output,'group-collapsed.png')});
  await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Animate Spike height',exact:true}).waitFor();
  status=await call('status');assert.equal(status.authoring.controlAnimations.length,1);
  report.checks.push('Keyboard group collapse closes its animation popup and preserves the binding');
  await page.keyboard.press('Escape');
  current=await call('read');
  const path=join(output,'animated.lux-scene');
  await call('scene.save',{path,expectedDraftVersion:current.draftVersion,overwrite:false});
  await call('scene.open',{path,expectedDraftVersion:current.draftVersion,discardDirty:true});
  status=await call('status');
  assert.equal(status.authoring.controlAnimations.length,1);
  assert.equal(status.authoring.controls.spikeHeight,.85);
  const identity=status.authoring.revisionId;
  current=await call('read');
  await assert.rejects(call('build',{expectedDraftVersion:current.draftVersion,source:{...source,files:{'visual.ts':'not valid TypeScript !!!'}}}));
  status=await call('status');assert.equal(status.authoring.revisionId,identity);
  assert.equal(status.authoring.controlAnimations.length,1);
  report.checks.push('Save/reopen retains animation; invalid edit preserves working runtime and animation');
  current=await call('read');
  await call('build',{source:prismaticCompositionSource(),expectedDraftVersion:current.draftVersion});
  await page.getByRole('button',{name:'Animate Spike amount',exact:true}).click();
  await page.getByRole('button',{name:'Add LFO',exact:true}).click();
  await page.getByRole('checkbox',{name:'On',exact:true}).waitFor();
  status=await animatedStatus(runtime=>runtime.controlAnimations?.some(binding=>binding.nodePath.length>0 && binding.controlId==='intensity'));assert.ok(status.authoring.controlAnimations.some(binding=>binding.nodePath.length>0 && binding.controlId==='intensity'));  
  await page.screenshot({path:join(output,'component-animation.png')});
  report.checks.push('Composition Scene alias still animates its canonical component control');
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.failure=error.stack??String(error);process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});}
finally{
  if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});report.exitCode=child.exitCode;}
  await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({output,...report},null,2));
}
