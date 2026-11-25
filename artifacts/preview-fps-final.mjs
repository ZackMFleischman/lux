import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {_electron} from 'playwright';
const root=resolve('.worktrees/preview-fps');
const {installedElectron}=await import(pathToFileURL(join(root,'scripts/studio-electron.mjs')));
const {studioTestEnvironment,resolveStudioSession,createStudioConnection}=await import(pathToFileURL(join(root,'scripts/studio-session.mjs')));
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};const session=resolveStudioSession({workspace:root,env});
const out=resolve('artifacts/preview-fps-final');await mkdir(out,{recursive:true});let app,child;const report={ok:false,errors:[]};
try{
app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,chromiumSandbox:true});child=app.process();const page=await app.firstWindow();page.setDefaultTimeout(15000);await page.setViewportSize({width:1360,height:900});const call=createStudioConnection(session);
let ready=false;for(let i=0;i<100;i++){try{await call('read');ready=true;break;}catch{}await page.waitForTimeout(100);}assert.ok(ready);
const source={sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':await readFile(join(root,'skills/lux-visual-creation/assets/noise-sphere.ts'),'utf8')}};
let built=false;for(let i=0;i<150;i++){const draft=await call('read');try{await call('build',{source,expectedDraftVersion:draft.draftVersion});built=true;break;}catch(e){if(i%20===0)console.log(String(e));if(!/busy|editor changed|draft/i.test(String(e)))throw e;await page.waitForTimeout(300);}}
assert.ok(built,'Build never accepted');
await page.getByRole('button',{name:'Pause',exact:true}).waitFor();const scale=page.getByRole('slider',{name:'Preview resolution scale',exact:true});await scale.focus();await page.keyboard.press('Home');
const fps=page.locator('.preview-fps');await page.waitForFunction(()=>/\d+\.\d+ FPS/.test(document.querySelector('.preview-fps')?.textContent??''),{timeout:15000});
report.playing=await fps.textContent();await page.screenshot({path:join(out,'playing.png')});
await page.getByRole('button',{name:'Pause',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.preview-fps')?.textContent==='— FPS');report.paused=await fps.textContent();await page.screenshot({path:join(out,'paused.png')});report.ok=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1;}finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});report.pid=child.pid;report.exitCode=child.exitCode;}await writeFile(join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}

