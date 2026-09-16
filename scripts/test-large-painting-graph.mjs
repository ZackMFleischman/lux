import assert from 'node:assert/strict';
import {appendFile,mkdir,mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {parse} from '@babel/parser';
import {decode} from 'fast-png';
import {_electron} from 'playwright';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';

// Explicit GPU run only. --prepare-only creates inspectable fixtures without
// starting Studio. This is scripted app QA, not native-input provenance evidence.
const args=process.argv.slice(2),prepareOnly=args.includes('--prepare-only');
assert.ok(args.every((arg,index)=>arg==='--prepare-only'||arg==='--approved-frame'||args[index-1]==='--approved-frame'),'Usage: node scripts/test-large-painting-graph.mjs [--prepare-only] [--approved-frame PNG]');
const root=resolve(import.meta.dirname,'..'),folder=join(root,'examples/components/wandering-tracers');
const approvedIndex=args.indexOf('--approved-frame');
assert.ok(approvedIndex===-1||args[approvedIndex+1],'--approved-frame requires a PNG path');
const approvedPath=resolve(approvedIndex<0?join(root,'artifacts/painting-extractions/tracer-before-18/frame.png'):args[approvedIndex+1]);
const output=join(root,'artifacts/living-ornament/limit-qa',`run-${Date.now()}`);
await mkdir(output,{recursive:true});
const seconds=18,relayCount=9,selectedRelayId='17000000-0000-4000-8000-000000000009',publicControl='relay9Scale';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=Object.fromEntries(await Promise.all((await readdir(folder)).filter(name=>name.endsWith('.ts')&&!name.endsWith('.test.ts')).map(async name=>[name,await readFile(join(folder,name),'utf8')])));
const original={sdkVersion:'0.4.0',entry:'painting-composition.ts',files};

// Inspect only literal root composition data. Never evaluate submitted modules.
const entry=files[original.entry],ast=parse(entry,{sourceType:'module',plugins:['typescript']});
const expression=ast.program.body.find(node=>node.type==='ExportDefaultDeclaration')?.declaration;
assert.equal(expression?.type,'CallExpression');
const declaration=expression.arguments[0];assert.equal(declaration.type,'ObjectExpression');
const properties=Object.fromEntries(declaration.properties.map(property=>{assert.equal(property.type,'ObjectProperty');return [property.key.name??property.key.value,property.value];}));
function literal(node){
  if(node.type==='StringLiteral'||node.type==='NumericLiteral'||node.type==='BooleanLiteral')return node.value;
  if(node.type==='ArrayExpression')return node.elements.map(literal);
  if(node.type==='ObjectExpression')return Object.fromEntries(node.properties.map(property=>{assert.equal(property.type,'ObjectProperty');assert.equal(property.computed,false);return [property.key.name??property.key.value,literal(property.value)];}));
  throw Error(`Unexpected root literal: ${node.type}`);
}
const originalNodes=literal(properties.nodes),originalEdges=literal(properties.edges),expose=literal(properties.expose);
assert.equal(originalNodes.length,8,'Fixture requires the original eight-node painting');
const hatchingId=originalNodes.find(node=>node.definition==='hatching')?.id,paintingId=originalNodes.find(node=>node.definition==='painting')?.id;
assert.ok(hatchingId&&paintingId);
const replacedEdge=originalEdges.find(edge=>edge.from.nodeId===hatchingId&&edge.to.nodeId===paintingId&&edge.to.portId==='hatching');
assert.ok(replacedEdge,'Missing original hatching-to-painting connection');
const relayNodes=Array.from({length:relayCount},(_,index)=>({id:`17000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,definition:`relay${index+1}`}));
const relayEdges=Array.from({length:relayCount+1},(_,index)=>({
  id:`17100000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,
  from:{nodeId:index===0?hatchingId:relayNodes[index-1].id,portId:'field'},
  to:{nodeId:index===relayCount?paintingId:relayNodes[index].id,portId:index===relayCount?'hatching':'field'},delay:'none',
}));
const large=structuredClone(original);
for(let index=1;index<=relayCount;index++){
  const port={type:{kind:'shader-field',version:1,abi:'lux/region-hatching/v1'},label:'Hatching',description:'Immutable regional hatching shader field'};
  const metadata={declarationVersion:1,key:`test/hatching-relay-${index}`,label:`Hatching Relay ${index}`,description:'QA relay that scales drawing coverage and retains the authored shader fragments.',tags:['qa'],inputs:{field:port},outputs:{field:port},controls:{scale:{type:'number',label:'Coverage scale',default:1,min:0,max:2,step:0.05}},controlDescriptions:{scale:'Multiply incoming hatching coverage. One preserves the painting; zero removes the regional hatching.'},lifecycle:{state:'stateless',reset:'seed'}};
  large.files[`qa-relay-${index}.ts`]=`import {defineComponent} from '@lux/visual-sdk';
export default defineComponent({metadata:${JSON.stringify(metadata)},async create(){let scale=1;return {
update(frame) { scale=frame.controls.scale; },
async evaluate(inputs,evaluation){const data=inputs.field.data;if(data.abi!=='lux/region-hatching/v1')throw Error('Unexpected hatching ABI');return {field:evaluation.shaderField('field',{version:1,abi:data.abi,fragments:data.fragments,values:{...data.values,coverage:data.values.coverage*scale}})};},
reset(){scale=1;},dispose(){}
};}});`;
}
const imports=ast.program.body.filter(node=>node.type==='ImportDeclaration').map(node=>entry.slice(node.start,node.end));
const definitionNames=properties.definitions.properties.map(property=>{assert.equal(property.value.type,'Identifier');return property.value.name;});
large.files[large.entry]=[...imports,...relayNodes.map((node,index)=>`import ${node.definition} from './qa-relay-${index+1}.ts';`),
  `export default defineComposition({label:'Living Painting — Seventeen Nodes',definitions:{${[...definitionNames,...relayNodes.map(node=>node.definition)].join(',')}},nodes:${JSON.stringify([...originalNodes,...relayNodes])},edges:${JSON.stringify([...originalEdges.filter(edge=>edge!==replacedEdge),...relayEdges])},output:${JSON.stringify(literal(properties.output))},expose:${JSON.stringify([...expose,{id:publicControl,nodeId:selectedRelayId,controlId:'scale'}])}});`,
].join('\n');
function freezeCheckpoint(source){
  const adapted=structuredClone(source);let updates=0,replayedGenerators=0;
  for(const [name,text] of Object.entries(adapted.files)){
    updates+=(text.match(/update\(frame\) \{/g)??[]).length;
    let code=text.replaceAll('update(frame) {',`update(frame) { frame = Object.freeze({...frame,timeSeconds:${seconds},deltaSeconds:0});`);
    if(code.includes('snapshot = stepTracerGenerator(generator, frame, frame.controls);')){
      replayedGenerators++;
      code=code.replace('snapshot = stepTracerGenerator(generator, frame, frame.controls);',`if(snapshot.paths.length===0){for(let testStep=0;testStep<=${Math.round(seconds*60)};testStep++){snapshot=stepTracerGenerator(generator,{timeSeconds:testStep/60,deltaSeconds:testStep===0?0:1/60},frame.controls);}}`);
    }
    adapted.files[name]=code;
  }
  assert.equal(replayedGenerators,1,'Expected one deterministic tracer replay');assert.ok(updates>=8,'Frozen adapter did not reach all eight original components');
  return adapted;
}
const baseline=freezeCheckpoint(original),candidate=freezeCheckpoint(large);
await writeFile(join(output,'baseline-source.json'),JSON.stringify(baseline,null,2));
await writeFile(join(output,'large-source.json'),JSON.stringify(candidate,null,2));
const report={ok:false,prepared:true,sourceCommit:execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  output,approvedPath,seconds,originalNodes:8,candidateNodes:17,relayCount,checks:[],captures:{},errors:[],
  provenance:'Scripted Playwright and Studio adapter QA. No native-input provenance claim. Test-only frozen scene time and deterministic 60Hz tracer replay; production source files unchanged.'};
if(prepareOnly){await writeFile(join(output,'prepared.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,prepared:true,gpuRun:false}));process.exit(0);}

let app,page,call,session,child;
function comparePixels(before,after){
  assert.equal(after.width,before.width,'Capture width changed');assert.equal(after.height,before.height,'Capture height changed');assert.equal(after.channels,before.channels,'Capture channels changed');
  let changedChannels=0,maxDelta=0;for(let i=0;i<before.data.length;i++){const delta=Math.abs(before.data[i]-after.data[i]);if(delta){changedChannels++;maxDelta=Math.max(maxDelta,delta);}}
  return {width:before.width,height:before.height,changedChannels,maxDelta,totalChannels:before.data.length};
}
async function ready(){
  for(let attempt=0;attempt<600;attempt++){
    try{const status=await call('status');if(status.authoring?.revisionId&&status.authoring?.frameId&&await page.getByRole('button',{name:'Build',exact:true}).isEnabled()){assert.equal(status.authoring.fault,null);return status.authoring;}}catch(error){if(attempt===599)throw error;}
    await page.waitForTimeout(100);
  }
  throw Error('Studio did not reach a healthy accepted preview within 60 seconds');
}
async function capture(label,controlValue){
  let previous;
  for(let attempt=0;attempt<12;attempt++){
    const result=await call('capture'),bytes=Buffer.from(result.base64,'base64'),pixels=decode(bytes);
    const digest=hash(pixels.data);
    if(previous?.digest===digest&&(controlValue===undefined||result.metadata.controls[publicControl]===controlValue)){
      await writeFile(join(output,label+'.png'),bytes);await writeFile(join(output,label+'-capture.json'),JSON.stringify(result.metadata,null,2));
      report.captures[label]={pixelSha256:digest,width:pixels.width,height:pixels.height,metadata:result.metadata};return pixels;
    }
    previous={digest};await page.waitForTimeout(250);
  }
  throw Error(`Frozen checkpoint did not settle: ${label}`);
}
async function build(source){const current=await call('read');await call('build',{source,expectedDraftVersion:current.draftVersion});return ready();}
function assertRuntime(runtime,count,scale){
  assert.equal(runtime.fault,null);assert.equal(runtime.nodeControls.nodes.length,count,'All executed component nodes must be present');
  if(scale!==undefined){assert.equal(runtime.controls[publicControl],scale);const node=runtime.nodeControls.nodes.find(node=>JSON.stringify(node.nodePath)===JSON.stringify([selectedRelayId]));assert.equal(node?.values.scale,scale);}
}
async function assertGraph(count){
  const graph=page.getByRole('region',{name:'Composition graph'});
  if(!await graph.isVisible()){await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('menuitem',{name:'Graph',exact:true}).click();}
  await graph.waitFor({state:'visible'});assert.equal(await graph.locator('.graph-node:not(.graph-scene-root)').count(),count);
  return graph;
}
try{
  const approved=decode(await readFile(approvedPath));report.approvedPixelSha256=hash(approved.data);
  const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};session=resolveStudioSession({workspace:root,env});call=createStudioConnection(session,{timeoutMs:75000});report.profile=session.profile;
  app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,timeout:30000,chromiumSandbox:true});
  child=app.process();report.pid=child.pid;child.stderr?.on('data',data=>void appendFile(join(output,'stderr.log'),data));page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',error=>report.errors.push(error.stack??error.message));
  await ready();let runtime=await build(baseline);assertRuntime(runtime,8);
  const before=await capture('baseline-eight');report.approvedComparison=comparePixels(approved,before);assert.equal(report.approvedComparison.changedChannels,0,'Eight-node painting differs from approved 18-second checkpoint');
  report.checks.push('Original eight-node painting matches the approved checkpoint pixel for pixel');
  runtime=await build(candidate);assertRuntime(runtime,17,1);
  const after=await capture('seventeen-default',1);report.defaultComparison=comparePixels(before,after);assert.equal(report.defaultComparison.changedChannels,0,'Nine unity relays changed the approved painting');
  report.checks.push('Seventeen-node painting builds and matches the original pixels at unity scale');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1920,1080));
  let graph=await assertGraph(17);await graph.getByRole('button',{name:'Fit',exact:true}).click();
  const extra=graph.locator('.graph-node').filter({has:page.getByText('Hatching Relay 9',{exact:true})});assert.equal(await extra.count(),1);await extra.click();assert.equal(await extra.getAttribute('aria-pressed'),'true');
  await page.screenshot({path:join(output,'seventeen-full-graph.png')});await graph.screenshot({path:join(output,'seventeen-graph.png')});
  const canvas=await graph.locator('.graph-viewport').boundingBox(),boxes=await graph.locator('.graph-node').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect();return {label:node.textContent,x:box.x,y:box.y,width:box.width,height:box.height};}));
  assert.ok(canvas);assert.ok(boxes.every(box=>box.x>=canvas.x-1&&box.x+box.width<=canvas.x+canvas.width+1&&box.y>=canvas.y-1&&box.y+box.height<=canvas.y+canvas.height+1),'Fit must show every node within the graph viewport');report.graphLayout={viewport:canvas,nodes:boxes};
  report.checks.push('All seventeen graph nodes fit; relay nine is selected');
  runtime=(await call('status')).authoring;
  await call('parameters',{instanceId:runtime.instanceId,expectedGeneration:runtime.generation,expectedRevisionId:runtime.revisionId,expectedControlSchemaHash:runtime.controlSchemaHash,values:{[publicControl]:0}});
  runtime=(await call('status')).authoring;assertRuntime(runtime,17,0);const changed=await capture('seventeen-coverage-zero',0);report.controlComparison=comparePixels(after,changed);assert.ok(report.controlComparison.changedChannels>1000,'Relay coverage control must produce a meaningful image change');
  await page.screenshot({path:join(output,'relay-control-zero.png')});report.checks.push('Relay nine coverage scale changes the rendered painting');
  const sceneDirectory=await mkdtemp(join(tmpdir(),'lux-large-painting-')),scenePath=join(sceneDirectory,'seventeen-nodes.lux-scene');report.scenePath=scenePath;
  let current=await call('read');await call('scene.save',{path:scenePath,expectedDraftVersion:current.draftVersion,overwrite:false});const savedBytes=await readFile(scenePath);report.savedSceneSha256=hash(savedBytes);
  runtime=(await call('status')).authoring;await call('playback',{instanceId:runtime.instanceId,expectedGeneration:runtime.generation,action:'pause'});
  current=await call('read');await call('scene.open',{path:scenePath,expectedDraftVersion:current.draftVersion,discardDirty:false});runtime=await ready();assertRuntime(runtime,17,0);assert.deepEqual((await call('read')).source,candidate);await assertGraph(17);
  const reopened=await capture('seventeen-reopened',0);report.reopenComparison=comparePixels(changed,reopened);assert.equal(report.reopenComparison.changedChannels,0,'Reopen changed saved control output');
  graph=await assertGraph(17);await graph.getByRole('button',{name:'Fit',exact:true}).click();await page.screenshot({path:join(output,'seventeen-reopened-window.png')});report.checks.push('Save/reopen retains all seventeen nodes, exact source, relay scale and rendered pixels');
  current=await call('read');const accepted=(await call('status')).authoring,invalid=structuredClone(current.source);invalid.files[invalid.entry]='invalid syntax !';
  await assert.rejects(()=>call('build',{source:invalid,expectedDraftVersion:current.draftVersion}));runtime=(await call('status')).authoring;
  assert.equal(runtime.revisionId,accepted.revisionId);assertRuntime(runtime,17,0);const retained=await capture('after-invalid-edit',0);report.invalidComparison=comparePixels(reopened,retained);assert.equal(report.invalidComparison.changedChannels,0);assert.equal(hash(await readFile(scenePath)),report.savedSceneSha256,'Invalid edit modified the saved scene');
  await page.screenshot({path:join(output,'invalid-edit-preserved.png')});report.checks.push('Invalid edit retains the accepted revision, seventeen-node preview, controls, pixels and saved scene bytes');
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.failure=error.stack??String(error);process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});}
finally{
  await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});report.ownedProcess={pid:child?.pid,exitCode:child?.exitCode};
  await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,ok:report.ok,checks:report.checks,failure:report.failure}));
}
