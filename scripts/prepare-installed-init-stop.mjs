// CPU-only export and private registration. Never activates the fixture.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {exportResolume} from './export-resolume.mjs';import packageIO from '../packages/export/src/package.cjs';import registration from '../packages/export/src/register.cjs';
import {validateSource} from '../apps/build-worker/src/source-policy.mjs';import {canonicalControlSchemaJson} from '../packages/runtime-contracts/src/parameters.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(process.argv[2]??path.join(root,'artifacts/installed-init-stop'));
const host=path.resolve(process.argv[3]??path.join(root,'../installed-recovery-probe/native/build/Release/lux_standalone_host.exe'));
assert.ok(!fs.existsSync(path.join(out,'profile')),'Fresh output/profile required');fs.mkdirSync(out,{recursive:true});
for(const name of ['launch.mjs','inspect.mjs'])fs.copyFileSync(path.join(root,'scripts/installed-init-stop',name),path.join(out,name),fs.constants.COPYFILE_EXCL);
const hash=b=>createHash('sha256').update(b).digest('hex'),digest=file=>{const bytes=fs.readFileSync(file);return {path:path.resolve(file),bytes:bytes.length,sha256:hash(bytes)};};
assert.equal(digest(host).sha256,'faa93f4c267dd78b48304e691d4e2df6c0541c7c8b1f22b4ef192683fb2fab70','Reviewed existing native host required');
const fixturePath=path.join(root,'tests/fixtures/installed-sources/hung-init/visual.ts.txt');
const source=validateSource({sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':fs.readFileSync(fixturePath,'utf8')}}),sourceHash=hash(JSON.stringify(source));
const scene={format:'lux-scene',version:3,source,settings:{width:1920,height:1080,fps:60,seed:0},controls:{sourceHash,schema:[],schemaHash:hash(canonicalControlSchemaJson([])),values:{}}};
const scenePath=path.join(out,'scene.lux-scene');fs.writeFileSync(scenePath,JSON.stringify(scene,null,2)+'\n',{flag:'wx'});
assert.ok(fs.readFileSync(path.join(root,'apps/render-host/src/main.cjs'),'utf8').includes('lux-installed-init-hang-probe-v1'),'Emit the reviewed diagnostic main before export');
for(const [name,token] of [['main.cjs',"'armed'"],['compiled-output.html','window.goInitProbe'],['compiled-worker.js','init-probe-go']])assert.ok(fs.readFileSync(path.join(root,'apps/render-host/src',name),'utf8').includes(token),'Missing emitted handshake: '+name);
const exported=await exportResolume({scenePath,name:'Lux Init Stop QA',outputDirectory:path.join(out,'packages'),root});
const verified=packageIO.validatePackage(exported.path);assert.equal(verified.release.sourceHash,sourceHash);assert.deepEqual(verified.release.controls,[]);assert.deepEqual(verified.release.savedControls,{});
const local=path.join(out,'profile/local'),installRoot=path.join(local,'Lux/Installed'),installed=packageIO.installPackage(exported.path,installRoot);
const previous=process.env.LOCALAPPDATA;let registered;
try{process.env.LOCALAPPDATA=local;registered=registration.registerSource({installRoot,releaseId:exported.releaseId,pluginDirectory:path.join(out,'plugins')});}
finally{if(previous===undefined)delete process.env.LOCALAPPDATA;else process.env.LOCALAPPDATA=previous;}
const commit=execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const c={root,out,host,...exported,...installed,local,installRoot,registered,sourceHash,scenePath,final:path.join(out,'final.rgba'),hostLog:path.join(out,'receiver.jsonl'),workMs:10000,timeoutMs:30000,
 expected:{releaseId:exported.releaseId,revisionId:sourceHash},sourceCommit:commit,
 limits:['Persisted main QPC before GO permits create to independent stopped/zero-active-processes Job exit <=2seconds: conservative bound includes dispatch/persistence delay; entered marker confirms create reached.',
 'Normal10-second native draw loop after instantiate, unchanged30-second outer bound. No rendered image expected. Automatic retry policy unchanged.',
 'No actual Resolume, recovery image, full GPU resource cleanup or performance acceptance.']};
fs.writeFileSync(path.join(out,'configuration.json'),JSON.stringify(c,null,2)+'\n');
function files(dir){packageIO.noLinks(dir);return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const inputs=[...files(exported.path),...files(installed.runtimePath),...files(installed.releasePath),registered.dllPath,registered.sidecarPath,host,process.execPath,scenePath,fixturePath,
 ...['scripts/prepare-installed-init-stop.mjs','scripts/installed-init-stop/launch.mjs','scripts/installed-init-stop/inspect.mjs','apps/render-host/src/main.ts','apps/render-host/src/compiled-output.html','apps/studio/src/visual-worker.mjs','apps/studio/src/initialization-probe.mjs','tools/gpu-spike/native-init-stop-inspect.mjs','scripts/experiment-runner.mjs','scripts/experiment-job.ps1','scripts/experiment-job.cs'].map(n=>path.join(root,n)),
 ...['launch.mjs','inspect.mjs','configuration.json'].map(n=>path.join(out,n)),path.resolve(path.dirname(host),'../../../tools/gpu-spike/standalone_host.cc')];
const records=[...new Set(inputs)].map(digest),binary=r=>/\.(exe|dll|node|pak|bin|asar|dat)$/i.test(r.path);
const review={schema:1,preparedUtc:new Date().toISOString(),authorized:false,reviewer:null,expiresUtc:null,hostClosedConfirmed:false,
 hypothesis:'Persisted pre-GO QPC conservatively precedes the pinned create-loop; entered marker confirms execution, and independent supervisor force-stops that producer Job within2seconds of pre-GO while native callbacks continue.',
 executable:host,args:[registered.dllPath,c.final],sources:records.filter(r=>!binary(r)),binaries:records.filter(binary),limits:c.limits};
fs.writeFileSync(path.join(out,'review-request.json'),JSON.stringify(review,null,2)+'\n');console.log(JSON.stringify({review:path.join(out,'review-request.json'),...exported,sourceHash,sources:review.sources.length,binaries:review.binaries.length},null,2));
