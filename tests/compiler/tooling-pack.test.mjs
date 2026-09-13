import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,unlink,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {verifyDeclarationPack} from '../../packages/core/src/project/tooling.ts';

const root=fileURLToPath(new URL('../../',import.meta.url));
const dependencyRoot=process.env.LUX_COMPILER_DEPENDENCIES||resolve(root,'node_modules');
import * as builder from '../../scripts/prepare-project-tooling.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
// These exact authored lines are frozen before generation. No probe is executed.
const visual=(version,update='const n: number = frame.timeSeconds;')=>[
  "import { defineVisual } from '@lux/visual-sdk';",
  "import { Scene } from 'three/webgpu';",
  "import { float } from 'three/tsl';",
  "import { helper } from './helper.ts';",
  'export default defineVisual({',
  ...(version==='0.2.0'?["  controls: { speed: { type: 'number', label: 'Speed', default: 1, min: 0, max: 2 } },"]:[]),
  '  async create(context) {',
  '    const width: number = context.settings.width; const scene = new Scene(); const v = float(helper);',
  '    return {',
  `      update(frame) { ${update} },`,
  '      render(target) { const w: number = target.width; },',
  '      reset(seed) { const n: number = seed; }, dispose() {},',
  '    };',
  '  },',
  '});','',
].join('\n');
const fixtures=[
  {version:'0.1.0',name:'v1-positive',source:visual('0.1.0'),diagnostic:null},
  {version:'0.2.0',name:'v2-positive',source:visual('0.2.0','const speed: number = frame.controls.speed;'),diagnostic:null},
  {version:'0.2.0',name:'v2-key',source:visual('0.2.0','frame.controls.missing;'),diagnostic:{code:'TS2339',line:10,column:38}},
  {version:'0.2.0',name:'v2-type',source:visual('0.2.0','const speed: string = frame.controls.speed;'),diagnostic:{code:'TS2322',line:10,column:29}},
  {version:'0.1.0',name:'v1-frame-type',source:visual('0.1.0','const time: string = frame.timeSeconds;'),diagnostic:{code:'TS2322',line:9,column:29}},
  {version:'0.1.0',name:'v1-rejects-v2-controls',source:visual('0.2.0'),diagnostic:{code:'TS2353',line:6,column:3}},
  {version:'0.2.0',name:'v2-requires-controls',source:visual('0.1.0'),diagnostic:{code:'TS2741',line:5,column:29}},
];
async function trustedProjection(directory,version) {
  const dir=join(directory,'types');await mkdir(dir,{recursive:true});
  const selected=version==='0.1.0'?'index.ts':'sdk-v2.ts';
  const sdk=await readFile(join(root,'packages/visual-sdk/src',selected),'utf8');
  await writeFile(join(dir,'sdk.ts'),sdk.replace('../../runtime-contracts/src/index.ts','./shared.ts').replaceAll('../../runtime-contracts/src/parameters.mjs','./parameters.js'));
  await writeFile(join(dir,'shared.ts'),await readFile(join(root,'packages/runtime-contracts/src/index.ts')));
  if(version==='0.2.0')await writeFile(join(dir,'parameters.d.ts'),await readFile(join(root,'packages/runtime-contracts/src/parameters.d.mts')));
  return join(dir,'sdk.ts');
}
function expectDiagnostic(fixture,result) {
  assert.ifError(result.error);const text=result.stdout+result.stderr;
  if(!fixture.diagnostic)assert.equal(result.status,0,text);
  else {assert.notEqual(result.status,0);const d=fixture.diagnostic;assert.match(text,new RegExp(`visual.ts\\(${d.line},${d.column}\\): error ${d.code}:`),text);}
}
test('refuses an unavailable or mismatched installed compiler and preserves failed staging',async()=>{
  const dir=join(root,'dist/project-tooling',`invalid-${process.pid}-${Date.now()}`);await mkdir(join(dir,'dependencies/typescript'),{recursive:true});
  await writeFile(join(dir,'dependencies/typescript/package.json'),JSON.stringify({name:'typescript',version:'7.0.1'}));
  let failure;await assert.rejects(builder.buildDeclarationPack({sourceRoot:root,dependencyRoot:join(dir,'dependencies'),out:join(dir,'output')}),error=>{failure=error;return /version mismatch/.test(error.message);});
  assert.ok(JSON.parse(await readFile(join(failure.staging,'evidence/failure.json'))).message.includes('version mismatch'));
  await assert.rejects(readFile(join(dir,'output/pack.json')),{code:'ENOENT'});
});
test('bounds the metadata edge ledger before starting a compiler program',async()=>{
  const dir=join(root,'dist/project-tooling',`quota-${process.pid}-${Date.now()}`);await mkdir(join(dir,'payload/node_modules/demo'),{recursive:true});
  await writeFile(join(dir,'payload/node_modules/demo/package.json'),JSON.stringify({name:'demo',version:'1.0.0',exports:Object.fromEntries(Array.from({length:65537},(_,i)=>[`./entry${i}`,null]))}));
  await assert.rejects(builder.auditDeclarationPack({packRoot:join(dir,'payload'),dependencyRoot,evidenceRoot:join(dir,'evidence'),standardLibraries:[]}),/Audit ledger quota exceeded/);
  await assert.rejects(readFile(join(dir,'evidence/all-declarations-semantic.result.json')),{code:'ENOENT'});
});
test('rejects unaccounted zero-match wildcard branches before compiler coverage',async()=>{
  const cases=[
    {name:'unknown',pkg:{name:'demo',version:'1.0.0',exports:{'./review-unresolved/*':'./review-missing/*.js'}}},
    ...[
      ['condition',{default:'./examples/fonts/*'}],
      ['custom-condition',{browser:'./examples/fonts/*'}],
      ['target','./different/fonts/*'],
      ['multiple-stars','./examples/fonts/**'],
    ].map(([name,target])=>({name,pkg:{name:'@types/three',version:'0.186.0',exports:{'./examples/fonts/*':target}}})),
    {name:'version',pkg:{name:'@types/three',version:'0.186.1',exports:{'./examples/fonts/*':'./examples/fonts/*'}}},
  ];
  for(const fixture of cases) {
    const dir=join(root,'dist/project-tooling',`wildcard-${fixture.name}-${process.pid}-${Date.now()}`),packRoot=join(dir,'payload');
    const metadata=Buffer.from(JSON.stringify(fixture.pkg)),source=`node_modules/${fixture.pkg.name}/package.json`;
    await mkdir(dirname(join(packRoot,source)),{recursive:true});await writeFile(join(packRoot,source),metadata);
    await writeFile(join(packRoot,'provenance.json'),JSON.stringify({format:'lux-tooling-provenance',version:1,packages:[{name:fixture.pkg.name,version:fixture.pkg.version,metadataSha256:hash(metadata)}]}));
    const {default:getExePath}=await import(pathToFileURL(join(dependencyRoot,'typescript/lib/getExePath.js')));
    const standardLibraries=['lib.es5.d.ts','lib.decorators.d.ts','lib.decorators.legacy.d.ts'].map(name=>`typescript/lib/${name}`);
    await mkdir(join(packRoot,'typescript/lib'),{recursive:true});
    for(const file of standardLibraries)await writeFile(join(packRoot,file),await readFile(join(dirname(getExePath()),file.split('/').at(-1))));
    await assert.rejects(builder.auditDeclarationPack({packRoot,dependencyRoot,evidenceRoot:join(dir,'evidence'),standardLibraries}),/Incomplete wildcard coverage/);
    const inventory=JSON.parse(await readFile(join(dir,'evidence/metadata/wildcard-inventory.json')));
    assert.equal(inventory.length,1);assert.equal(inventory[0].classification,'incomplete');
    assert.equal(inventory[0].source,source);assert.equal(inventory[0].matchCount,0);
    await assert.rejects(readFile(join(dir,'evidence/all-declarations-semantic.result.json')),{code:'ENOENT'});
  }
});
test('builds reproducibly, checks paired SDK semantics and detects an otherwise unreached dependency', {timeout:240000},async()=>{
  const output=join(root,'dist/project-tooling',`test-${process.pid}-${Date.now()}`);await mkdir(output,{recursive:true});
  await writeFile(join(output,'fixtures.json'),JSON.stringify(fixtures,null,2));
  const {default:getExePath}=await import(pathToFileURL(join(dependencyRoot,'typescript/lib/getExePath.js')));
  const compiler=getExePath(), diagnostics=[];
  // Freeze and validate expected authored diagnostics against the actual worker
  // projection before generating any declarations. This pass uses installed libs.
  for(const fixture of fixtures) {
    const dir=join(output,'trusted-before-generation',fixture.name);await mkdir(dir,{recursive:true});
    const sdk=await trustedProjection(dir,fixture.version);
    await writeFile(join(dir,'visual.ts'),fixture.source);await writeFile(join(dir,'helper.ts'),'export const helper: number = 1;\n');
    await writeFile(join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2023',module:'ESNext',moduleResolution:'Bundler',strict:true,types:[],lib:['ES2023','DOM'],skipLibCheck:false,noEmit:true,allowImportingTsExtensions:true,paths:{'@lux/visual-sdk':[sdk],zod:[join(dependencyRoot,'zod/index.d.cts')],'three/webgpu':[join(dependencyRoot,'@types/three/build/three.webgpu.d.ts')],'three/tsl':[join(dependencyRoot,'@types/three/build/three.tsl.d.ts')]}},files:['visual.ts','helper.ts']}));
    const result=spawnSync(compiler,['-p',join(dir,'tsconfig.json'),'--pretty','false'],{cwd:dir,encoding:'utf8',windowsHide:true,maxBuffer:4194304});await writeFile(join(dir,'diagnostics.log'),result.stdout+result.stderr);expectDiagnostic(fixture,result);
  }
  const first=await builder.buildDeclarationPack({sourceRoot:root,dependencyRoot,out:join(output,'first')});
  const relocatedSource=join(output,'relocated-source');
  for(const file of ['packages/visual-sdk/package.json','packages/runtime-contracts/package.json','packages/visual-sdk/src/index.ts','packages/visual-sdk/src/sdk-v2.ts','packages/runtime-contracts/src/index.ts','packages/runtime-contracts/src/parameters.d.mts','packages/runtime-contracts/src/parameters.mjs']){await mkdir(dirname(join(relocatedSource,file)),{recursive:true});await writeFile(join(relocatedSource,file),await readFile(join(root,file)));}
  const second=await builder.buildDeclarationPack({sourceRoot:relocatedSource,dependencyRoot,out:join(output,'second')});
  assert.equal(first.declarationPackHash,second.declarationPackHash);
  const manifest=JSON.parse(await readFile(join(first.packRoot,'pack.json')));
  const files={};for(const f of manifest.files){files[f.path]=new Uint8Array(await readFile(join(first.packRoot,f.path)));assert.deepEqual(files[f.path],new Uint8Array(await readFile(join(second.packRoot,f.path))));}
  await verifyDeclarationPack(new Uint8Array(await readFile(join(first.packRoot,'pack.json'))),files,first.declarationPackHash);
  assert.equal(manifest.packages.length,11);
  assert.ok(manifest.files.length>1200);
  assert.equal(manifest.packages.find(p=>p.name==='fflate').version,'0.8.3');
  const provenance=JSON.parse(await readFile(join(first.packRoot,'provenance.json')));
  const expectedPackages={'typescript':'7.0.2','@typescript/typescript-win32-x64':'7.0.2','three':'0.186.0','@types/three':'0.186.0','zod':'3.25.76','@dimforge/rapier3d-compat':'0.12.0','@tweenjs/tween.js':'23.1.3','@types/stats.js':'0.17.4','@types/webxr':'0.5.24','fflate':'0.8.3','meshoptimizer':'1.1.1'};
  assert.deepEqual(Object.fromEntries(manifest.packages.map(p=>[p.name,p.version])),expectedPackages);
  const threePhysical=await realpath(join(dependencyRoot,'@types/three')),requireTypes=createRequire(join(threePhysical,'package.json'));
  const independentlyInventoried=[];
  for(const pkg of manifest.packages) {
    let physical;
    if(pkg.name==='@typescript/typescript-win32-x64')physical=dirname(dirname(compiler));
    else if(['typescript','three','@types/three','zod'].includes(pkg.name))physical=await realpath(join(dependencyRoot,pkg.name));
    else {try{physical=dirname(requireTypes.resolve(pkg.name+'/package.json'));}catch{let candidate=dirname(requireTypes.resolve(pkg.name));while(true){try{if(JSON.parse(await readFile(join(candidate,'package.json'))).name===pkg.name){physical=candidate;break;}}catch{}const parent=dirname(candidate);assert.notEqual(parent,candidate);candidate=parent;}}}
    const metadataBytes=await readFile(join(physical,'package.json'));
    assert.equal(provenance.packages.find(p=>p.name===pkg.name).metadataSha256,hash(metadataBytes));
    const declarationRoot=pkg.name==='@typescript/typescript-win32-x64'?join(physical,'lib'):physical;
    if(!['typescript','three'].includes(pkg.name))for(const relative of await readdir(declarationRoot,{recursive:true}))if(/\.d\.(ts|mts|cts)$/.test(relative)) {
      const path=pkg.name==='@typescript/typescript-win32-x64'?`typescript/lib/${relative}`:`node_modules/${pkg.name}/${relative.replaceAll('\\','/')}`;
      assert.ok(Object.hasOwn(files,path),`Missing installed declaration ${pkg.name}/${relative}`);
      assert.equal(hash(files[path]),hash(await readFile(join(declarationRoot,relative))),`Changed installed declaration ${path}`);independentlyInventoried.push(path);
    }
    for(const path of pkg.licensePaths)assert.equal(hash(files[path]),hash(await readFile(join(physical,path.split('/').at(-1)))));
  }
  await writeFile(join(output,'installed-declaration-inventory.json'),JSON.stringify(independentlyInventoried.sort(),null,2));
  const mesh=JSON.parse(await readFile(join(first.packRoot,'node_modules/meshoptimizer/package.json')));
  assert.deepEqual(mesh.exports['./decoder.cjs'],{require:{types:'./meshopt_decoder.d.ts',default:'./meshopt_decoder.cjs'}});
  const meshProvenance=provenance.packages.find(p=>p.name==='meshoptimizer');
  assert.notEqual(meshProvenance.metadataSha256,meshProvenance.transform.sha256);
  assert.equal(meshProvenance.transform.sha256,hash(await readFile(join(first.packRoot,'node_modules/meshoptimizer/package.json'))));
  for(const file of manifest.files)assert.ok(!/\.pnpm|[A-Za-z]:|\.(?:js|mjs|cjs|exe|dll|wasm|node)$/.test(file.path));
  await assert.rejects(builder.buildDeclarationPack({sourceRoot:root,dependencyRoot,out:join(output,'first')}),/nonempty/);
  for(const fixture of fixtures)for(const kind of ['emitted','trusted']) {
    const dir=join(output,'parity',fixture.name,kind);await mkdir(dir,{recursive:true});
    await writeFile(join(dir,'visual.ts'),fixture.source);await writeFile(join(dir,'helper.ts'),'export const helper: number = 1;\n');
    const sdk=kind==='emitted'?join(first.packRoot,'sdk',fixture.version,'index.d.ts'):await trustedProjection(dir,fixture.version);
    const cfg={compilerOptions:{target:'ES2023',module:'ESNext',moduleResolution:'Bundler',strict:true,types:[],skipLibCheck:false,noEmit:true,allowImportingTsExtensions:true,noLib:true,paths:{'@lux/visual-sdk':[sdk],zod:[join(first.packRoot,'node_modules/zod/index.d.cts')],'three/webgpu':[join(first.packRoot,'node_modules/@types/three/build/three.webgpu.d.ts')],'three/tsl':[join(first.packRoot,'node_modules/@types/three/build/three.tsl.d.ts')]}},files:['visual.ts','helper.ts',...first.standardLibraries.map(p=>join(first.packRoot,p))]};
    await writeFile(join(dir,'tsconfig.json'),JSON.stringify(cfg));
    const result=spawnSync(compiler,['-p',join(dir,'tsconfig.json'),'--pretty','false'],{cwd:dir,encoding:'utf8',windowsHide:true,maxBuffer:4194304});assert.ifError(result.error);
    const text=result.stdout+result.stderr;await writeFile(join(dir,'diagnostics.log'),text);
    expectDiagnostic(fixture,result);
    diagnostics.push({fixture:fixture.name,kind,status:result.status,expected:fixture.diagnostic});
  }
  await writeFile(join(output,'parity-results.json'),JSON.stringify(diagnostics,null,2));
  const parametersPath=join(first.packRoot,'sdk/0.2.0/parameters.d.ts'),parameters=await readFile(parametersPath,'utf8');
  const widened=parameters.replace('= { readonly [K in keyof C]: number };','= any;');assert.notEqual(widened,parameters);
  const provenanceBefore=hash(await readFile(join(first.packRoot,'provenance.json'))),widening=[];
  try {
    await writeFile(parametersPath,widened);
    for(const name of ['v2-key','v2-type'])for(const kind of ['emitted','trusted']) {
      const dir=join(output,'parity',name,kind),result=spawnSync(compiler,['-p',join(dir,'tsconfig.json'),'--pretty','false'],{cwd:dir,encoding:'utf8',windowsHide:true,maxBuffer:4194304});assert.ifError(result.error);
      await writeFile(join(dir,'widening-diagnostics.log'),result.stdout+result.stderr);
      if(kind==='emitted')assert.equal(result.status,0,result.stdout+result.stderr);else assert.notEqual(result.status,0);
      widening.push({name,kind,status:result.status});
    }
    assert.equal(hash(await readFile(join(first.packRoot,'provenance.json'))),provenanceBefore);
  } finally {await writeFile(parametersPath,parameters);}
  await writeFile(join(output,'widening-mutation.json'),JSON.stringify({provenanceBefore,originalHash:hash(parameters),widenedHash:hash(widened),results:widening},null,2));
  const audit=await builder.auditDeclarationPack({packRoot:first.packRoot,dependencyRoot,evidenceRoot:join(output,'audit-pass'),standardLibraries:first.standardLibraries});
  assert.equal(audit.declarations,manifest.files.filter(f=>/\.d\.(ts|mts|cts)$/.test(f.path)).length);assert.ok(audit.edges>1000);assert.ok(audit.metadataEdges>100);
  const wildcardInventory=JSON.parse(await readFile(join(output,'audit-pass/metadata/wildcard-inventory.json')));
  const threeWildcards=wildcardInventory.filter(row=>row.source==='node_modules/@types/three/package.json');
  assert.deepEqual(threeWildcards.map(row=>row.key).sort(),['./addons/*','./examples/fonts/*','./examples/jsm/*','./src/*']);
  const fonts=threeWildcards.find(row=>row.key==='./examples/fonts/*');
  assert.equal(fonts.target,'./examples/fonts/*');assert.deepEqual(fonts.conditions,[]);
  assert.equal(fonts.packageName,'@types/three');assert.equal(fonts.packageVersion,'0.186.0');
  assert.equal(fonts.classification,'runtime-only');assert.equal(fonts.matchCount,0);assert.match(fonts.reason,/font assets/);
  assert.equal(fonts.metadataSha256,provenance.packages.find(p=>p.name==='@types/three').metadataSha256);
  for(const row of threeWildcards.filter(row=>row!==fonts)){assert.equal(row.classification,'declaration-pattern');assert.ok(row.matchCount>0);}
  assert.equal(audit.metadataWildcards,wildcardInventory.length);assert.equal(audit.runtimeOnlyWildcards,1);
  const zodSource=wildcardInventory.find(row=>row.packageName==='zod'&&row.conditions.includes('@zod/source'));
  assert.equal(zodSource.packageVersion,'3.25.76');assert.equal(zodSource.key,'./v4/locales/*');assert.equal(zodSource.target,'./src/v4/locales/*');
  assert.deepEqual(zodSource.conditions,['@zod/source']);assert.equal(zodSource.classification,'inapplicable-condition');
  assert.equal(zodSource.applicable,false);assert.equal(zodSource.matchCount,0);assert.match(zodSource.reason,/Bundler/);
  const threeMetadataPath=join(first.packRoot,'node_modules/@types/three/package.json'),threeMetadata=await readFile(threeMetadataPath);
  const provenancePath=join(first.packRoot,'provenance.json'),originalProvenance=await readFile(provenancePath);
  for(const mutation of ['unknown','condition','custom-condition','version','target','provenance']) {
    const changed=JSON.parse(threeMetadata),changedProvenance=JSON.parse(originalProvenance);
    if(mutation==='unknown')changed.exports['./review-unresolved/*']='./review-missing/*.js';
    if(mutation==='condition')changed.exports['./examples/fonts/*']={default:'./examples/fonts/*'};
    if(mutation==='custom-condition')changed.exports['./examples/fonts/*']={browser:'./examples/fonts/*'};
    if(mutation==='version')changed.version='0.186.1';
    if(mutation==='target')changed.exports['./examples/fonts/*']='./review-missing/*';
    if(mutation==='provenance')changedProvenance.packages.find(p=>p.name==='@types/three').metadataSha256='0'.repeat(64);
    const dir=join(output,`audit-wildcard-${mutation}`);
    try {
      // Preserve exact original package bytes in the provenance-only case;
      // this distinguishes the provenance gate from package-byte validation.
      await writeFile(threeMetadataPath,mutation==='provenance'?threeMetadata:JSON.stringify(changed));
      await writeFile(provenancePath,mutation==='provenance'?JSON.stringify(changedProvenance):originalProvenance);
      await assert.rejects(builder.auditDeclarationPack({packRoot:first.packRoot,dependencyRoot,evidenceRoot:dir,standardLibraries:first.standardLibraries}),/Incomplete wildcard coverage/);
      const rows=JSON.parse(await readFile(join(dir,'metadata/wildcard-inventory.json')));
      assert.ok(rows.some(row=>row.classification==='incomplete'));
      if(mutation==='unknown'){const unknown=rows.find(row=>row.key==='./review-unresolved/*');assert.equal(unknown.target,'./review-missing/*.js');assert.equal(unknown.matchCount,0);assert.equal(unknown.classification,'incomplete');}
      await assert.rejects(readFile(join(dir,'all-declarations-semantic.result.json')),{code:'ENOENT'});
    } finally {await writeFile(threeMetadataPath,threeMetadata);await writeFile(provenancePath,originalProvenance);}
  }
  const zodMetadataPath=join(first.packRoot,'node_modules/zod/package.json'),zodMetadata=await readFile(zodMetadataPath);
  try {
    const changed=JSON.parse(zodMetadata);changed.exports['./v4/locales/*']['@zod/review-unknown']=changed.exports['./v4/locales/*']['@zod/source'];delete changed.exports['./v4/locales/*']['@zod/source'];
    await writeFile(zodMetadataPath,JSON.stringify(changed));
    await assert.rejects(builder.auditDeclarationPack({packRoot:first.packRoot,dependencyRoot,evidenceRoot:join(output,'audit-wildcard-zod-condition'),standardLibraries:first.standardLibraries}),/Incomplete wildcard coverage/);
    const rows=JSON.parse(await readFile(join(output,'audit-wildcard-zod-condition/metadata/wildcard-inventory.json')));
    assert.equal(rows.find(row=>row.conditions.includes('@zod/review-unknown')).classification,'incomplete');
  } finally {await writeFile(zodMetadataPath,zodMetadata);}
  const missing=join(first.packRoot,'node_modules/@dimforge/rapier3d-compat/math.d.ts');await unlink(missing);
  await builder.checkRepresentativePack({packRoot:first.packRoot,dependencyRoot,evidenceRoot:join(output,'mutation-representative'),standardLibraries:first.standardLibraries});
  await assert.rejects(builder.auditDeclarationPack({packRoot:first.packRoot,dependencyRoot,evidenceRoot:join(output,'audit-missing'),standardLibraries:first.standardLibraries}),error=>/rapier3d-compat/.test(error.message)&&/TS2307/.test(error.message)&&/math/.test(error.message));
  const rebuilt=await builder.buildDeclarationPack({sourceRoot:root,dependencyRoot,out:join(output,'restored')});assert.equal(rebuilt.declarationPackHash,second.declarationPackHash);
  // Authority/policy negatives use the existing compiler, never declaration aliases.
  const {compileVisual}=await import('../../apps/build-worker/src/compile.mjs');
  for(const [name,source] of [['wrong-pin',{sdkVersion:'0.2.1',entry:'main.ts',files:{'main.ts':visual('0.2.0')}}],['forbidden-import',{sdkVersion:'0.1.0',entry:'main.ts',files:{'main.ts':visual('0.1.0').replace("import { helper } from './helper.ts';","import { helper } from 'meshoptimizer';")}}]]) {
    const result=await compileVisual({source},{dependencyRoot,timeoutMs:30000});await writeFile(join(output,`${name}.json`),JSON.stringify(result));assert.equal(result.ok,false);assert.equal(result.code,'SOURCE_BOUNDARY_VIOLATION');
  }
  console.log(JSON.stringify({output,packHash:second.declarationPackHash,files:manifest.files.length,audit,compilerHash:hash(await readFile(compiler))}));
});
