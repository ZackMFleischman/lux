import assert from 'node:assert/strict';
import {appendFile,mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {decode} from 'fast-png';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';

// Run only after visual acceptance. A normal invocation explicitly publishes
// five Library entries and saves a new scene. --prepare-only never starts Studio
// or reads/writes the Library. Scripted QA is not native-input provenance.
const args=process.argv.slice(2),prepareOnly=args.length===1&&args[0]==='--prepare-only';
assert.ok(prepareOnly||(args.length>=2&&args.length<=3&&!args.some(arg=>arg.startsWith('--'))),
  'Usage: node scripts/publish-ornament-components.mjs <library-root> <persistent-scene-directory> [milestone-label]\nOr: node scripts/publish-ornament-components.mjs --prepare-only');
const root=resolve(import.meta.dirname,'..'),folder=join(root,'examples/components/wandering-tracers');
const label=prepareOnly?'Batch 1':args[2]??'Batch 1';
assert.match(label,/^[A-Za-z0-9][A-Za-z0-9 _-]{0,59}$/,'Use a short filename-safe milestone label');
const runId=new Date().toISOString().replaceAll(':','-').replaceAll('.','-')+'-'+randomUUID().slice(0,8);
const output=join(root,'artifacts/living-ornament/publication',runId);await mkdir(output,{recursive:true});
const parts=[
  {key:'regions',id:'909bf033-22df-4ccc-afdb-431b6a83f9d4',name:'Organic Regions',entry:'regions.ts',files:['regions.ts','ornament-regions.ts'],mountPath:'components/organic-regions',inspectLabel:'Organic Regions & Motion',controlId:'ornamentSize'},
  {key:'watercolor',id:'998130df-ca1f-4b58-9917-1ee7045275cb',name:'Animated Watercolor',entry:'watercolor.ts',files:['watercolor.ts','ornament-watercolor.ts'],mountPath:'components/animated-watercolor',inspectLabel:'Animated Watercolor',controlId:'ornamentSaturation'},
  {key:'boundary',id:'d5718a1e-de84-477c-8330-4633fd91df85',name:'Organic Boundary Ink',entry:'boundary.ts',files:['boundary.ts','ornament-boundary.ts'],mountPath:'components/organic-boundary-ink',inspectLabel:'Organic Boundary Ink',controlId:'ornamentWidth'},
  {key:'phrasing',id:'83a60efc-ec4b-4f94-a122-6d2b38b504ee',name:'Composition Phrasing',entry:'phrasing.ts',files:['phrasing.ts'],mountPath:'components/composition-phrasing',inspectLabel:'Composition Phrasing',controlId:'pace'},
  {key:'renderer',name:'Ornament Region Styles',description:'Combines independent organic regions, watercolor, boundary ink, and phrasing fields into a living ornament painting.',entry:'ornament-renderer.ts',files:['ornament-renderer.ts','ornament-packed-patterns.ts','ornament-line-patterns.ts','ornament-ribbon-patterns.ts'],mountPath:'components/ornament-region-styles',inspectLabel:'Ornament Region Styles'},
];
const digest=value=>createHash('sha256').update(value).digest('hex');
const sources={};
for(const part of parts)sources[part.key]={sdkVersion:'0.4.0',entry:part.entry,files:Object.fromEntries(await Promise.all(part.files.map(async file=>[file,await readFile(join(folder,file),'utf8')])))};
const entry='ornament-composition.ts',composition=await readFile(join(folder,entry),'utf8');
const localFiles={[entry]:composition};for(const source of Object.values(sources))for(const [file,text] of Object.entries(source.files)){assert.ok(!Object.hasOwn(localFiles,file)||localFiles[file]===text,'Conflicting source file '+file);localFiles[file]=text;}
const localSource={sdkVersion:'0.4.0',entry,files:localFiles};
let linkedComposition=composition;
for(const part of parts){const original=`'./${part.entry}'`;assert.equal(linkedComposition.split(original).length,2,'Expected exactly one composition import for '+part.entry);linkedComposition=linkedComposition.replace(original,`'./${part.mountPath}/${part.entry}'`);}
// The scene owns only wiring. Every implementation stays in its Library bundle.
const linkedSource={sdkVersion:'0.4.0',entry,files:{[entry]:linkedComposition}};
const report={ok:false,prepared:true,runId,output,label,sourceCommit:execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  sourceSha256:digest(JSON.stringify(localSource)),parts:[],checks:[],errors:[],
  provenance:'Isolated test-profile Studio and matching adapter. Scripted Playwright inspection; no native-input provenance claim.'};
await writeFile(join(output,'candidate-source.json'),JSON.stringify(localSource,null,2));
await writeFile(join(output,'publication-plan.json'),JSON.stringify({parts:parts.map(part=>({...part,sourceSha256:digest(JSON.stringify(sources[part.key]))})),linkedSource,sourceSha256:report.sourceSha256},null,2));
if(prepareOnly){await writeFile(join(output,'prepared.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,prepared:true,published:false,gpuRun:false}));process.exit(0);}

const libraryRoot=resolve(args[0]),sceneDirectory=resolve(args[1]);
assert.ok(isAbsolute(args[0])&&isAbsolute(args[1]),'Pass explicit absolute Library and persistent scene directories');
assert.ok((await stat(libraryRoot)).isDirectory(),'Library root must already exist');
assert.ok((await stat(sceneDirectory)).isDirectory(),'Persistent scene directory must already exist');
const sceneRelative=relative(join(root,'artifacts'),sceneDirectory);
assert.ok(sceneRelative.startsWith('..')||isAbsolute(sceneRelative),'Save the milestone outside test artifacts');
report.libraryRoot=libraryRoot;report.scenePath=join(sceneDirectory,`Living Ornament - ${label} - ${runId}.lux-scene`);
let app,page,child,call;
const saveReport=()=>writeFile(join(output,'result.json'),JSON.stringify(report,null,2));
async function ready(){
  for(let attempt=0;attempt<600;attempt++){
    try{const status=await call('status');if(status.authoring?.revisionId&&status.authoring?.frameId&&await page.getByRole('button',{name:'Build',exact:true}).isEnabled()){assert.equal(status.authoring.fault,null);return status.authoring;}}catch(error){if(attempt===599)throw error;}
    await page.waitForTimeout(100);
  }
  throw Error('Studio preview did not become ready within 60 seconds');
}
async function capture(label){
  const result=await call('capture'),bytes=Buffer.from(result.base64,'base64'),pixels=decode(bytes);
  await writeFile(join(output,label+'.png'),bytes);await writeFile(join(output,label+'-capture.json'),JSON.stringify(result.metadata,null,2));
  return {pixelSha256:digest(pixels.data),width:pixels.width,height:pixels.height,metadata:result.metadata};
}
async function pause(){const runtime=(await call('status')).authoring;assert.equal(runtime.fault,null);await call('playback',{instanceId:runtime.instanceId,expectedGeneration:runtime.generation,action:'pause'});return (await call('status')).authoring;}
async function assertLinks(current){
  assert.equal(current.libraryLinks.length,5,'Scene must retain five independent Library links');
  for(const part of report.parts){
    const link=current.libraryLinks.find(link=>link.componentId===part.id&&link.mountPath===part.mountPath);
    assert.equal(link?.resolvedRevision,part.revision,'Library changed during linked build: '+part.name);
    for(const [file,text] of Object.entries(sources[part.key].files))assert.equal(current.source.files[part.mountPath+'/'+file],text,'Resolved Library source differs: '+part.name+'/'+file);
  }
  assert.equal(current.source.files[entry],linkedComposition);
  assert.equal(Object.keys(current.source.files).length,1+parts.reduce((total,part)=>total+part.files.length,0),'Unexpected copied implementation in scene source');
}
try{
  const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath,LUX_STUDIO_LIBRARY_ROOT:libraryRoot};
  const session=resolveStudioSession({workspace:root,env});report.profile=session.profile;call=createStudioConnection(session,{timeoutMs:75000});
  app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});child=app.process();report.pid=child.pid;
  child.stderr?.on('data',data=>void appendFile(join(output,'stderr.log'),data));page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',error=>report.errors.push(error.stack??error.message));
  await ready();
  // Read every intended update before making any shared Library mutation.
  const catalog=await call('library.list'),previous={};
  for(const part of parts){
    let id=part.id;
    if(!id){const matches=catalog.filter(row=>row.name===part.name);assert.ok(matches.length<=1,'Ambiguous new renderer Library name');id=matches[0]?.id;}
    if(id){const stored=await call('library.read',{id});assert.ok(!stored.dependencies?.length,'Expected an independent leaf: '+part.name);assert.equal(stored.source.entry,part.entry,'Unexpected existing entry module for '+part.name);previous[part.key]=stored;}
  }
  await writeFile(join(output,'previous-library-revisions.json'),JSON.stringify(previous,null,2));
  let current=await call('read');await call('build',{source:localSource,expectedDraftVersion:current.draftVersion});let runtime=await ready();assert.equal(runtime.nodeControls.nodes.length,5);
  const sourceControls=runtime.controls;report.preflightCapture=await capture('preflight-local');report.checks.push('Exact captured local source builds a healthy five-node painting before publication');await saveReport();
  // Expected revisions guard every update. Never delete or rewrite history.
  // If a run stops partway, rerunning skips already-identical source snapshots.
  for(const part of parts){
    const before=previous[part.key],source=sources[part.key];let stored,action;
    if(before&&isDeepStrictEqual(before.source,source)){stored=before;action='unchanged';}
    else if(before){action='updated';stored=await call('library.update',{id:before.id,expectedRevision:before.revision,name:before.name,description:before.description,source});assert.equal(stored.revision,before.revision+1);}
    else{action='created';stored=await call('library.create',{name:part.name,description:part.description,source});assert.equal(stored.revision,1);}
    const published={key:part.key,id:stored.id,name:stored.name,revision:stored.revision,previousRevision:before?.revision,mountPath:part.mountPath,action};report.parts.push(published);await saveReport();
    const verified=await call('library.read',{id:stored.id,revision:stored.revision});assert.deepEqual(verified.source,source);assert.ok(!verified.dependencies?.length);
    if(before){const historical=await call('library.read',{id:before.id,revision:before.revision});assert.deepEqual(historical.source,before.source,'Historical Library source changed: '+part.name);}
  }
  report.checks.push('Five exact independent Library bundles verified; prior revisions remain readable and unchanged');await saveReport();
  current=await call('read');await call('build',{source:linkedSource,expectedDraftVersion:current.draftVersion,libraryLinks:report.parts.map(part=>({componentId:part.id,mountPath:part.mountPath}))});runtime=await ready();assert.equal(runtime.nodeControls.nodes.length,5);assert.deepEqual(runtime.controls,sourceControls);
  current=await call('read');await assertLinks(current);await writeFile(join(output,'resolved-source.json'),JSON.stringify(current.source,null,2));report.linkedCapture=await capture('linked-painting');
  await call('scene.save',{path:report.scenePath,expectedDraftVersion:current.draftVersion,overwrite:false});const savedBytes=await readFile(report.scenePath);report.savedSceneSha256=digest(savedBytes);
  const savedControls=structuredClone(runtime.controls),savedNodeControls=structuredClone(runtime.nodeControls.nodes);await pause();current=await call('read');
  await call('scene.open',{path:report.scenePath,expectedDraftVersion:current.draftVersion,discardDirty:false});runtime=await ready();assert.equal(runtime.nodeControls.nodes.length,5);assert.deepEqual(runtime.controls,savedControls);assert.deepEqual(runtime.nodeControls.nodes,savedNodeControls);await assertLinks(await call('read'));
  report.checks.push('New persistent milestone scene reopens with all five pinned links, exact source and saved control values');
  const graph=page.getByRole('region',{name:'Composition graph'});if(!await graph.isVisible()){await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('menuitem',{name:'Graph',exact:true}).click();}
  await graph.waitFor({state:'visible'});assert.equal(await graph.locator('.graph-node:not(.graph-scene-root)').count(),5);await graph.getByRole('button',{name:'Fit',exact:true}).click();
  for(const part of parts){
    const node=graph.locator('.graph-node').filter({has:page.getByText(part.inspectLabel,{exact:true})});assert.equal(await node.count(),1,'Published graph node must be selectable: '+part.inspectLabel);await node.click();assert.equal(await node.getAttribute('aria-pressed'),'true');
    if(part.controlId){const control=page.locator(`[data-control-id="${part.controlId}"]`);await control.waitFor({state:'visible'});await control.scrollIntoViewIfNeeded();}
    await page.screenshot({path:join(output,'controls-'+part.key+'.png')});
  }
  report.checks.push('Every Library node is selectable and producer-owned ornament controls appear in the Inspector');
  runtime=await pause();const accepted=runtime.revisionId,retained=await capture('reopened-paused');report.reopenedCapture=retained;
  current=await call('read');const invalid=structuredClone(current.source);invalid.files[entry]='invalid syntax !';await assert.rejects(()=>call('build',{source:invalid,expectedDraftVersion:current.draftVersion}));
  runtime=(await call('status')).authoring;assert.equal(runtime.revisionId,accepted);assert.equal(runtime.fault,null);assert.deepEqual(runtime.controls,savedControls);assert.equal(runtime.nodeControls.nodes.length,5);
  const afterInvalid=await capture('invalid-edit-retained');assert.equal(afterInvalid.pixelSha256,retained.pixelSha256,'Invalid edit changed paused accepted pixels');assert.equal(digest(await readFile(report.scenePath)),report.savedSceneSha256,'Invalid edit changed saved scene bytes');
  await page.screenshot({path:join(output,'invalid-edit-window.png')});report.checks.push('Invalid edit retains the accepted preview pixels, revision, controls and saved scene bytes');assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.failure=error.stack??String(error);process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});}
finally{
  await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});report.ownedProcess={pid:child?.pid,exitCode:child?.exitCode};await saveReport();console.log(JSON.stringify({output,ok:report.ok,scenePath:report.scenePath,parts:report.parts,checks:report.checks,failure:report.failure},null,2));
}
