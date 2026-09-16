import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';
import {nestedPrismaticCompositionSource} from '../tests/studio/fixtures/nested-prismatic-composition/source-bundle.mjs';

const root=resolve(import.meta.dirname,'..').replaceAll('\\','/'),output=join(root,'artifacts/component-model',`native-${Date.now()}`);
await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
const session=resolveStudioSession({workspace:root,env});
const report={ok:false,root,profile:session.profile,commit:execFileSync('git',['-C',root,'-c',`safe.directory=${root}`,'-c','core.excludesFile=','rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks:[],screenshots:[],errors:[]};
let app,page,child;
try {
  app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});
  child=app.process();report.launcherPid=child.pid;report.pid=await app.evaluate(()=>process.pid);page=await app.firstWindow();page.setDefaultTimeout(20000);
  page.on('pageerror',error=>report.errors.push(error.stack??error.message));
  let endpoint;
  for(let attempt=0;attempt<100;attempt++){try{endpoint=JSON.parse(await readFile(session.endpointPath,'utf8'));if(endpoint.pid===report.pid)break;}catch{}await page.waitForTimeout(100);}
  assert.equal(endpoint?.pid,report.pid);
  const call=createStudioConnection({...session,expectedSessionId:endpoint.sessionId});
  async function statusWhen(predicate){for(let attempt=0;attempt<100;attempt++){const state=await call('status');if(predicate(state.authoring))return state.authoring;await page.waitForTimeout(100);}throw Error('Runtime state did not settle');}
  async function capture(name){const path=join(output,`${name}.png`);await page.screenshot({path});report.screenshots.push(path);}
  await statusWhen(runtime=>runtime?.playback==='playing');
  await page.getByRole('button',{name:'Pause',exact:true}).waitFor();
  const plain={sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':await readFile(join(root,'skills/lux-visual-creation/assets/noise-sphere.ts'),'utf8')}};
  const legacy=nestedPrismaticCompositionSource(),modern=structuredClone(legacy);
  for(const path of ['composition.ts','double-mirror.ts','wrapped-mirror.ts'])modern.files[path]=modern.files[path].replaceAll('defineComposition',path===modern.entry?'defineVisual':'defineComponent');
  const cases=[['legacy-direct',plain,'Spike height',1.2,'spikeHeight',[]],['legacy-graph',legacy,'Spike amount',.8,'intensity',['11111111-1111-4111-8111-111111111111']],['component-graph',modern,'Spike amount',.8,'intensity',['11111111-1111-4111-8111-111111111111']]];
  for(const [name,source,label,value,controlId,nodePath] of cases){
    report.stage=name;await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));
    await page.setViewportSize({width:1360,height:900});
    let draft=await call('read');await call('build',{source,expectedDraftVersion:draft.draftVersion});
    await statusWhen(runtime=>runtime?.playback==='playing');
    await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('menuitem',{name:'Graph',exact:true}).click();
    if(name==='legacy-graph'){
      assert.equal(await page.locator('.graph-scene-root').getAttribute('aria-pressed'),'true','direct-only selection returns to Scene after representation change');
      assert.equal(await page.getByRole('button',{name:'Controls for Nested prismatic mirrors',exact:true}).count(),0);
    }
    if(nodePath.length){
      const group=page.locator('.graph-node').filter({hasText:'Double mirror 1'});
      await group.focus();await page.keyboard.press('Enter');
      await page.getByRole('button',{name:/^Back to /}).waitFor();
      await capture(`${name}-inside`);
      await page.getByRole('button',{name:/^Back to /}).click();
    }
    const node=nodePath.length?page.locator('.graph-node').filter({hasText:'Prismatic Ball'}):page.locator('.graph-node').filter({hasText:/Visual/});
    await node.click();
    await page.getByRole('button',{name:nodePath.length?'Controls for Prismatic Ball':'Controls for Visual',exact:true}).waitFor();
    const number=page.getByRole('spinbutton',{name:`${label} value`,exact:true});await number.fill(String(value));await number.press('Enter');
    const base=runtime=>nodePath.length?runtime.nodeControls.nodes.find(row=>JSON.stringify(row.nodePath)===JSON.stringify(nodePath)).values[controlId]:runtime.controls[controlId];
    let runtime=await statusWhen(runtime=>base(runtime)===value);
    if(!nodePath.length){assert.equal(runtime.composition,undefined);assert.equal(runtime.nodeControls,undefined);}
    await page.getByRole('button',{name:`Animate ${label}`,exact:true}).click();
    const add=page.getByRole('button',{name:'Add LFO',exact:true});if(await add.count())await add.click();
    runtime=await statusWhen(runtime=>runtime.controlAnimations.some(binding=>JSON.stringify(binding.nodePath)===JSON.stringify(nodePath)&&binding.controlId===controlId));
    assert.equal(base(runtime),value);await capture(`${name}-controls`);await page.keyboard.press('Escape');
    await page.setViewportSize({width:820,height:720});await page.getByRole('button',{name:'Fit',exact:true}).click();await capture(`${name}-narrow`);
    draft=await call('read');const path=join(output,`${name}.lux-scene`);
    await call('scene.save',{path,expectedDraftVersion:draft.draftVersion,overwrite:false});
    const saved=await readFile(path,'utf8'),document=JSON.parse(saved);
    assert.equal(document.version,nodePath.length?4:3);assert.deepEqual(document.source,source);
    draft=await call('read');await call('scene.open',{path,expectedDraftVersion:draft.draftVersion,discardDirty:true});
    runtime=await statusWhen(runtime=>base(runtime)===value);assert.deepEqual(runtime.controlAnimations,document.controlAnimations);
    const revision=runtime.revisionId;draft=await call('read');
    await assert.rejects(call('build',{source:{...source,files:{...source.files,[source.entry]:'not valid TypeScript !!!'}},expectedDraftVersion:draft.draftVersion}));
    runtime=(await call('status')).authoring;assert.equal(runtime.revisionId,revision);assert.equal(base(runtime),value);assert.deepEqual(runtime.controlAnimations,document.controlAnimations);
    assert.equal(await readFile(path,'utf8'),saved);await capture(`${name}-failed-build`);
    report.checks.push(`${name}: Graph/Inspector base edit and LFO identity, narrow layout, unchanged source save/reopen, failed-build retention and unchanged saved file`);
  }
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=error.stack??String(error);process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});}
finally{
  if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});report.exitCode=child.exitCode;}
  if(report.pid){try{process.kill(report.pid,0);report.processExited=false;}catch{report.processExited=true;}}
  await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2));
}
