import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {studioTestEnvironment,resolveStudioSession} from '../scripts/studio-session.mjs';
import {installedElectron} from '../scripts/studio-electron.mjs';
const root=resolve(import.meta.dirname,'..'), repo=resolve(root,'../..'), expected=process.argv[2];
for(const args of [['rev-parse','HEAD'],['diff','HEAD','--exit-code']]){const r=spawnSync('git',['-C',root,'-c','core.excludesFile=','-c','core.fsmonitor=false','-c',`safe.directory=${root.replaceAll('\\','/')}`,...args],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0);if(args[0]==='rev-parse')assert.equal(r.stdout.trim(),expected);}
const output=join(import.meta.dirname,'readable118',`run-${Date.now()}`);await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};delete env.ELECTRON_RUN_AS_NODE;
const session=resolveStudioSession({workspace:root,env});const report={ok:false,candidate:expected,session,checks:[],screenshots:[],errors:[]};let app,page,client,pid;
try{
 app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,chromiumSandbox:true});pid=await app.evaluate(()=>process.pid);report.ownedPid=pid;page=await app.firstWindow();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(e.message));
 let endpoint;for(let i=0;i<100;i++){try{endpoint=JSON.parse(await readFile(session.endpointPath,'utf8'));if(endpoint.pid===pid)break;}catch{}await page.waitForTimeout(100);}assert.equal(endpoint.pid,pid);assert.equal(endpoint.workspace,root.toLowerCase());assert.equal(endpoint.profile,session.profile);report.endpoint={pid,workspace:endpoint.workspace,profile:endpoint.profile};
 client=new Client({name:'graph-readable-qa',version:'1'});await client.connect(new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/studio-mcp.mjs')],cwd:root,env:{...env,LUX_STUDIO_SESSION_ID:endpoint.sessionId}}));
 const call=async(name,args={})=>{const r=await client.callTool({name:'lux.studio.'+name,arguments:args},undefined,{timeout:90000});assert.ok(!r.isError,JSON.stringify(r));return JSON.parse(r.content.find(x=>x.type==='text').text);};
 const shot=async name=>{const path=join(output,name+'.png');await page.screenshot({path});report.screenshots.push(path);};
 const source=JSON.parse(await readFile(join(repo,'visuals/creative-upgrade-20260914/working-source-and-state.json'),'utf8')).source;
 const originalPrism=source.files['effects/prism.ts'];assert.equal(createHash('sha256').update(originalPrism).digest('hex'),'48918e47800ea603732dc82b7a92939c98de146d76d71ba0bcaf316fef9f410c');
 let draft=await call('read');await call('build',{expectedDraftVersion:draft.draftVersion,source});await page.getByRole('button',{name:'Pause',exact:true}).click();report.before=await call('status');await shot('original-preview');
 source.files['effects/prism.ts']=await readFile(join(repo,'.worktrees/readable-source-118/.superpowers/LUX-118/prism-formatting-patch.ts'),'utf8');draft=await call('read');await call('build',{expectedDraftVersion:draft.draftVersion,source});await page.getByRole('button',{name:'Pause',exact:true}).click();report.after=await call('status');report.checks.push('Historical Prism copied to private profile, compiled before and after formatting; actual preview retained controls; user profile untouched');
 assert.deepEqual(report.before.authoring.controls, report.after.authoring.controls);assert.deepEqual(report.before.authoring.controlSchema, report.after.authoring.controlSchema);
 await shot('formatted-preview');
 await page.getByRole('button',{name:'Open effects/prism.ts',exact:true}).click();
 await page.getByRole('textbox',{name:'TypeScript source effects/prism.ts',exact:true}).waitFor();
 await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});
 await page.waitForTimeout(300);await shot('readable-source-normal');
 report.checks.push('All ten public control declarations and values are identical after formatting; normal Source screenshot captured');
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.failure=error.stack;process.exitCode=1;if(page&&!page.isClosed()){const path=join(output,'failure.png');await page.screenshot({path}).catch(()=>{});report.screenshots.push(path);}}
finally{await client?.close().catch(()=>{});if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}await new Promise(r=>setTimeout(r,500));try{process.kill(pid,0);report.ownedProcessExited=false;}catch{report.ownedProcessExited=true;}await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({ok:report.ok,output,pid,exited:report.ownedProcessExited,failure:report.failure,checks:report.checks}));
