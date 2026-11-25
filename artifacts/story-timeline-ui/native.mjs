import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {installedElectron} from '../../scripts/studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from '../../scripts/studio-session.mjs';
const root=resolve('.'),out=join(root,'artifacts/story-timeline-ui',process.argv[2]??'baseline');await mkdir(out,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath},session=resolveStudioSession({workspace:root,env});
const report={root,profile:session.profile,checks:[],errors:[]};let app,child;
try {
 app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,chromiumSandbox:true});child=app.process();
 const page=await app.firstWindow();page.setDefaultTimeout(20000);await page.setViewportSize({width:1440,height:960});page.on('pageerror',e=>report.errors.push(String(e)));
 const call=createStudioConnection(session),wait=async(fn,label)=>{for(let i=0;i<200;i++){try{const s=await call('status');if(fn(s.authoring))return s.authoring;}catch{}await page.waitForTimeout(150);}throw Error(label);};
 await wait(s=>!!s?.revisionId,'startup');
 const script=await readFile(join(root,'scripts/test-studio-story-schedule.mjs'),'utf8');
 // Reuse the existing native Story fixture producer, with dense representative occurrences.
 const fixtureCode=script.slice(script.indexOf('const visualSource='),script.indexOf('await verifyStorySceneDocumentV7(document);'));
 const document=Function('sha256',fixtureCode+';return document;')(v=>createHash('sha256').update(v).digest('hex'));
 document.story.crossfadeSeconds=0;
 document.story.beats[0].label='Arrival';document.story.beats[1].label='Orbital drift and tidal distortion';
 document.story.sequence=Array.from({length:9},(_,i)=>({id:`pass-${i+1}`,beatId:i%3===1?'hold':'arrival',visualId:i%2?'lead':'ambient',follow:i%3===1?{kind:'manual'}:{kind:'after',seconds:[12,8,20][i%3]}}));
 const current=await call('read');await call('build',{document,expectedDraftVersion:current.draftVersion});await wait(s=>!!s?.storySchedule?.committed,'story build');
 const scale=page.getByRole('slider',{name:'Preview resolution scale',exact:true});await scale.focus();await page.keyboard.press('Home');
 await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('menuitem',{name:'Story',exact:true}).click();
 await page.locator('.story-panel').waitFor();await page.getByRole('button',{name:'Start story',exact:true}).click();await wait(s=>s?.storySchedule?.committed?.frame.state==='active','start');
 await page.getByRole('button',{name:'Pause story',exact:true}).click();await wait(s=>s?.storySchedule?.phase==='paused','pause');
 await page.screenshot({path:join(out,'wide.png')});
 report.geometry=await page.locator('.story-panel').evaluate(el=>{const panel=el.getBoundingClientRect(),ribbon=el.querySelector('.story-ribbon').getBoundingClientRect();return {panel:{x:panel.x,y:panel.y,width:panel.width,height:panel.height},ribbon:{y:ribbon.y,height:ribbon.height,bottom:ribbon.bottom},visible:ribbon.bottom<=panel.bottom};});
 await page.setViewportSize({width:1100,height:720});await page.screenshot({path:join(out,'laptop.png')});
 report.runtime=await call('status');report.ok=true;
} catch(e){report.error=String(e.stack??e);process.exitCode=1;} finally {if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});report.pid=child.pid;}await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,error:report.error,out,geometry:report.geometry}));}
