import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { prismaticCompositionSource } from '../tests/studio/fixtures/prismatic-composition/source-bundle.mjs';
import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { studioTestEnvironment, resolveStudioSession } from './studio-session.mjs';
import { installedElectron } from './studio-electron.mjs';
const root=resolve(import.meta.dirname,'..');
const output=join(root,'artifacts/menu-style',`run-${Date.now()}`); await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
const report={ok:false,root,commit:execFileSync('git',['-c',`safe.directory=${root}`,'rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),session:resolveStudioSession({workspace:root,env}),checks:[],errors:[]};
let app,page,client;
try {
 app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,chromiumSandbox:true}); report.pid=await app.evaluate(() => process.pid);
 page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
 let endpoint;
 for(let i=0;i<100;i++){try{endpoint=JSON.parse(await readFile(report.session.endpointPath,'utf8'));if(endpoint.pid===report.pid)break;}catch{}await page.waitForTimeout(100);}
 assert.equal(endpoint.pid,report.pid);
 client=new Client({name:'menu-layout-qa',version:'1'});await client.connect(new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/studio-mcp.mjs')],cwd:root,env:{...env,LUX_STUDIO_SESSION_ID:endpoint.sessionId}}));
 const call=async(name,args={})=>{const r=await client.callTool({name:'lux.studio.'+name,arguments:args},undefined,{timeout:90000});assert.ok(!r.isError,JSON.stringify(r));return JSON.parse(r.content.find(x=>x.type==='text').text);};
 const draft=await call('read');await call('build',{expectedDraftVersion:draft.draftVersion,source:prismaticCompositionSource()});
 await page.getByRole('button',{name:'Build',exact:true}).click();
 await page.getByRole('button',{name:'Pause',exact:true}).waitFor({timeout:60000});
 await page.locator('.preview-surface canvas').waitFor();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1360,900));
 await page.locator('.graph-node').first().waitFor();
 assert.equal(await page.locator('.dv-tab').filter({hasText:/^Graph$/}).count(),1);
 await page.getByRole('button',{name:'Fit',exact:true}).click();
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
 await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('menuitem',{name:'Layouts…',exact:true}).click();await page.getByRole('button',{name:'Reset laptop layout',exact:true}).click();await page.getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(await page.locator('.dv-tab').filter({hasText:/^Graph$/}).count(),1);await page.locator('.dv-tab').filter({hasText:/^Graph$/}).click();await page.getByRole('button',{name:'Fit',exact:true}).click();await page.screenshot({path:join(output,'laptop-graph.png')});
 report.checks=['Graph visible by default on desktop beside live Preview; Graph tab in reset laptop layout','Matching menu trigger and item fonts/colors/sizes','File/View pointer switch and keyboard switch show one menu','Escape focus, outside dismissal, Looks/Export/Layouts dialogs','Inactive tab close visible away from pointer and closes','Redundant labels absent; Play/Pause functional','Normal and 820px screenshots; Build remains in bounds'];assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error.stack??error);if(page)await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await client?.close();if(app)await app.close();if(report.pid){try{process.kill(report.pid,0);report.processExited=false;}catch{report.processExited=true;}}await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2));}

