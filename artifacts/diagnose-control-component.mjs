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
 page.on('console',message=>void appendFile(join(output,'console.log'),message.type()+': '+message.text()+'\n'));page.on('crash',()=>report.errors.push('renderer crashed'));
 page.on('pageerror',error=>report.errors.push(error.stack??error.message));
 const call=createStudioConnection(session,{timeoutMs:60000});
 let current;for(let i=0;i<100;i++){try{current=await call('read');if(current.source)break;}catch{}await page.waitForTimeout(100);}
 assert.ok(current?.source);
 let status; const controls=Object.fromEntries(Array.from({length:64},(_,i)=>[i?'control'+i:'intensity',{type:'number',label:`Component control ${i+1}`,group:`Motion ${Math.floor(i/8)+1}`,min:0,max:1,default:.5}]));
 let component=await readFile(join(root,'library/components/93a7215f-4df1-4e1e-9d34-3f7f0f27ad84/revisions/1/source/component.ts'),'utf8');
 component=component.replace(/    controls: \{[\s\S]*?\n    lifecycle:/,`    controls:${JSON.stringify(controls)},\n    controlDescriptions:${JSON.stringify(Object.fromEntries(Object.keys(controls).map(id=>[id,'Live value'])))},\n    lifecycle:`).replace('frame.controls.intensity','frame.controls.control63').replace('IcosahedronGeometry(1, 24)','IcosahedronGeometry(1, 4)');
 const nodeId='11111111-1111-4111-8111-111111111111',expose=Object.keys(controls).map(id=>({id,nodeId,controlId:id}));
 const composition=`import {defineComposition} from '@lux/visual-sdk';import ball from './ball.ts';export default defineComposition({definitions:{ball},nodes:[{id:'${nodeId}',definition:'ball'}],edges:[],output:{nodeId:'${nodeId}',portId:'image'},expose:${JSON.stringify(expose)}});`;
 current=await call('read');await call('build',{source:{sdkVersion:'0.4.0',entry:'composition.ts',files:{'composition.ts':composition,'ball.ts':component}},expectedDraftVersion:current.draftVersion});
 status=await call('status');assert.equal(status.authoring.controlSchema.length,64);assert.equal(status.authoring.nodeControls.nodes[0].schema.length,64);
 await call('playback',{instanceId:status.authoring.instanceId,expectedGeneration:status.authoring.generation,action:'pause'}); console.log('paused'); await writeFile(join(output,'dom.json'),JSON.stringify(await page.evaluate(()=>({visible:document.visibilityState,buttons:[...document.querySelectorAll('button')].filter(e=>e.textContent==='View').map(e=>({rect:e.getBoundingClientRect().toJSON(),parent:!!e.offsetParent})),groups:[...document.querySelectorAll('details.parameter-group')].map(e=>({open:e.open,text:e.querySelector('summary')?.textContent}))})),null,2)); console.log('dom captured'); await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('menuitem',{name:'Inspector',exact:true}).click();
 await page.getByRole('button',{name:'Animate Component control 64',exact:true}).click();await page.getByRole('button',{name:'Add LFO',exact:true}).click();
 for(let i=0;i<100;i++){status=await call('status');if(status.authoring.controlAnimations.some(row=>row.nodePath.length&&row.controlId==='control63'))break;await page.waitForTimeout(100);}
 assert.ok(status.authoring.controlAnimations.some(row=>row.nodePath.length&&row.controlId==='control63'));
 await page.screenshot({path:join(output,'component-64-controls.png')});
 report.checks.push('64-control component compiles and exposes64 aliases;late component control animates');
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.failure=error.stack??String(error);process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});}
finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});report.exitCode=child.exitCode;}await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2));}
