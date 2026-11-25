import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';

const root=resolve(import.meta.dirname,'..');
const installation=process.argv[2]?JSON.parse(await readFile(process.argv[2],'utf8')):null;
const output=join(root,'artifacts','control-count',`run-${Date.now()}`);
await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};
const session=resolveStudioSession({workspace:installation?.workspace??root,env});
const report={ok:false,source:installation?.sourceCommit??execFileSync('git',['-C',root,'-c',`safe.directory=${root}`,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),installation,profile:session.profile,checks:[],errors:[]};
let app,page,child;
try{
 app=await _electron.launch({executablePath:installation?.executable??installedElectron(root),args:installation?[]:[join(root,'apps/studio/dist/main.cjs')],cwd:installation?.directory??root,env,timeout:30000,chromiumSandbox:true});
 child=app.process();report.pid=child.pid;child.stderr?.on('data',data=>void appendFile(join(output,'stderr.log'),data));page=await app.firstWindow();page.setDefaultTimeout(20000);
 page.on('console',message=>void appendFile(join(output,'console.log'),message.type()+': '+message.text()+'\n'));
 page.on('pageerror',error=>report.errors.push(error.stack??error.message));
 const call=createStudioConnection(session,{timeoutMs:60000});
 let current;for(let i=0;i<100;i++){try{current=await call('read');if(current.source)break;}catch{}await page.waitForTimeout(100);}
 assert.ok(current?.source);
 current=await call('read');await call('scene.open',{path:join(root,'artifacts/control-count/run-1789529671344/component.lux-scene'),expectedDraftVersion:current.draftVersion,discardDirty:true}); console.log('opened'); await page.screenshot({path:join(output,'opened.png')});
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.failure=error.stack??String(error);process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});}
finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});report.exitCode=child.exitCode;}await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2));}
