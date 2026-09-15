import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { nestedPrismaticCompositionSource } from '../tests/studio/fixtures/nested-prismatic-composition/source-bundle.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { studioTestEnvironment, resolveStudioSession } from './studio-session.mjs';
import { installedElectron } from './studio-electron.mjs';
const root=resolve(import.meta.dirname,'..');
const output=join(root,'artifacts/inspector-navigation',`run-${Date.now()}`); await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
const report={ok:false,root,commit:execFileSync('git',['-c',`safe.directory=${root}`,'rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),session:resolveStudioSession({workspace:root,env}),checks:[],errors:[]};
let app,page,client,child;
try {
 child=spawn(installedElectron(root),['--remote-debugging-port=0',join(root,'apps/studio/dist/main.cjs')],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});report.pid=child.pid;
 let port;for(let i=0;i<150;i++){try{port=(await readFile(join(report.session.directory,'DevToolsActivePort'),'utf8')).split('\n')[0];if(port)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 assert.ok(port,'Owned Studio exposes its private debug endpoint');
 app=await chromium.connectOverCDP('http://127.0.0.1:'+port);const context=app.contexts()[0];page=context.pages()[0]??await context.waitForEvent('page');page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
 let endpoint;
 for(let i=0;i<100;i++){try{endpoint=JSON.parse(await readFile(report.session.endpointPath,'utf8'));if(endpoint.pid===report.pid)break;}catch{}await page.waitForTimeout(100);}
 assert.equal(endpoint.pid,report.pid);
 client=new Client({name:'inspector-navigation-qa',version:'1'});await client.connect(new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/studio-mcp.mjs')],cwd:root,env:{...env,LUX_STUDIO_SESSION_ID:endpoint.sessionId}}));
 const call=async(name,args={})=>{const r=await client.callTool({name:'lux.studio.'+name,arguments:args},undefined,{timeout:90000});assert.ok(!r.isError,JSON.stringify(r));return JSON.parse(r.content.find(x=>x.type==='text').text);};

 const draft=await call('read');await call('build',{expectedDraftVersion:draft.draftVersion,source:nestedPrismaticCompositionSource()});
 await page.getByRole('button',{name:'Pause',exact:true}).waitFor({timeout:60000});
 await page.setViewportSize({width:1360,height:900});
 const node=name=>page.locator('.graph-node').filter({hasText:name});
 await node('Double mirror 1').dblclick();await node('Wrapped mirror').dblclick();await page.locator('.graph-node').first().click();
 const nav=page.getByRole('navigation',{name:'Inspector controls path'});
 await nav.getByRole('button',{name:'Controls for Wrapped mirror',exact:true}).waitFor();
 const graphTab=page.locator('.dv-tab').filter({hasText:/^Graph$/});await graphTab.locator('.dv-default-tab-action').click();
 assert.equal(await graphTab.count(),0);
 const before=(await call('status')).authoring;
 report.headings=await page.locator('.studio-disclosure > summary').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,fontSize:getComputedStyle(n).fontSize})));
 assert.ok(report.headings.every(h=>h.fontSize==='14px'));
 await page.screenshot({path:join(output,'nested-inspector.png')});
 await page.setViewportSize({width:820,height:720});await page.screenshot({path:join(output,'narrow-inspector.png')});
 const bounds=await nav.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert.ok(bounds.scroll<=bounds.width+1,'Breadcrumb wraps within Inspector');
 await nav.getByRole('button',{name:'Controls for Wrapped mirror',exact:true}).click();
 await nav.getByRole('button',{name:'Controls for Wrapped mirror',current:'page'}).waitFor();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Controls for Wrapped mirror');
 await nav.getByRole('button',{name:'Controls for Double mirror 1',exact:true}).click();
 await nav.getByRole('button',{name:'Controls for Double mirror 1',current:'page'}).waitFor();
 const scene=nav.getByRole('button',{name:'Scene controls',exact:true});await scene.focus();await page.keyboard.press('Enter');
 await nav.getByRole('button',{name:'Scene controls',current:'page'}).waitFor();
 assert.equal(await graphTab.count(),0);assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Scene controls');
 const after=(await call('status')).authoring;
 assert.equal(after.controlSequence,before.controlSequence);assert.deepEqual(after.controls,before.controls);assert.deepEqual(after.nodeControls,before.nodeControls);assert.equal(after.generation,before.generation);
 await page.screenshot({path:join(output,'scene-controls.png')});
 report.checks=['Nested leaf to both parents and Scene with Graph closed','Keyboard activation and focus retained','Control values and runtime unchanged by navigation','Shared headings14px; normal and narrow breadcrumb wrap'];assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error.stack??error);if(page)await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await client?.close();if(app)await app.close();if(child){child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});}if(report.pid){try{process.kill(report.pid,0);report.processExited=false;}catch{report.processExited=true;}}await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2));}

