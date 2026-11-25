import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {_electron} from 'playwright';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {installedElectron} from '../scripts/studio-electron.mjs';
import {resolveStudioSession,studioTestEnvironment} from '../scripts/studio-session.mjs';
import {prismaticCompositionSource} from '../tests/studio/fixtures/prismatic-composition/source-bundle.mjs';
const root=resolve(import.meta.dirname,'..'),expected=process.argv[2];
assert.match(expected??'',/^[a-f0-9]{40}$/);
const git=spawnSync('git',['-C',root,'-c',`safe.directory=${root.replaceAll('\\','/')}`,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true});assert.equal(git.status,0);assert.equal(git.stdout.trim(),expected);
const clean=spawnSync('git',['-C',root,'-c',`safe.directory=${root.replaceAll('\\','/')}`,'diff','HEAD','--exit-code'],{encoding:'utf8',windowsHide:true});assert.equal(clean.status,0,'QA source must match the recorded commit');
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};delete env.ELECTRON_RUN_AS_NODE;
const session=resolveStudioSession({workspace:root,env}),output=join(root,'evidence','graph',session.profile);await mkdir(output,{recursive:true});
const report={ok:false,commit:expected,root,profile:session.profile,checks:[],screenshots:[]};let app,client,page;
try{
 app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000});page=await app.firstWindow();page.setDefaultTimeout(20000);
 report.pid=await app.evaluate(()=>process.pid);
 let endpoint;for(let i=0;i<100;i++){try{endpoint=JSON.parse(await readFile(session.endpointPath,'utf8'));if(endpoint.pid===report.pid)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.equal(endpoint.pid,report.pid);assert.equal(endpoint.workspace,root.toLowerCase());assert.equal(endpoint.profile,session.profile);
 client=new Client({name:'graph-view-qa',version:'1.0.0'});await client.connect(new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/studio-mcp.mjs')],cwd:root,env:{...env,LUX_STUDIO_SESSION_ID:endpoint.sessionId}}));
 const call=async(name,args={})=>{const result=await client.callTool({name:`lux.studio.${name}`,arguments:args},undefined,{timeout:75000});assert.equal(result.isError,undefined,JSON.stringify(result));return JSON.parse(result.content.find(row=>row.type==='text').text);};
 const initial=await call('read'),built=await call('build',{expectedDraftVersion:initial.draftVersion,source:prismaticCompositionSource()});const before=built.status.authoring;
 const capture=async(name)=>{const result=await client.callTool({name:'lux.studio.capture',arguments:{}});assert.equal(result.isError,undefined);const image=result.content.find(row=>row.type==='image');assert.ok(image?.data);await writeFile(join(output,name),Buffer.from(image.data,'base64'));return image.data;};
 const firstImage=await capture('preview-before.png');
 await page.getByText('View',{exact:true}).click();await page.getByRole('button',{name:'Open Graph',exact:true}).click();
 await page.getByLabel('Move panel',{exact:true}).selectOption('graph');await page.getByLabel('Relative to',{exact:true}).selectOption('preview');await page.getByRole('button',{name:'Move bottom',exact:true}).click();
 await page.getByText('View',{exact:true}).click();await page.getByRole('button',{name:'Fit',exact:true}).click();
 const nodes=page.locator('.graph-node');assert.equal(await nodes.count(),3);assert.equal(await page.locator('.graph-wires path').count(),2);assert.equal(await page.locator('.graph-final-output').count(),1);
 await nodes.nth(1).click();const number=page.locator('.inspector input[type="number"]');await number.fill('8');await number.press('Enter');
 for(let i=0;i<40&&(await call('status')).authoring.controls.segmentsA!==8;i++)await new Promise(r=>setTimeout(r,100));
 const changedImage=await capture('preview-after.png');assert.notEqual(changedImage,firstImage,'Node adjustment must change the real image');
 const after=(await call('status')).authoring;assert.equal(after.controls.segmentsA,8);assert.equal(after.controls.segmentsB,before.controls.segmentsB);assert.equal(after.generation,before.generation);assert.equal(after.playback,before.playback);
 const shot=async(name)=>{const path=join(output,name);await page.screenshot({path});report.screenshots.push(path);};await shot('selected-first-effect.png');
 await nodes.nth(2).focus();await page.keyboard.press('Enter');assert.equal(await number.inputValue(),String(before.controls.segmentsB));await shot('keyboard-second-effect.png');
 const view=await page.locator('.graph-content').getAttribute('style');await page.getByText('View',{exact:true}).click();await page.getByLabel('Move panel',{exact:true}).selectOption('graph');await page.getByRole('button',{name:'Close selected panel',exact:true}).click();await page.getByRole('button',{name:'Open Graph',exact:true}).click();await page.getByText('View',{exact:true}).click();
 assert.equal(await nodes.nth(2).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.graph-content').getAttribute('style'),view);
 const final=(await call('status')).authoring;assert.deepEqual(final.controls,after.controls);assert.equal(final.generation,before.generation);
 report.previewChanged=true;report.controls=final.controls;report.checks=['Accepted composition has three nodes, two connections and one final output.','Selected effect changed to8; repeated instance kept its prior value.','Keyboard selection showed the other instance controls.','Selection and view persisted after Graph close/reopen.','Selection and control edits retained runtime generation and playback.'];report.ok=true;
}catch(error){report.error=error.stack??String(error);if(page)await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await client?.close().catch(()=>{});if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}if(report.pid){try{process.kill(report.pid,0);report.processExited=false;report.ok=false;process.exitCode=1;}catch{report.processExited=true;}}await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
