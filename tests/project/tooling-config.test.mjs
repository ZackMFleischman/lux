import test from 'node:test';
import assert from 'node:assert/strict';
import { posix } from 'node:path';
import { createProjectEditorPlan, compareProjectEditorFiles, editorLimits, verifyDeclarationPack } from '../../packages/core/src/project/tooling.ts';
import { admitProjectMetadata } from '../../packages/core/src/project/contracts.ts';
import { model, inputFor, ids, local, fixtureText, bytes, hash, pinFor, canonical } from './resolver-fixtures.ts';

const key = ref => ref.kind === 'local' ? `local:${ref.componentId}` : `package:${ref.packageId}:${ref.exportId}`;
const json = value => bytes(JSON.stringify(value, null, 2) + '\n');
function packFixture() {
  const files = Object.fromEntries(['sdk/0.1.0/index.d.ts','sdk/0.2.0/index.d.ts','node_modules/@types/three/build/three.webgpu.d.ts','node_modules/@types/three/build/three.tsl.d.ts'].map(p=>[p,bytes('export {};\n')]));
  files['node_modules/@types/three/package.json']=bytes('{"name":"@types/three","version":"0.186.0"}');
  files['licenses/three/LICENSE']=bytes('Fixture only\n');
  const manifest={format:'lux-declaration-pack',version:1,typescriptVersion:'7.0.2',threeVersion:'0.186.0',threeTypesVersion:'0.186.0',sdkVariants:{'0.1.0':{declarationEntry:'sdk/0.1.0/index.d.ts',contractHash:'1'.repeat(64)},'0.2.0':{declarationEntry:'sdk/0.2.0/index.d.ts',contractHash:'2'.repeat(64)}},packages:[{name:'@types/three',version:'0.186.0',metadataPath:'node_modules/@types/three/package.json',licensePaths:['licenses/three/LICENSE']}],files:[]};
  return rebuild({files,manifest});
}
function rebuild(p) {
  p.manifest.files=Object.entries(p.files).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,b])=>({path,byteLength:b.length,sha256:hash(b)}));
  p.hash=hash(JSON.stringify(['lux-declaration-pack',1,p.manifest]));
  p.selection={sdkVariants:structuredClone(p.manifest.sdkVariants),typescriptVersion:'7.0.2',threeVersion:'0.186.0',threeTypesVersion:'0.186.0',declarationPackHash:p.hash,runtimeBuildHash:'9'.repeat(64)};
  return p;
}
function mixedModel() {
  const m=model();
  for(const i of [1,3]) Object.assign(m.components[i],{sdkVersion:'0.1.0',sourceVersion:1});
  Object.assign(m.components[3],{entry:'src/helper.ts',files:['src/helper.ts']});
  m.components[1].references=[local(ids.U)];
  const files={'src/old.ts':bytes(fixtureText('entry-v1').replace('./helper.ts','./shared.ts')),'src/modern.ts':bytes(fixtureText('entry-v2').replace('./helper.ts','./shared.ts')),'src/shared.ts':bytes(fixtureText('helper-valid')),'LICENSE.txt':bytes('Fixture only\n')};
  const def=(sdk,name)=>({kind:'code',sdkVersion:sdk,sourceVersion:sdk==='0.1.0'?1:2,entry:`src/${name}.ts`,files:[`src/${name}.ts`,'src/shared.ts'],references:[],assets:{}});
  const manifest={format:'lux-package',schemaVersion:1,packageId:'demo/mixed',version:'1.2.3',sdkRange:'0.1.0 || 0.2.0',exports:{old:def('0.1.0','old'),modern:def('0.2.0','modern')},files:Object.fromEntries(Object.entries(files).map(([p,b])=>[p,hash(b)])),assets:{},dependencies:{}};
  m.packages=[{manifest,files,pin:pinFor(manifest)}];
  m.components[0].references.push({kind:'package',packageId:'demo/mixed',exportId:'modern'});
  m.scenes[2].implementation={kind:'package',packageId:'demo/mixed',exportId:'old'};
  return m;
}
async function fixture(m=mixedModel(),p=packFixture()) {
  m.lock.toolchain=structuredClone(p.selection);
  const metadata=await admitProjectMetadata(inputFor(m).documents,p.selection);
  const pack=await verifyDeclarationPack(bytes(JSON.stringify(p.manifest)),p.files,p.hash);
  return {m,p,metadata,pack,selection:p.selection};
}
const create = f => createProjectEditorPlan(f.metadata,f.pack,f.selection);
function expectedConfig(configPath,sdk,origins,packHash) {
  const relative=p=>posix.relative(posix.dirname(configPath),p),prefix=`vendor/toolchain/${packHash}/`;
  return json({compilerOptions:{target:'ES2023',module:'ESNext',moduleResolution:'Bundler',strict:true,noEmit:true,allowImportingTsExtensions:true,types:[],lib:['ES2023','DOM'],skipLibCheck:false,paths:{'@lux/visual-sdk':[relative(`${prefix}sdk/${sdk}/index.d.ts`)],'three/webgpu':[relative(`${prefix}node_modules/@types/three/build/three.webgpu.d.ts`)],'three/tsl':[relative(`${prefix}node_modules/@types/three/build/three.tsl.d.ts`)]}},files:origins.map(relative).sort()});
}
test('all six mixed SDK contexts have exact independently constructed bytes, origins and identities',async()=>{
  const f=await fixture(),plan=await create(f),C=pinFor(f.m.packages[0].manifest).contentHash;
  assert.equal(C,'2875931077728a7b32459498550e4e7ff2f23cfca70bed9fb2e4bdbde0aada5f');
  const roots=[['components/a/tsconfig.json','0.2.0',['components/a/src/main.ts','components/helper/src/helper.ts',`libraries/${C}/src/modern.ts`,`libraries/${C}/src/shared.ts`]],['components/b/tsconfig.json','0.1.0',['components/b/src/main.ts','components/u/src/helper.ts']],['components/helper/tsconfig.json','0.2.0',['components/helper/src/helper.ts']],['components/u/tsconfig.json','0.1.0',['components/u/src/helper.ts']],[`vendor/editor/${f.p.hash}/packages/${C}/modern/tsconfig.json`,'0.2.0',[`libraries/${C}/src/modern.ts`,`libraries/${C}/src/shared.ts`]],[`vendor/editor/${f.p.hash}/packages/${C}/old/tsconfig.json`,'0.1.0',[`libraries/${C}/src/old.ts`,`libraries/${C}/src/shared.ts`]]];
  assert.equal(plan.definitionConfigs.length,6);assert.equal(plan.files.length,7);
  for(const [path,sdk,origins] of roots) {
    const file=plan.files.find(f=>f.path===path),config=plan.definitionConfigs.find(c=>c.configPath===path);
    assert.deepEqual(file.bytes,expectedConfig(path,sdk,origins,f.p.hash));assert.equal(file.sha256,hash(file.bytes));
    assert.deepEqual(config.origins.map(o=>o.projectPath),origins);assert.equal(config.sdkVersion,sdk);
    assert.equal(config.selection,path.startsWith('vendor/')?'explicit-package-context':'nearest-local');
    for(const p of JSON.parse(new TextDecoder().decode(file.bytes)).files) assert.ok(origins.includes(posix.normalize(posix.join(posix.dirname(path),p))));
  }
  assert.equal(hash(expectedConfig(roots[0][0],roots[0][1],roots[0][2],'a'.repeat(64))),'7bd04405d5fc6a0af0f100922e683387ab28d7103514504d7a966591b6e245af');
  assert.deepEqual(plan.files.find(f=>f.path==='tsconfig.json').bytes,json({files:[],references:roots.map(([path])=>({path})).sort((a,b)=>a.path<b.path?-1:1)}));
  const A=plan.definitionConfigs.find(c=>c.definition.componentId===ids.A);
  assert.deepEqual(A.origins.map(o=>o.owners.map(key)),[[`local:${ids.A}`],[`local:${ids.H}`],['package:demo/mixed:modern'],['package:demo/mixed:modern']]);
  const toolchainKey=hash(canonical(['lux-project-metadata',1,'lock',{schemaVersion:1,toolchain:f.selection,packages:{}}]));
  assert.equal(plan.planHash,hash(JSON.stringify(['lux-project-editor-plan',1,ids.project,toolchainKey,plan.definitionConfigs.map(c=>[key(c.definition),c.sdkVersion,c.configPath,c.entryPath,c.selection,c.origins.map(o=>[o.projectPath,o.owners.map(key)])]),plan.files.map(f=>[f.path,f.bytes.length,f.sha256])])));
});
test('metadata graph violations and structural forgeries never produce a partial plan',async()=>{
  for(const kind of ['mixed','extra','pin','collision','sdk','cycle','runtime']) {
    const f=await fixture(); f.metadata=structuredClone(f.metadata);
    if(kind==='mixed')f.metadata.components[ids.B].references=[local(ids.H)];
    if(kind==='extra')f.metadata.components.extra=f.metadata.components[ids.A];
    if(kind==='pin')f.metadata.lock.packages['demo/mixed'].manifestHash='0'.repeat(64);
    if(kind==='collision')f.metadata.project.components[ids.B]='components/a';
    if(kind==='sdk')f.metadata.components[ids.A].sdkVersion='0.3.0';
    if(kind==='cycle')f.metadata.components[ids.H].references=[local(ids.A)];
    if(kind==='runtime')f.selection.runtimeBuildHash='8'.repeat(64);
    await assert.rejects(create(f),{code:kind==='runtime'?'TOOLCHAIN_UNAVAILABLE':'PROJECT_INVALID'},kind);
  }
});
test('pack handles are reverified against supplied selection and required Three identity',async()=>{
  for(const kind of ['bytes','hash','handleHash','entry','identity','variant']) {
    const f=await fixture();
    if(kind==='bytes')f.pack.files['sdk/0.2.0/index.d.ts'][0]^=1;
    if(kind==='handleHash')f.pack={...f.pack,declarationPackHash:'0'.repeat(64)};
    if(kind==='hash') {f.selection.declarationPackHash='0'.repeat(64);f.metadata.lock.toolchain.declarationPackHash=f.selection.declarationPackHash;}
    if(kind==='entry') {delete f.p.files['node_modules/@types/three/build/three.tsl.d.ts'];rebuild(f.p);f.pack=await verifyDeclarationPack(bytes(JSON.stringify(f.p.manifest)),f.p.files,f.p.hash);f.selection=f.p.selection;f.metadata.lock.toolchain=structuredClone(f.selection);}
    if(kind==='identity') {f.p.manifest.packages[0].name='other';rebuild(f.p);f.pack=await verifyDeclarationPack(bytes(JSON.stringify(f.p.manifest)),f.p.files,f.p.hash);f.selection=f.p.selection;f.metadata.lock.toolchain=structuredClone(f.selection);}
    if(kind==='variant') {f.selection.sdkVariants['0.2.0'].contractHash='0'.repeat(64);f.metadata.lock.toolchain=structuredClone(f.selection);}
    await assert.rejects(create(f),{code:['bytes','hash','handleHash'].includes(kind)?'TOOLCHAIN_MODIFIED':'TOOLCHAIN_UNAVAILABLE'},kind);
  }
});
test('selection supports a nonempty SDK subset while every definition must remain covered',async()=>{
  const p=packFixture();delete p.selection.sdkVariants['0.1.0'];
  const f=await fixture(model(),p),plan=await create(f);
  assert.deepEqual(Object.keys(plan.toolchain.sdkVariants),['0.2.0']);
  const clone={...f.pack,manifest:structuredClone(f.pack.manifest),files:structuredClone(f.pack.files)};
  assert.equal((await createProjectEditorPlan(f.metadata,clone,f.selection)).planHash,plan.planHash);
  const mixed=await fixture();delete mixed.selection.sdkVariants['0.1.0'];mixed.metadata.lock.toolchain=structuredClone(mixed.selection);
  await assert.rejects(create(mixed),{code:'TOOLCHAIN_UNAVAILABLE'});
});
test('comparison preserves raw custom bytes and issues deterministic complete replacement proposals',async()=>{
  const plan=await create(await fixture()),observed=Object.fromEntries(plan.files.map(f=>[f.path,f.bytes.slice()]));
  const good=await compareProjectEditorFiles(plan,observed);assert.deepEqual(good.diagnostics,[]);assert.deepEqual(good.replacements,[]);
  delete observed['tsconfig.json'];observed['components/a/tsconfig.json']=bytes('// custom plugin\r\n{}');observed['components/b/tsconfig.json']=new Uint8Array();
  const before=structuredClone(observed),proposal=await compareProjectEditorFiles(plan,observed);assert.deepEqual(observed,before);assert.equal(proposal.replacements.length,3);
  for(const r of proposal.replacements){assert.deepEqual(r.bytes,plan.files.find(f=>f.path===r.path).bytes);assert.deepEqual(r.expect,Object.hasOwn(observed,r.path)?{exists:true,sha256:hash(observed[r.path])}:{exists:false});}
  const rows=proposal.diagnostics.map(d=>[d.path,d.actualSha256,d.expectedSha256]);assert.equal(proposal.proposalHash,hash(JSON.stringify(['lux-editor-repair-proposal',1,plan.planHash,rows])));
});
test('all inputs are captured before await and public byte mutation cannot modify private plan authority',async()=>{
  const f=await fixture(),expected=await create(f),pending=create(f);
  f.metadata.project.name='changed';f.metadata.components[ids.A].files[0]='changed.ts';f.selection.runtimeBuildHash='0'.repeat(64);f.pack.files['sdk/0.2.0/index.d.ts'].fill(0);
  const plan=await pending;assert.equal(plan.planHash,expected.planHash);
  const observed=Object.fromEntries(expected.files.map(f=>[f.path,f.bytes.slice()]));
  for(const file of plan.files)file.bytes.fill(0);
  const comparison=compareProjectEditorFiles(plan,observed);Object.values(observed).forEach(b=>b.fill(0));
  assert.deepEqual((await comparison).diagnostics,[]);
  const first=await compareProjectEditorFiles(plan,{});first.replacements.forEach(r=>r.bytes.fill(0));
  assert.deepEqual((await compareProjectEditorFiles(plan,{})).replacements[0].bytes,expected.files[0].bytes);
  await assert.rejects(compareProjectEditorFiles({...plan},{}),{code:'TOOLCHAIN_INVALID'});
});

test('comparison uses intrinsic bytes even with hostile typed array prototypes',async()=>{
  const plan=await create(await fixture()),observed=Object.fromEntries(plan.files.map(f=>[f.path,f.bytes.slice()]));
  let calls=0;
  const first=observed[plan.files[0].path],expected=first.slice();
  Object.setPrototypeOf(observed[plan.files[1].path],new Proxy(Uint8Array.prototype,{getPrototypeOf(){calls++;first.fill(0);return Object.prototype;},get(){calls++;throw Error('No caller property reads');}}));
  const proposal=await compareProjectEditorFiles(plan,observed);
  assert.equal(calls,0);assert.deepEqual(first,expected);assert.deepEqual(proposal.diagnostics,[]);
});
test('generated declaration targets admit 240 bytes and reject 241',async()=>{
  for(const extra of [0,1]) {
    const p=packFixture(),old=p.manifest.sdkVariants['0.2.0'].declarationEntry;
    const long='sdk/'+'a'.repeat(240-('vendor/toolchain/'+'a'.repeat(64)+'/sdk/.d.ts').length+extra)+'.d.ts';
    p.files[long]=p.files[old];delete p.files[old];p.manifest.sdkVariants['0.2.0'].declarationEntry=long;rebuild(p);
    const f=await fixture(model(),p),target='vendor/toolchain/'+p.hash+'/'+long;
    assert.equal(target.length,240+extra);
    if(extra)await assert.rejects(create(f),{code:'QUOTA_EXCEEDED',path:target});
    else assert.ok((await create(f)).files.some(f=>new TextDecoder().decode(f.bytes).includes(long)));
  }
});
function exportsModel(count,{nameLength=5,fileLength=8,fileCount=1}={}) {
  const m=model();m.project.scenes={};m.scenes=[];m.project.components={};m.components=[];
  const files=Object.fromEntries(Array.from({length:fileCount},(_,i)=>['src/'+`f${i}`.padEnd(fileLength,'x')+'.ts',bytes('export {};\n')]));
  const sourcePaths=Object.keys(files),definition={kind:'code',sdkVersion:'0.2.0',sourceVersion:2,entry:sourcePaths[0],files:sourcePaths,references:[],assets:{}};
  const manifest={format:'lux-package',schemaVersion:1,packageId:'demo/many',version:'1.0.0',sdkRange:'0.2.0',exports:Object.fromEntries(Array.from({length:count},(_,i)=>[`e${i}`.padEnd(nameLength,'x'),structuredClone(definition)])),files:Object.fromEntries(Object.entries(files).map(([p,b])=>[p,hash(b)])),assets:{},dependencies:{}};
  m.packages=[{manifest,files,pin:pinFor(manifest)}];return m;
}
test('empty, package-only, unused definitions, nested locals and shared-helper diamond preserve all contexts',async()=>{
  const empty=model();empty.scenes=[];empty.components=[];empty.project.scenes={};empty.project.components={};
  const zero=await create(await fixture(empty));assert.deepEqual(zero.definitionConfigs,[]);assert.deepEqual(zero.files[0].bytes,json({files:[],references:[]}));
  const packageOnly=await create(await fixture(exportsModel(2)));
  assert.equal(packageOnly.definitionConfigs.length,2);assert.ok(packageOnly.definitionConfigs.every(c=>c.selection==='explicit-package-context'));
  const m=model();m.components[0].references=[local(ids.B),local(ids.U)];m.components[3].references=[local(ids.H)];
  m.project.components[ids.A]='components/nested/deeper/a';
  const plan=await create(await fixture(m)),A=plan.definitionConfigs.find(c=>c.definition.componentId===ids.A);
  assert.equal(A.configPath,'components/nested/deeper/a/tsconfig.json');
  assert.deepEqual(A.origins.map(o=>o.projectPath),['components/b/src/main.ts','components/helper/src/helper.ts','components/nested/deeper/a/src/main.ts','components/u/src/main.ts']);
  assert.deepEqual(A.origins.find(o=>o.projectPath==='components/helper/src/helper.ts').owners,[local(ids.H)]);
});
test('descriptor-only admission rejects malformed shapes without invoking getters',async()=>{
  let calls=0;const get=()=>{calls++;throw Error('Getter ran');};
  for(const kind of ['metadataGetter','selectionGetter','packGetter','manifestGetter','bytesGetter','symbol','hidden','inherited','sparse','cycle']) {
    const f=await fixture();
    if(kind==='metadataGetter')Object.defineProperty(f.metadata,'project',{get,enumerable:true});
    if(kind==='selectionGetter')Object.defineProperty(f.selection,'runtimeBuildHash',{get,enumerable:true});
    if(kind==='packGetter')f.pack={...f.pack,get manifest(){return get();}};
    if(kind==='manifestGetter'){const manifest=structuredClone(f.pack.manifest);Object.defineProperty(manifest,'files',{get,enumerable:true});f.pack={...f.pack,manifest};}
    if(kind==='bytesGetter')f.pack={...f.pack,files:Object.defineProperty({},'sdk/0.2.0/index.d.ts',{get,enumerable:true})};
    if(kind==='symbol')f.metadata[Symbol('hidden')]=1;
    if(kind==='hidden')Object.defineProperty(f.metadata,'hidden',{value:1});
    if(kind==='inherited')Object.setPrototypeOf(f.metadata,{hidden:1});
    if(kind==='sparse')delete f.metadata.components[ids.A].files[0];
    if(kind==='cycle')f.metadata.components[ids.A].references.push(f.metadata);
    await assert.rejects(create(f),{code:kind==='cycle'?'QUOTA_EXCEEDED':'TOOLCHAIN_INVALID'},kind);
  }
  const plan=await create(await fixture());
  for(const observed of [Object.defineProperty({},'tsconfig.json',{get,enumerable:true}),{extra:bytes('x')},{'tsconfig.json':new Uint8Array(new SharedArrayBuffer(1))}])await assert.rejects(compareProjectEditorFiles(plan,observed),{code:'TOOLCHAIN_INVALID'});
  const detached=bytes('x');structuredClone(detached,{transfer:[detached.buffer]});await assert.rejects(compareProjectEditorFiles(plan,{'tsconfig.json':detached}),{code:'TOOLCHAIN_INVALID'});
  assert.equal(calls,0);
});
test('observation captures precede hashing and preserve equivalent JSON with CRLF',async()=>{
  const plan=await create(await fixture()),file=plan.files[0],custom=bytes(new TextDecoder().decode(file.bytes).replaceAll('\n','\r\n'));
  const result=await compareProjectEditorFiles(plan,{[file.path]:custom});
  assert.deepEqual(result.diagnostics.find(d=>d.path===file.path),{code:'EDITOR_CONFIG_MISMATCH',path:file.path,expectedSha256:file.sha256,actualSha256:hash(custom)});
  assert.equal(custom.at(-2),13);
  const observed=Object.fromEntries(plan.files.map(f=>[f.path,f.bytes.slice()]));
  const target=observed[file.path],before=target.slice();let descriptorCalls=0;
  const trapped=new Proxy(observed,{getOwnPropertyDescriptor(t,k){descriptorCalls++;if(k===plan.files.at(-1).path)target.fill(42);return Reflect.getOwnPropertyDescriptor(t,k);}});
  const pending=compareProjectEditorFiles(plan,trapped);target.set(before);
  const proposal=await pending;assert.equal(descriptorCalls,plan.files.length);
  assert.equal(proposal.diagnostics.find(d=>d.path===file.path).actualSha256,hash(new Uint8Array(target.length).fill(42)));
});
test('256 definitions and 257 configs pass; a 257th definition fails before output',async()=>{
  const plan=await create(await fixture(exportsModel(256)));
  assert.equal(plan.definitionConfigs.length,256);assert.equal(plan.files.length,257);
  const observed=Object.fromEntries(plan.files.map(f=>[f.path,f.bytes.slice()]));
  assert.deepEqual((await compareProjectEditorFiles(plan,observed)).diagnostics,[]);
  observed.extra=bytes('x');await assert.rejects(compareProjectEditorFiles(plan,observed),{code:'QUOTA_EXCEEDED'});
  await assert.rejects(create(await fixture(exportsModel(257))),{code:'QUOTA_EXCEEDED',path:'definitions'});
});
test('package export config case collisions are project relationship failures',async()=>{
  const m=exportsModel(2),defs=Object.values(m.packages[0].manifest.exports);
  m.packages[0].manifest.exports={eA:defs[0],ea:defs[1]};
  await assert.rejects(create(await fixture(m)),{code:'PROJECT_INVALID',path:'definitionConfigs'});
});
test('raw observation byte bounds accept equality and reject one extra byte',async()=>{
  const plan=await create(await fixture(exportsModel(32))),paths=plan.files.map(f=>f.path);
  const each=new Uint8Array(editorLimits.observedFileBytes),single=await compareProjectEditorFiles(plan,{[paths[0]]:each});
  assert.equal(single.diagnostics[0].actualSha256,hash(each));
  await assert.rejects(compareProjectEditorFiles(plan,{[paths[0]]:new Uint8Array(each.length+1)}),{code:'QUOTA_EXCEEDED',path:paths[0]});
  const full=Object.fromEntries(paths.slice(0,32).map(p=>[p,each]));
  assert.equal((await compareProjectEditorFiles(plan,full)).diagnostics.length,33);
  full[paths[32]]=new Uint8Array(1);await assert.rejects(compareProjectEditorFiles(plan,full),{code:'QUOTA_EXCEEDED',path:paths[32]});
});
function traversalModel(extra=0) {
  const m=exportsModel(104+extra),entries=Object.entries(m.packages[0].manifest.exports);
  const ref=i=>({kind:'package',packageId:'demo/many',exportId:entries[i][0]});
  for(let i=0;i<72;i++)entries[i][1].references=Array.from({length:71-i},(_,j)=>ref(i+j+1));
  for(const [start,end] of [[72,98],[98,104]])for(let i=start;i<end-1;i++)entries[i][1].references=[ref(i+1)];
  return m;
}
test('aggregate traversal admits exactly 65536 node/edge steps and rejects 65537',async()=>{
  assert.equal(72*73*74/6+26**2+6**2,editorLimits.traversalSteps);
  const exact=await create(await fixture(traversalModel()));assert.equal(exact.definitionConfigs.length,104);
  await assert.rejects(create(await fixture(traversalModel(1))),{code:'QUOTA_EXCEEDED',path:'references'});
});

function rootBytes(m,packHash='a'.repeat(64)) {
  const pkg=m.packages[0].manifest,C=pinFor(pkg).contentHash;
  return json({files:[],references:Object.keys(pkg.exports).map(e=>'vendor/editor/'+packHash+'/packages/'+C+'/'+e+'/tsconfig.json').sort().map(path=>({path}))});
}
function rootSizeModel(size) {
  const m=exportsModel(256),base=rootBytes(m).length;let remaining=size-base;
  assert.ok(remaining>=0 && remaining<=256*59);
  m.packages[0].manifest.exports=Object.fromEntries(Object.values(m.packages[0].manifest.exports).map((def,i)=>{const extra=Math.min(59,remaining);remaining-=extra;return [`e${i}`.padEnd(5+extra,'x'),def];}));
  assert.equal(remaining,0);assert.equal(rootBytes(m).length,size);return m;
}
test('root navigation config admits 64 KiB and rejects 64 KiB plus one byte',async()=>{
  const plan=await create(await fixture(rootSizeModel(editorLimits.configBytes)));
  assert.equal(plan.files.find(f=>f.path==='tsconfig.json').bytes.length,editorLimits.configBytes);
  await assert.rejects(create(await fixture(rootSizeModel(editorLimits.configBytes+1))),{code:'QUOTA_EXCEEDED',path:'tsconfig.json'});
});
function sharedOriginsModel(lengths) {
  const m=exportsModel(256,{fileCount:32}),pkg=m.packages[0];
  const files=Object.fromEntries(lengths.map((n,i)=>['src/'+`f${i}`.padEnd(n,'x')+'.ts',bytes('export {};\n')]));
  pkg.files=files;pkg.manifest.files=Object.fromEntries(Object.entries(files).map(([p,b])=>[p,hash(b)]));
  const names=Object.keys(pkg.manifest.exports),paths=Object.keys(files);
  for(const [i,def] of Object.values(pkg.manifest.exports).entries()) {
    def.entry=paths[0];def.files=i===0?paths:[paths[0]];
    def.references=i===0?[]:[{kind:'package',packageId:'demo/many',exportId:names[0]}];
  }
  return m;
}
function expectedTotalBytes(m) {
  const pkg=m.packages[0].manifest,C=pinFor(pkg).contentHash,origins=Object.keys(pkg.files).map(p=>'libraries/'+C+'/'+p);
  return rootBytes(m).length+Object.keys(pkg.exports).reduce((sum,e)=>sum+expectedConfig('vendor/editor/'+'a'.repeat(64)+'/packages/'+C+'/'+e+'/tsconfig.json','0.2.0',origins,'a'.repeat(64)).length,0);
}
test('origin rows reach 8192; source closure rejects the first possible additional row',async()=>{
  const m=sharedOriginsModel(Array(32).fill(8)),plan=await create(await fixture(m));
  assert.equal(plan.definitionConfigs.reduce((n,c)=>n+c.origins.length,0),editorLimits.originRows);
  assert.equal(plan.files.reduce((n,f)=>n+f.bytes.length,0),expectedTotalBytes(m));
  // Each definition is bounded to 32 files by existing admission. 256*32=8192;
  // a 33-file closure therefore reaches the owner's earlier rejection.
  m.packages[0].manifest.exports.e1xxx.files=['src/extra.ts'];m.packages[0].manifest.exports.e1xxx.entry='src/extra.ts';
  m.packages[0].files['src/extra.ts']=bytes('export {};\n');m.packages[0].manifest.files['src/extra.ts']=hash(m.packages[0].files['src/extra.ts']);
  const p=packFixture();m.lock.toolchain=p.selection;
  const raw=inputFor(m),metadata={project:m.project,scenes:{},components:{},assets:m.assets,lock:JSON.parse(new TextDecoder().decode(raw.documents['dependencies.lock.json'])),packages:{'demo/many':m.packages[0].manifest}};
  const pack=await verifyDeclarationPack(bytes(JSON.stringify(p.manifest)),p.files,p.hash);
  await assert.rejects(createProjectEditorPlan(metadata,pack,p.selection),{code:'QUOTA_EXCEEDED'});
});
function aggregateSizeModel(size) {
  const lengths=Array(32).fill(8),base=expectedTotalBytes(sharedOriginsModel(lengths));
  let whole=Math.floor((size-base)/256),remainder=(size-base)%256;
  for(let i=0;i<32;i++){const extra=Math.min(150,whole);lengths[i]+=extra;whole-=extra;}
  assert.equal(whole,0);const m=sharedOriginsModel(lengths);
  m.packages[0].manifest.exports=Object.fromEntries(Object.entries(m.packages[0].manifest.exports).map(([name,def],i)=>{
    const extra=i===0?0:Math.min(59,remainder);remainder-=extra;return [name+'x'.repeat(extra),def];
  }));
  assert.equal(remainder,0);assert.equal(expectedTotalBytes(m),size);return m;
}
test('aggregate output admits 2 MiB and rejects 2 MiB plus one byte',async()=>{
  const plan=await create(await fixture(aggregateSizeModel(editorLimits.totalConfigBytes)));
  assert.equal(plan.files.reduce((n,f)=>n+f.bytes.length,0),editorLimits.totalConfigBytes);
  await assert.rejects(create(await fixture(aggregateSizeModel(editorLimits.totalConfigBytes+1))),{code:'QUOTA_EXCEEDED',path:'tsconfig.json'});
});
