import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {installedElectron} from '../../scripts/studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from '../../scripts/studio-session.mjs';
const root=resolve('.'),out=join(root,'artifacts/story-timeline-ui',process.argv[2]??'baseline');await mkdir(out,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath},session=resolveStudioSession({workspace:root,env});
const testedSource=Object.fromEntries(await Promise.all(['apps/studio/src/story/StoryPanel.tsx','apps/studio/src/studio.css','apps/studio/dist/renderer.js','apps/studio/dist/renderer.css'].map(async p=>[p,createHash('sha256').update(await readFile(join(root,p))).digest('hex')])));
const report={root,profile:session.profile,testedSource,checks:[],errors:[]};let app,child;const stderr=[];
try {
 app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,chromiumSandbox:true});child=app.process();child.stderr?.on('data',b=>stderr.push(String(b)));
 const page=await app.firstWindow();page.setDefaultTimeout(20000);await page.setViewportSize({width:1440,height:960});page.on('pageerror',e=>report.errors.push(String(e)));
 const call=createStudioConnection(session),wait=async(fn,label)=>{for(let i=0;i<200;i++){try{const s=await call('status');if(fn(s.authoring))return s.authoring;}catch{}await page.waitForTimeout(150);}throw Error(label);};
 await wait(s=>!!s?.revisionId,'startup');
 const initialScale=page.getByRole('slider',{name:'Preview resolution scale',exact:true});await page.waitForFunction(()=>document.querySelector('input[aria-label="Preview resolution scale"]')?.disabled===false);await initialScale.focus();await page.keyboard.press('Home');await page.waitForFunction(()=>{const el=document.querySelector('input[aria-label="Preview resolution scale"]');return el&&!el.disabled&&el.value==='360';},undefined,{timeout:90000});console.log('Initial scale',await initialScale.inputValue()); 
 const script=await readFile(join(root,'scripts/test-studio-story-schedule.mjs'),'utf8');
 // Reuse the existing native Story fixture producer, with dense representative occurrences.
 const fixtureCode=script.slice(script.indexOf('const visualSource='),script.indexOf('await verifyStorySceneDocumentV7(document);'));
 const document=Function('sha256',fixtureCode+';return document;')(v=>createHash('sha256').update(v).digest('hex'));
 document.story.crossfadeSeconds=0;
 document.story.beats[0].label='Arrival';document.story.beats[1].label='Orbital drift and tidal distortion';
 document.story.sequence=Array.from({length:9},(_,i)=>({id:`pass-${i+1}`,beatId:i%3===1?'hold':'arrival',visualId:i%2?'lead':'ambient',follow:i%3===1?{kind:'manual'}:{kind:'after',seconds:[12,8,20][i%3]}}));
 const initial=await wait(s=>!!s?.revisionId,'before build');if(initial.playback==='playing')await call('playback',{instanceId:initial.instanceId,expectedGeneration:initial.generation,action:'pause'});
 const current=await call('read');await call('build',{document,expectedDraftVersion:current.draftVersion});await wait(s=>!!s?.storySchedule?.committed,'story build');
 const scale=page.getByRole('slider',{name:'Preview resolution scale',exact:true});assert.equal(await scale.inputValue(),'360');
 await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('menuitem',{name:'Story',exact:true}).click();
 await page.locator('.story-panel').waitFor();await page.getByRole('button',{name:'Start story',exact:true}).click();await wait(s=>s?.storySchedule?.committed?.frame.state==='active','start');
 await page.getByRole('button',{name:'Pause story',exact:true}).click();await wait(s=>s?.storySchedule?.phase==='paused','pause');
 await page.screenshot({path:join(out,'wide.png')});
 report.geometry=await page.locator('.story-panel').evaluate(el=>{const panel=el.getBoundingClientRect(),ribbon=el.querySelector('.story-ribbon').getBoundingClientRect();return {panel:{x:panel.x,y:panel.y,width:panel.width,height:panel.height},ribbon:{y:ribbon.y,height:ribbon.height,bottom:ribbon.bottom},visible:ribbon.bottom<=panel.bottom};});
 await page.setViewportSize({width:1100,height:720});await page.screenshot({path:join(out,'laptop.png')});
 if(process.argv[2]?.startsWith('final')){
 await page.setViewportSize({width:1440,height:960});
 const rows=page.getByRole('list',{name:'Story sequence'}).getByRole('button');
 const before=(await call('status')).authoring.storySchedule;
 await rows.nth(1).click();assert.equal(await rows.nth(1).getAttribute('aria-pressed'),'true');
 assert.equal((await call('status')).authoring.storySchedule.committed.activationId,before.committed.activationId);
 await page.screenshot({path:join(out,'selected-manual.png')});report.checks.push('Pointer selection does not move the active occurrence');
 await rows.nth(8).focus();await page.keyboard.press('Enter');assert.equal(await rows.nth(8).getAttribute('aria-pressed'),'true');
 const lastBox=await rows.nth(8).boundingBox(),ribbonBox=await page.locator('.story-ribbon').boundingBox();assert.ok(lastBox.x>=ribbonBox.x&&lastBox.x+lastBox.width<=ribbonBox.x+ribbonBox.width+2);report.checks.push('Keyboard focus reveals and selects the final occurrence');
 await page.getByRole('button',{name:/Start here: Arrival — occurrence 9 of 9/}).click();await wait(s=>s.storySchedule?.sequence.occurrenceId==='pass-9','start selected');
 if(await page.getByRole('button',{name:'Pause story',exact:true}).isVisible())await page.getByRole('button',{name:'Pause story',exact:true}).click();await wait(s=>s.storySchedule?.phase==='paused','pause selected');
 const scrub=page.getByRole('slider',{name:'Local time for Arrival'});await scrub.focus();await page.keyboard.press('End');await wait(s=>s.storySchedule?.committed.frame.localTimeSeconds>=3.9,'keyboard seek');report.checks.push('Start selected occurrence and keyboard local seek');
 await page.getByRole('button',{name:'Replay Arrival',exact:true}).click();await wait(s=>s.storySchedule?.committed.frame.localTimeSeconds<1,'replay');
 await page.getByRole('button',{name:'Loop Arrival',exact:true}).click();await wait(s=>s.storySchedule?.loop===true,'loop');report.checks.push('Replay and loop');
 await page.getByRole('button',{name:'Launch Orbital drift and tidal distortion',exact:true}).click();await wait(s=>s.storySchedule?.committed.frame.beatId==='hold'&&s.storySchedule?.sequence.state==='detached','launch sustained');assert.equal(await page.getByRole('slider',{name:/Local time/}).count(),0);
 await page.screenshot({path:join(out,'sustained.png')});report.checks.push('Manual launch detaches without a fabricated sustained scrub');
 await page.setViewportSize({width:780,height:720});await page.screenshot({path:join(out,'narrow.png')});
 const panelOverflow=await page.locator('.story-panel').evaluate(e=>e.scrollWidth>e.clientWidth+1);assert.equal(panelOverflow,false);report.checks.push('Narrow panel contains horizontal scrolling inside the sequence and beat strip');
 await page.getByRole('button',{name:'Return to normal',exact:true}).click();await wait(s=>s.storySchedule?.committed.frame.state==='normal','return normal');report.checks.push('Return to normal');
 }
 report.runtime=await call('status');report.ok=true;
} catch(e){report.error=String(e.stack??e);if(app){const p=await app.firstWindow();await p.screenshot({path:join(out,'failure.png')}).catch(()=>{});}process.exitCode=1;} finally {if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});report.pid=child.pid;}report.stderr=stderr;await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,error:report.error,out,geometry:report.geometry}));}
