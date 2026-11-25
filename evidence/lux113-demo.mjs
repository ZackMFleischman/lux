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

const root=resolve(import.meta.dirname,'..'),expected=process.argv[2];assert.match(expected??'',/^[a-f0-9]{40}$/);
const git=spawnSync('git',['-C',root,'-c','core.excludesFile=','-c','core.fsmonitor=false','-c',`safe.directory=${root.replaceAll('\\','/')}`,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true});assert.equal(git.status,0);assert.equal(git.stdout.trim(),expected);
const clean=spawnSync('git',['-C',root,'-c','core.excludesFile=','-c','core.fsmonitor=false','-c',`safe.directory=${root.replaceAll('\\','/')}`,'diff','HEAD','--exit-code'],{encoding:'utf8',windowsHide:true});assert.equal(clean.status,0,'QA tracked source must match the recorded commit');
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};delete env.ELECTRON_RUN_AS_NODE;const session=resolveStudioSession({workspace:root,env});
const output=join(root,'evidence','lux113',session.profile);await mkdir(output,{recursive:true});
const report={ok:false,commit:expected,root,profile:session.profile,endpointPath:session.endpointPath,checks:[],screenshots:[]};let app,client,page,lastStatus;
try{
 app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});page=await app.firstWindow();page.setDefaultTimeout(75000);report.pid=await app.evaluate(()=>process.pid);console.log(JSON.stringify({event:'started',pid:report.pid,profile:session.profile,root,output}));
 let endpoint;for(let i=0;i<100;i++){try{endpoint=JSON.parse(await readFile(session.endpointPath,'utf8'));if(endpoint.pid===report.pid)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.equal(endpoint.pid,report.pid);assert.equal(endpoint.workspace,root.toLowerCase());assert.equal(endpoint.profile,session.profile);report.endpoint={pid:endpoint.pid,workspace:endpoint.workspace,profile:endpoint.profile,sessionId:endpoint.sessionId};
 client=new Client({name:'lux113-qa',version:'1.0.0'});await client.connect(new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/studio-mcp.mjs')],cwd:root,env:{...env,LUX_STUDIO_SESSION_ID:endpoint.sessionId}}));
 const call=async(name,args={})=>{const result=await client.callTool({name:`lux.studio.${name}`,arguments:args},undefined,{timeout:75000});assert.equal(result.isError,undefined,JSON.stringify(result));return JSON.parse(result.content.find(row=>row.type==='text').text);};
 const status=async()=>lastStatus=await call('status');const waitFor=async(predicate,label)=>{const deadline=Date.now()+75000;while(Date.now()<deadline){const value=await status();if(predicate(value))return value;await new Promise(r=>setTimeout(r,250));}throw Error(`Timed out waiting for ${label}. Last status: ${JSON.stringify(lastStatus)}`);};
 const initial=await call('read');await call('build',{expectedDraftVersion:initial.draftVersion,source:prismaticCompositionSource()});await page.locator('.preview-surface canvas').waitFor();
 const capture=async name=>{const result=await client.callTool({name:'lux.studio.capture',arguments:{}},undefined,{timeout:75000});assert.equal(result.isError,undefined);const image=result.content.find(row=>row.type==='image');assert.ok(image?.data);const path=join(output,name);await writeFile(path,Buffer.from(image.data,'base64'));return {data:image.data,path};};
 const shot=async name=>{const path=join(output,name);await page.screenshot({path});report.screenshots.push(path);return path;};
 const noOverlap=async(a,b,label)=>{const x=await a.boundingBox(),y=await b.boundingBox();assert.ok(x&&y);assert.ok(x.x+x.width<=y.x||y.x+y.width<=x.x||x.y+x.height<=y.y||y.y+y.height<=x.y,label);};
 const before=await status();
 const sourceHeader=page.locator('.source-files-disclosure > summary');
 const inspector=page.locator('.inspector');
 const sourceBefore=await page.locator('.source-editing').boundingBox();
 await sourceHeader.focus();await sourceHeader.press('Enter');
 assert.equal(await page.locator('.source-files-disclosure').evaluate(node=>node.open),false);
 const sourceAfter=await page.locator('.source-editing').boundingBox();assert.ok(sourceAfter.height>sourceBefore.height,'Collapse recovers editor space');
 await shot('01-source-collapsed.png');
 await sourceHeader.press('Enter');assert.equal(await page.locator('.source-files-disclosure').evaluate(node=>node.open),true);
 for(const title of ['Performance','Runtime','Host output'])await inspector.locator('summary').filter({hasText:title}).click();
 await shot('02-all-expanded.png');
 const markers=await page.locator('.studio-disclosure > summary').evaluateAll(nodes=>nodes.map(node=>({display:getComputedStyle(node).display,font:getComputedStyle(node).fontSize,marker:getComputedStyle(node,'::marker').content,top:node.getBoundingClientRect().top,height:node.getBoundingClientRect().height})));
 assert.equal(markers.length,5);assert.ok(markers.every(row=>row.display==='list-item'&&row.font===markers[0].font));report.markers=markers;
 const controls=inspector.locator('summary').filter({hasText:'Controls'});await controls.focus();await controls.press('Enter');
 for(const title of ['Performance','Runtime','Host output'])await inspector.locator('summary').filter({hasText:title}).click();
 await shot('03-inspector-collapsed.png');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(820,700)); await page.waitForFunction(()=>window.innerWidth===820&&window.innerHeight===700); await page.waitForFunction(()=>document.documentElement.scrollWidth<=window.innerWidth,{},{timeout:3000}); await page.evaluate(()=>window.scrollTo(0,0)); report.narrowFrame=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollX,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth})); assert.equal(report.narrowFrame.scrollWidth,report.narrowFrame.clientWidth,'Narrow document must not overflow its layout viewport');
 await controls.press('Enter');
 await shot('04-narrow-controls.png');
 assert.equal(await inspector.locator('.controls-section').evaluate(node=>node.open),true);
 assert.equal(await inspector.getByText('LIVE',{exact:true}).isVisible(),true);
 await sourceHeader.click();await shot('05-narrow-source-collapsed.png');await sourceHeader.click();
 const after=await status();assert.equal(after.authoring.instanceId,before.authoring.instanceId);assert.equal(after.authoring.generation,before.authoring.generation);assert.equal(after.authoring.playback,before.authoring.playback);assert.deepEqual(after.authoring.controls,before.authoring.controls);
 report.checks=['Exact private source/endpoint/PID checked','Source keyboard collapse/expand recovers editor space','Shared native summary marker/font on all five disclosures','All Inspector sections expand/collapse; Controls defaults open and LIVE retained','Normal and narrow actual screenshots','Preview and control/playback state retained'];report.ok=true;
}catch(error){report.error=error.stack??String(error);report.lastStatus=lastStatus;if(page)await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await client?.close().catch(()=>{});if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}if(report.pid){try{process.kill(report.pid,0);report.processExited=false;report.ok=false;process.exitCode=1;}catch{report.processExited=true;}}await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
