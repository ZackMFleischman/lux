import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { studioTestEnvironment, resolveStudioSession } from './studio-session.mjs';
import { installedElectron } from './studio-electron.mjs';
const root=resolve(import.meta.dirname,'..');
const output=join(root,'artifacts/menu-style',`run-${Date.now()}`); await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
const report={ok:false,root,commit:execFileSync('git',['-c',`safe.directory=${root}`,'rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),session:resolveStudioSession({workspace:root,env}),checks:[],errors:[]};
let app,page;
try {
 app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,chromiumSandbox:true}); report.pid=app.process().pid;
 page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.getByRole('button',{name:'Build',exact:true}).click();
 await page.getByRole('button',{name:'Pause',exact:true}).waitFor({timeout:60000});
 await page.locator('.preview-surface canvas').waitFor();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1360,900));
 await page.screenshot({path:join(output,'workspace.png')});
 const appearance=async locator=>locator.evaluate(el=>{const s=getComputedStyle(el);return {font:s.font,color:s.color,height:el.getBoundingClientRect().height};});
 report.fileTrigger=await appearance(page.getByRole('button',{name:'File',exact:true}));report.viewTrigger=await appearance(page.getByRole('button',{name:'View',exact:true}));assert.deepEqual(report.fileTrigger,report.viewTrigger);
 await page.getByRole('button',{name:'File',exact:true}).click();
 report.fileItem=await appearance(page.getByRole('menuitem',{name:'Open',exact:true}));await page.screenshot({path:join(output,'file-menu.png')});
 await page.getByRole('button',{name:'View',exact:true}).click();
 assert.equal(await page.getByRole('menu').count(),1);await page.getByRole('menu',{name:'View',exact:true}).waitFor();
 report.viewItem=await appearance(page.getByRole('menuitem',{name:'Preview',exact:true}));assert.deepEqual(report.fileItem,report.viewItem);await page.screenshot({path:join(output,'view-menu.png')});
 await page.keyboard.press('ArrowLeft');await page.getByRole('menu',{name:'File',exact:true}).waitFor();assert.equal(await page.getByRole('menu').count(),1);
 await page.keyboard.press('Escape');assert.equal(await page.getByRole('menu').count(),0);assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'File');
 await page.getByRole('button',{name:'File',exact:true}).click();await page.locator('.brand').click();assert.equal(await page.getByRole('menu').count(),0);
 for(const [name,title] of [['Looks…','Looks'],['Export for Resolume','Export for Resolume']]){
   await page.getByRole('button',{name:'File',exact:true}).click();await page.getByRole('menuitem',{name,exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent==='File');
 }
 await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('menuitem',{name:'Layouts…',exact:true}).click();await page.getByRole('button',{name:'Reset desktop layout',exact:true}).click();await page.getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Add pane to Preview group',exact:true}).click();await page.getByRole('menuitem',{name:/Move Source here|Focus Source/}).click();await page.getByRole('menu').waitFor({state:'hidden'});
 await page.mouse.move(5,5);
 const inactive=page.locator('.dv-tab.dv-inactive-tab').first();await inactive.waitFor();
 const close=inactive.locator('.dv-default-tab-action');assert.equal(await close.evaluate(el=>getComputedStyle(el).visibility),'visible');
 report.closedTab=await inactive.innerText();await page.screenshot({path:join(output,'tabs-visible.png')});await close.click();
 await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('menuitem',{name:report.closedTab,exact:true}).click();
 assert.equal(await page.locator('.connection,.build-status,.playback-state,.status-runtime').count(),0);
 await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Play',exact:true}).waitFor();await page.getByRole('button',{name:'Play',exact:true}).click();await page.getByRole('button',{name:'Pause',exact:true}).waitFor({timeout:60000});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(820,720));
 await page.getByRole('button',{name:'File',exact:true}).click();await page.screenshot({path:join(output,'narrow-file.png')});await page.getByRole('button',{name:'View',exact:true}).click();await page.screenshot({path:join(output,'narrow-view.png')});assert.equal(await page.getByRole('menu').count(),1);await page.keyboard.press('Escape');
 const build=await page.getByRole('button',{name:'Build',exact:true}).boundingBox();assert.ok(build.x>=0&&build.x+build.width<=820);
 report.checks=['Matching menu trigger and item fonts/colors/sizes','File/View pointer switch and keyboard switch show one menu','Escape focus, outside dismissal, Looks/Export/Layouts dialogs','Inactive tab close visible away from pointer and closes','Redundant labels absent; Play/Pause functional','Normal and 820px screenshots; Build remains in bounds'];assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error.stack??error);if(page)await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{if(app)await app.close();if(report.pid){try{process.kill(report.pid,0);report.processExited=false;}catch{report.processExited=true;}}await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2));}

