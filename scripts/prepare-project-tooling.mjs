// Trusted distribution build only. Inputs are operator-selected installations;
// this module never loads project configuration or executes authored code.
import {readFile,writeFile,mkdir,readdir,lstat,realpath,mkdtemp,rename,rmdir,unlink} from 'node:fs/promises';
import {join,resolve,dirname,relative,basename,posix} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {parseDeclarationPackManifest,verifyDeclarationPack,toolingLimits} from '../packages/core/src/project/tooling.ts';

const sha=b=>createHash('sha256').update(b).digest('hex');
const slash=p=>p.replaceAll('\\','/');
const declaration=p=>/\.d\.(?:ts|mts|cts)$/.test(p);
const compare=(a,b)=>a<b?-1:a>b?1:0;
function appendBounded(rows,row) {if(rows.length>=65536)throw Error('Audit ledger quota exceeded');rows.push(row);}
const options={target:'ES2023',module:'ESNext',moduleResolution:'Bundler',strict:true,types:[],skipLibCheck:false,noEmit:true,allowImportingTsExtensions:true};
const pins={typescript:'7.0.2','@typescript/typescript-win32-x64':'7.0.2',three:'0.186.0','@types/three':'0.186.0',zod:'3.25.76','@dimforge/rapier3d-compat':'0.12.0','@tweenjs/tween.js':'23.1.3','@types/stats.js':'0.17.4','@types/webxr':'0.5.24',fflate:'0.8.3',meshoptimizer:'1.1.1'};
const notices=name=>name==='typescript'||name==='@typescript/typescript-win32-x64'?['LICENSE','NOTICE.txt']:name==='meshoptimizer'?['LICENSE.md']:['LICENSE'];
async function regularFile(path,encoding) {
  const stat=await lstat(path);
  if(!stat.isFile()||stat.isSymbolicLink())throw Error(`Unsupported trusted input object: ${path}`);
  if(stat.size>toolingLimits.fileBytes)throw Error(`Trusted declaration/metadata file exceeds byte ceiling: ${path}`);
  return readFile(path,encoding);
}
function inside(root,path) {const rel=relative(resolve(root),resolve(path));if(rel==='..'||rel.startsWith('..'+(process.platform==='win32'?'\\':'/'))||/^[A-Za-z]:|^\//.test(slash(rel)))throw Error(`Resolution escapes staging: ${path}`);return slash(rel);}
async function put(root,path,bytes) {inside(root,join(root,path));await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),bytes);}
async function walk(root) {
  const result=[];
  async function visit(path='') {for(const entry of await readdir(join(root,path),{withFileTypes:true})) {
    const name=path?`${path}/${entry.name}`:entry.name,stat=await lstat(join(root,name));
    if(stat.isSymbolicLink())throw Error(`Symlink in trusted payload source: ${name}`);
    if(stat.isDirectory())await visit(name);
    else if(stat.isFile())result.push(name);else throw Error(`Unsupported filesystem object: ${name}`);
  }}
  await visit();return result.sort(compare);
}
async function compilerAt(dependencyRoot) {
  const metadata=JSON.parse(await regularFile(join(dependencyRoot,'typescript/package.json')));if(metadata.name!=='typescript'||metadata.version!==pins.typescript)throw Error('Pinned typescript version mismatch');
  const {default:getExePath}=await import(pathToFileURL(join(dependencyRoot,'typescript/lib/getExePath.js')));
  const executable=getExePath(),root=dirname(dirname(executable));
  const platform=JSON.parse(await regularFile(join(root,'package.json')));if(platform.name!=='@typescript/typescript-win32-x64'||platform.version!==pins[platform.name])throw Error('Pinned native compiler version/platform mismatch');
  return {executable,root};
}
async function run(compiler,config,evidenceRoot,label,extra=[]) {
  await mkdir(evidenceRoot,{recursive:true});const configPath=join(evidenceRoot,`${label}.json`);await writeFile(configPath,JSON.stringify(config));
  const argv=['-p',configPath,'--pretty','false',...extra],result=spawnSync(compiler,argv,{cwd:evidenceRoot,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:67108864});
  const text=(result.stdout||'')+(result.stderr||'');await writeFile(join(evidenceRoot,`${label}.log`),text);
  await writeFile(join(evidenceRoot,`${label}.result.json`),JSON.stringify({executable:compiler,argv,status:result.status,error:result.error?.message}));
  if(result.error)throw Error(`Compiler ${label}: ${result.error.message}`);return {status:result.status,text};
}
function assertPass(result,label){if(result.status!==0)throw Error(`${label} failed:\n${result.text.slice(0,16000)}`);}
function paths(packRoot,version='0.2.0') {return {'@lux/visual-sdk':[join(packRoot,'sdk',version,'index.d.ts')],zod:[join(packRoot,'node_modules/zod/index.d.cts')],'three/webgpu':[join(packRoot,'node_modules/@types/three/build/three.webgpu.d.ts')],'three/tsl':[join(packRoot,'node_modules/@types/three/build/three.tsl.d.ts')]};}
function config(packRoot,standardLibraries,files,extra={}) {return {compilerOptions:{...options,noLib:true,paths:paths(packRoot),...extra},files:[...standardLibraries.map(p=>join(packRoot,p)),...files]};}
function resolutionLedger(text,allowedRoots) {
  const ledger=[];let current;
  for(const line of text.split(/\r?\n/)) {
    let m=line.match(/^======== Resolving (module|type reference directive) '([^']+)'(?: from|, containing file) '([^']+)'/);
    if(m)current={kind:m[1],specifier:m[2],source:m[3],conditions:[]};
    m=line.match(/Resolving in .* mode with conditions (.*)\./);if(m&&current)current.conditions=[...m[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
    m=line.match(/^======== (?:Module name|Type reference directive) '[^']+' was successfully resolved to '([^']+)'/);
    if(m) {if(!current)throw Error('Unsupported resolution trace record');if(!allowedRoots.some(root=>{try{inside(root,m[1]);return true;}catch{return false;}}))throw Error(`Successful outside resolution: ${m[1]}`);ledger.push({...current,target:m[1]});current=undefined;}
    if(/^======== (?:Module name|Type reference directive) '[^']+' was not resolved/.test(line)&&current){ledger.push({...current,target:null});current=undefined;}
  }
  if(ledger.length>65536)throw Error('Resolution ledger quota exceeded');return ledger;
}
async function checkedProgram(compiler,cfg,evidenceRoot,label,roots) {
  const semantic=await run(compiler,cfg,evidenceRoot,`${label}-semantic`);assertPass(semantic,label);
  const list=await run(compiler,cfg,evidenceRoot,`${label}-list`,['--listFilesOnly']);assertPass(list,`${label} inventory`);
  for(const p of list.text.trim().split(/\r?\n/))if(p&&!roots.some(root=>{try{inside(root,p);return true;}catch{return false;}}))throw Error(`Listed outside declaration: ${p}`);
  const trace=await run(compiler,cfg,evidenceRoot,`${label}-trace`,['--traceResolution']);assertPass(trace,`${label} resolution`);
  return resolutionLedger(trace.text,roots);
}
export async function checkRepresentativePack({packRoot,dependencyRoot,evidenceRoot,standardLibraries}) {
  const {executable}=await compilerAt(dependencyRoot);await mkdir(evidenceRoot,{recursive:true});
  const ledger=[];
  for(const version of ['0.1.0','0.2.0']) {
    const file=join(evidenceRoot,`probe-${version}.ts`);
    await writeFile(file,`import { defineVisual } from '@lux/visual-sdk';\nimport { Scene } from 'three/webgpu';\nimport { float } from 'three/tsl';\nexport default defineVisual({${version==='0.2.0'?"controls:{speed:{type:'number',label:'Speed',default:1,min:0,max:2}},":''}async create(context){const s=new Scene();const n=float(context.settings.width);return {update(frame){const t:number=frame.timeSeconds;},render(){},reset(){},dispose(){}};}});\n`);
    ledger.push(...await checkedProgram(executable,config(packRoot,standardLibraries,[file],{paths:paths(packRoot,version)}),evidenceRoot,`probe-${version}`,[packRoot,evidenceRoot]));
  }
  await writeFile(join(evidenceRoot,'representative-ledger.json'),JSON.stringify(ledger,null,2));return ledger;
}

async function references(dependencyRoot,packRoot,files) {
  const {parse}=await import(pathToFileURL(join(dependencyRoot,'@babel/parser/lib/index.js')));const edges=[];
  for(const file of files) {
    const text=await readFile(join(packRoot,file),'utf8');
    const ast=parse(text,{sourceType:'unambiguous',plugins:[['typescript',{dts:true}]],errorRecovery:true});
    // Babel's scope checker rejects legal TS standard-library declaration
    // merging (Iterator's value and type). Native TypeScript remains semantic
    // authority; every other parse error makes edge coverage incomplete.
    if(ast.errors.some(error=>error.reasonCode!=='VarRedeclaration'))throw Error(`Unsupported declaration syntax: ${file}: ${ast.errors.map(e=>e.message).join('; ')}`);
    const stack=[ast.program];
    while(stack.length) {const n=stack.pop();if(!n||typeof n!=='object')continue;
      let specifier;
      if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(n.type))specifier=n.source?.value;
      if(n.type==='TSImportType')specifier=n.argument?.value;
      if(n.type==='TSExternalModuleReference')specifier=n.expression?.value;
      if(specifier!==undefined) {if(typeof specifier!=='string')throw Error(`Unsupported import form: ${file}`);appendBounded(edges,{source:file,kind:'module',specifier,line:n.loc.start.line});}
      for(const [key,value]of Object.entries(n))if(!['loc','comments','tokens','extra'].includes(key)){if(Array.isArray(value))stack.push(...value);else if(value&&typeof value==='object')stack.push(value);}
    }
    for(const comment of ast.comments)if(/<reference\b/.test(comment.value)) {
      const m=comment.value.match(/<reference\s+(path|types|lib)\s*=\s*["']([^"']+)["']/);
      if(m)appendBounded(edges,{source:file,kind:m[1],specifier:m[2],line:comment.loc.start.line});
      else if(!/<reference\s+no-default-lib\s*=/.test(comment.value))throw Error(`Unsupported reference form: ${file}:${comment.loc.start.line}`);
    }
  }
  if(edges.length>65536)throw Error('Declaration edge quota exceeded');return edges;
}
// Metadata tests exercise each published declaration subpath in both normal
// Bundler modes. Runtime-only and custom non-Bundler conditions are inventoried
// but never executed. Original metadata bytes remain in the payload.
async function metadataProbes(packRoot,files,evidenceRoot) {
  const ledger=[],probes=[];
  for(const file of files.filter(p=>p.endsWith('/package.json')&&p.startsWith('node_modules/'))) {
    const pkg=JSON.parse(await readFile(join(packRoot,file),'utf8')),base=posix.dirname(file);
    const candidates=files.filter(p=>p.startsWith(base+'/')&&declaration(p)).map(p=>p.slice(base.length+1));
    if(!pkg.name)continue;
    const packageName=pkg.name.startsWith('@types/')?pkg.name.slice(7):pkg.name;
    for(const field of ['types','typings'])if(pkg[field]) {
      const target=posix.normalize(posix.join(base,pkg[field]));if(!files.includes(target))throw Error(`Missing metadata edge ${file} ${field} -> ${target}`);
      appendBounded(ledger,{source:file,field,conditions:['types'],target});
    }
    if(pkg.typesVersions||pkg.imports)throw Error(`Unsupported metadata resolution form in ${file}: typesVersions/imports`);
    const exports=pkg.exports;
    if(!exports){if(pkg.types||pkg.typings)appendBounded(probes,{specifier:packageName,source:file,modes:packageName==='webxr'?['types']:['import','require']});continue;}
    const entries=typeof exports==='string'||Object.keys(exports).every(k=>!k.startsWith('.'))?{'.':exports}:exports;
    function leaves(value,conditions=[]) {if(typeof value==='string')return [{target:value,conditions}];if(value===null)return [{target:null,conditions}];if(!value||Array.isArray(value)||typeof value!=='object')throw Error(`Unsupported export target in ${file}`);return Object.entries(value).flatMap(([k,v])=>leaves(v,[...conditions,k]));}
    for(const [key,value]of Object.entries(entries)) {
      const targets=leaves(value),subpaths=new Set();
      for(const item of targets) {
        const applicable=item.conditions.every(c=>['types','import','require','default'].includes(c));
        if(item.target===null){appendBounded(ledger,{source:file,field:`exports.${key}`,conditions:item.conditions,target:null,applicable});continue;}
        if(!item.target.startsWith('./'))throw Error(`Unsupported nonrelative package target: ${file}`);
        if(!applicable){appendBounded(ledger,{source:file,field:`exports.${key}`,conditions:item.conditions,target:item.target,applicable:false});continue;}
        if(item.target.endsWith('.json')){const target=posix.normalize(posix.join(base,item.target));if(!files.includes(target))throw Error(`Missing metadata JSON target: ${target}`);appendBounded(ledger,{source:file,field:`exports.${key}`,conditions:item.conditions,target,applicable:true});continue;}
        if(item.target.includes('*')) {
          if((item.target.match(/\*/g)||[]).length!==1||(key.match(/\*/g)||[]).length!==1)throw Error(`Unsupported wildcard ${file}`);
          const [prefix,suffix]=item.target.slice(2).split('*');
          for(const candidate of candidates)for(const alias of new Set([candidate,candidate.replace(/\.d\.ts$/,'.js').replace(/\.d\.mts$/,'.mjs').replace(/\.d\.cts$/,'.cjs')])) {
            if(alias.startsWith(prefix)&&alias.endsWith(suffix)){const capture=alias.slice(prefix.length,suffix? -suffix.length:undefined);subpaths.add(key.replace('*',capture));appendBounded(ledger,{source:file,field:`exports.${key}`,conditions:item.conditions,target:posix.join(base,candidate),applicable:true,capture});}
          }
        } else {subpaths.add(key);appendBounded(ledger,{source:file,field:`exports.${key}`,conditions:item.conditions,target:item.target,applicable:true});}
      }
      const modes=['import','require'].filter(mode=>targets.some(t=>t.conditions.every(c=>['types','default',mode].includes(c))));
      for(const subpath of subpaths)appendBounded(probes,{specifier:subpath==='.'?packageName:packageName+subpath.slice(1),source:file,modes});
    }
  }
  await mkdir(evidenceRoot,{recursive:true});
  // Unique files preserve exact metadata-origin attribution for native tracing.
  const probeRoot=await mkdtemp(join(packRoot,'.audit-')),probeFiles=[];
  for(const mode of ['import','require','types']) {
    const path=join(probeRoot,`metadata-${mode}.ts`);let text='';let index=0;
    for(const probe of probes)if(probe.modes.includes(mode)){text+=mode==='types'?`/// <reference types=${JSON.stringify(probe.specifier)} />\n`:`export type Target${index++} = typeof import(${JSON.stringify(probe.specifier)}, { with: { "resolution-mode": "${mode}" } });\n`;probe[mode]=path;}
    await writeFile(path,text);await writeFile(join(evidenceRoot,`metadata-${mode}.ts`),text);probeFiles.push(path);
  }
  return {ledger,probes,probeFiles,probeRoot};
}
export async function auditDeclarationPack({packRoot,dependencyRoot,evidenceRoot,standardLibraries}) {
  await mkdir(evidenceRoot,{recursive:true});const files=await walk(packRoot),decls=files.filter(declaration),edges=await references(dependencyRoot,packRoot,decls);
  const {executable}=await compilerAt(dependencyRoot);
  const metadata=await metadataProbes(packRoot,files,join(evidenceRoot,'metadata'));
  const roots=decls.filter(p=>!p.startsWith('typescript/lib/')).map(p=>join(packRoot,p));
  let ledger;
  try {ledger=await checkedProgram(executable,config(packRoot,standardLibraries,[...roots,...metadata.probeFiles]),evidenceRoot,'all-declarations',[packRoot,evidenceRoot]);}
  catch(error){await writeFile(join(evidenceRoot,'failed-edges.json'),JSON.stringify({edges,metadata:metadata.ledger},null,2));throw error;}
  finally{for(const file of metadata.probeFiles){inside(metadata.probeRoot,file);await unlink(file);}inside(packRoot,metadata.probeRoot);await rmdir(metadata.probeRoot);}
  const key=(source,specifier,kind)=>JSON.stringify([slash(resolve(source)).toLowerCase(),specifier,kind]);
  const index=new Map();for(const row of ledger){const id=key(row.source,row.specifier,row.kind);const list=index.get(id)||[];list.push(row);index.set(id,list);}
  const resolved=[];
  for(const edge of edges) {
    if(edge.kind==='path'||edge.kind==='lib') {
      const target=edge.kind==='lib'?`typescript/lib/lib.${edge.specifier.toLowerCase()}.d.ts`:posix.normalize(posix.join(posix.dirname(edge.source),edge.specifier));
      if(!files.includes(target))throw Error(`Missing ${edge.kind} edge ${edge.source}:${edge.line} -> ${target}`);resolved.push({...edge,target,conditions:[]});
    } else {
      const matches=index.get(key(join(packRoot,edge.source),edge.specifier,edge.kind==='types'?'type reference directive':'module'))||[];
      if(!matches.length||matches.some(r=>!r.target))throw Error(`Missing declaration edge ${edge.source}:${edge.line} -> ${edge.specifier}`);
      for(const m of matches)resolved.push({...edge,target:inside(packRoot,m.target),conditions:m.conditions});
    }
  }
  for(const probe of metadata.probes)for(const mode of probe.modes) {
    const found=(index.get(key(probe[mode],probe.specifier,mode==='types'?'type reference directive':'module'))||[]).find(r=>mode==='types'||r.conditions.includes(mode));
    if(!found?.target)throw Error(`Missing metadata edge ${probe.source} ${mode} -> ${probe.specifier}`);
    appendBounded(metadata.ledger,{source:probe.source,specifier:probe.specifier,conditions:[mode,'types'],target:inside(packRoot,found.target),applicable:true});
  }
  // Standard library variants can conflict (DOM/WebWorker, ESNext variants).
  // Each is independently checked with its own transitive reference closure.
  const libEdges=edges.filter(e=>e.source.startsWith('typescript/lib/'));
  for(const file of decls.filter(p=>p.startsWith('typescript/lib/'))) {
    const closure=new Set();const todo=[file];while(todo.length){const p=todo.pop();if(closure.has(p))continue;closure.add(p);for(const e of libEdges.filter(e=>e.source===p)){if(e.kind==='lib')todo.push(`typescript/lib/lib.${e.specifier.toLowerCase()}.d.ts`);else if(e.kind==='path')todo.push(posix.normalize(posix.join(posix.dirname(p),e.specifier)));else throw Error(`Unsupported standard library edge ${p}`);}}
    // A fragment needs a base standard library; preserve the compiler's default
    // core environment while excluding incompatible host-specific variants.
    for(const p of standardLibraries.filter(p=>!p.includes('lib.dom')))closure.add(p);
    assertPass(await run(executable,config(packRoot,[],[...closure].map(p=>join(packRoot,p))),join(evidenceRoot,'libraries'),basename(file)),`Library ${file}`);
  }
  const counts={files:files.length,declarations:decls.length,edges:resolved.length,metadataEdges:metadata.ledger.length,standardLibraries:decls.filter(p=>p.startsWith('typescript/lib/')).length};
  await writeFile(join(evidenceRoot,'inventory.json'),JSON.stringify(files));await writeFile(join(evidenceRoot,'declaration-ledger.json'),JSON.stringify(resolved,null,2));await writeFile(join(evidenceRoot,'metadata-ledger.json'),JSON.stringify(metadata.ledger,null,2));await writeFile(join(evidenceRoot,'coverage.json'),JSON.stringify(counts,null,2));return counts;
}

export async function buildDeclarationPack({sourceRoot,dependencyRoot,out}) {
  sourceRoot=resolve(sourceRoot);dependencyRoot=resolve(dependencyRoot);out=resolve(out);
  try {if((await lstat(out)).isSymbolicLink())throw Error('Output must not be a symlink');if((await readdir(out)).length)throw Error('Output must be new or empty; refusing nonempty output');}catch(error){if(error.code!=='ENOENT')throw error;}
  await mkdir(dirname(out),{recursive:true});const staging=await mkdtemp(join(dirname(out),'.tooling-stage-')),payload=join(staging,'payload'),evidenceRoot=join(staging,'evidence');await mkdir(payload);await mkdir(evidenceRoot);
  try {
    const compiler=await compilerAt(dependencyRoot),threeRoot=await realpath(join(dependencyRoot,'@types/three')),req=createRequire(join(threeRoot,'package.json'));
    const parserMetadata=await regularFile(join(dependencyRoot,'@babel/parser/package.json'));
    if(JSON.parse(parserMetadata).version!=='8.0.5'||process.version!=='v24.12.0')throw Error('Pinned build Node/parser version mismatch');
    const packages=[],provenance={format:'lux-tooling-provenance',version:1,compiler:{version:'7.0.2',sha256:sha(await readFile(compiler.executable))},buildTools:{node:{version:process.version,sha256:sha(await readFile(process.execPath))},parser:{version:'8.0.5',metadataSha256:sha(parserMetadata),sha256:sha(await regularFile(join(dependencyRoot,'@babel/parser/lib/index.js')))}},luxDistribution:{sourcePackages:[],noticePolicy:'Preserve the source package license declarations; this build does not add a publication or license grant.'},packages:[],sdkVariants:{}};
    for(const path of ['packages/visual-sdk/package.json','packages/runtime-contracts/package.json']){const bytes=await regularFile(join(sourceRoot,path)),pkg=JSON.parse(bytes);provenance.luxDistribution.sourcePackages.push({path,sha256:sha(bytes),private:pkg.private===true,license:typeof pkg.license==='string'?pkg.license:null});}
    for(const [name,version]of Object.entries(pins)) {
      let physical;
      if(name==='@typescript/typescript-win32-x64')physical=compiler.root;
      else if(['typescript','three','@types/three','zod'].includes(name))physical=await realpath(join(dependencyRoot,name));
      else {try{physical=dirname(req.resolve(name+'/package.json'));}catch{let p=dirname(req.resolve(name));while(true){try{if(JSON.parse(await readFile(join(p,'package.json'))).name===name){physical=p;break;}}catch{}const next=dirname(p);if(next===p)throw Error(`Cannot resolve package ${name}`);p=next;}}}
      const metadata=await regularFile(join(physical,'package.json')),pkg=JSON.parse(metadata);if(pkg.name!==name||pkg.version!==version)throw Error(`Pinned package mismatch: ${name}@${version}`);
      const key=name.replaceAll('/','+'),typePackage=!['typescript','@typescript/typescript-win32-x64','three'].includes(name),prefix=typePackage?`node_modules/${name}`:`licenses/${key}`;
      const metadataPath=`${prefix}/package.json`,licensePaths=[];
      let shippedMetadata=metadata,transform;
      if(name==='meshoptimizer') {
        if(JSON.stringify(pkg.exports?.['./decoder.cjs'])!==JSON.stringify({require:'./meshopt_decoder.cjs'}))throw Error('Unexpected pinned meshoptimizer decoder export');
        pkg.exports['./decoder.cjs']={require:{types:'./meshopt_decoder.d.ts',default:'./meshopt_decoder.cjs'}};
        shippedMetadata=Buffer.from(JSON.stringify(pkg)+'\n');
        transform={field:'exports["./decoder.cjs"].require',reason:'Resolve the shipped decoder declaration in the require condition; preserve inert runtime target',sha256:sha(shippedMetadata)};
      }
      await put(payload,metadataPath,shippedMetadata);
      const original=[];
      for(const notice of notices(name)) {const bytes=await regularFile(join(physical,notice));if(!bytes.length)throw Error(`Missing notice contents: ${name}/${notice}`);const path=`licenses/${key}/${notice}`;await put(payload,path,bytes);licensePaths.push(path);original.push({path:notice,sha256:sha(bytes)});}
      if(typePackage)for(const file of await walk(physical))if(declaration(file)||file.endsWith('/package.json')) {const bytes=await regularFile(join(physical,file));await put(payload,`${prefix}/${file}`,bytes);original.push({path:file,sha256:sha(bytes)});}
      if(name==='@typescript/typescript-win32-x64')for(const file of await readdir(join(physical,'lib')))if(/^lib.*\.d\.ts$/.test(file)){const bytes=await regularFile(join(physical,'lib',file));await put(payload,`typescript/lib/${file}`,bytes);original.push({path:`lib/${file}`,sha256:sha(bytes)});}
      packages.push({name,version,metadataPath,licensePaths:licensePaths.sort(compare)});provenance.packages.push({name,version,metadataSha256:sha(metadata),...(transform?{transform}:{}),files:original.sort((a,b)=>compare(a.path,b.path))});
    }
    const sourceBytes=new Map();
    for(const path of ['packages/visual-sdk/src/index.ts','packages/visual-sdk/src/sdk-v2.ts','packages/runtime-contracts/src/index.ts','packages/runtime-contracts/src/parameters.d.mts','packages/runtime-contracts/src/parameters.mjs'])sourceBytes.set(path,await regularFile(join(sourceRoot,path)));
    const sdkVariants={};
    for(const [version,selected]of [['0.1.0','index.ts'],['0.2.0','sdk-v2.ts']]) {
      const projection=join(evidenceRoot,'projection',version);await mkdir(projection,{recursive:true});
      const logical=[`packages/visual-sdk/src/${selected}`,'packages/runtime-contracts/src/index.ts','packages/runtime-contracts/src/parameters.d.mts',...(version==='0.2.0'?['packages/runtime-contracts/src/parameters.mjs']:[])].sort(compare),inputs=[];
      for(const path of logical)inputs.push([path,sha(sourceBytes.get(path))]);
      const sdk=sourceBytes.get(`packages/visual-sdk/src/${selected}`).toString('utf8');
      await writeFile(join(projection,'index.ts'),sdk.replaceAll('../../runtime-contracts/src/index.ts','./shared.js').replaceAll('../../runtime-contracts/src/parameters.mjs','./parameters.js'));
      await writeFile(join(projection,'shared.ts'),sourceBytes.get('packages/runtime-contracts/src/index.ts'));
      if(version==='0.2.0'){const bytes=sourceBytes.get('packages/runtime-contracts/src/parameters.d.mts');await writeFile(join(projection,'parameters.d.ts'),bytes);await put(payload,`sdk/${version}/parameters.d.ts`,bytes);}
      const cfg={compilerOptions:{...options,lib:['ES2023','DOM'],noEmit:false,allowImportingTsExtensions:false,declaration:true,emitDeclarationOnly:true,noEmitOnError:true,rootDir:projection,outDir:join(payload,'sdk',version),paths:{zod:[join(payload,'node_modules/zod/index.d.cts')]}},files:[join(projection,'index.ts')]};
      assertPass(await run(compiler.executable,cfg,evidenceRoot,`generate-${version}`),`Generate SDK ${version}`);
      const contractHash=sha(JSON.stringify(['lux-sdk-contract',1,version,inputs]));sdkVariants[version]={declarationEntry:`sdk/${version}/index.d.ts`,contractHash};provenance.sdkVariants[version]={inputs,contractHash};
    }
    const libProbe=join(evidenceRoot,'lib-probe.ts');await writeFile(libProbe,'export {};\n');
    const libs=await run(compiler.executable,{compilerOptions:{...options,lib:['ES2023','DOM']},files:[libProbe]},evidenceRoot,'installed-standard-libraries',['--listFilesOnly']);assertPass(libs,'Installed standard libraries');
    const standardLibraries=libs.text.trim().split(/\r?\n/).filter(p=>p!==slash(libProbe)).map(p=>{inside(join(compiler.root,'lib'),p);return `typescript/lib/${basename(p)}`;}).sort(compare);
    for(const path of standardLibraries)if(!Buffer.from(await readFile(join(payload,path))).equals(await readFile(join(compiler.root,'lib',basename(path)))))throw Error('Staged compiler library byte mismatch');
    provenance.packages.sort((a,b)=>compare(a.name,b.name)||compare(a.version,b.version));await put(payload,'provenance.json',JSON.stringify(provenance)+'\n');
    await checkRepresentativePack({packRoot:payload,dependencyRoot,evidenceRoot:join(evidenceRoot,'representative'),standardLibraries});
    const audit=await auditDeclarationPack({packRoot:payload,dependencyRoot,evidenceRoot:join(evidenceRoot,'exhaustive'),standardLibraries});
    const files={},inventory=[];for(const path of await walk(payload)){const bytes=new Uint8Array(await readFile(join(payload,path)));files[path]=bytes;inventory.push({path,byteLength:bytes.length,sha256:sha(bytes)});}
    const manifest=parseDeclarationPackManifest(new TextEncoder().encode(JSON.stringify({format:'lux-declaration-pack',version:1,typescriptVersion:'7.0.2',threeVersion:'0.186.0',threeTypesVersion:'0.186.0',sdkVariants,packages,files:inventory})));
    const raw=new TextEncoder().encode(JSON.stringify(manifest)+'\n'),declarationPackHash=sha(JSON.stringify(['lux-declaration-pack',1,manifest]));await verifyDeclarationPack(raw,files,declarationPackHash);await put(payload,'pack.json',raw);
    await rename(payload,join(staging,declarationPackHash));await writeFile(join(evidenceRoot,'build.json'),JSON.stringify({declarationPackHash,standardLibraries,audit,nodeVersion:process.version,compilerHash:provenance.compiler.sha256},null,2));
    try{await rmdir(out);}catch(error){if(error.code!=='ENOENT')throw error;}await rename(staging,out);
    return {packRoot:join(out,declarationPackHash),declarationPackHash,standardLibraries,evidenceRoot:join(out,'evidence')};
  } catch(error){await writeFile(join(evidenceRoot,'failure.json'),JSON.stringify({message:error.message,stack:error.stack}));throw Object.assign(Error(`${error.message}\nRetained staging: ${staging}`),{cause:error,staging});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),values={};if(args.length!==6)throw Error('Expected --source-root PATH --dependency-root PATH --out PATH');
  for(let i=0;i<args.length;i+=2){if(!['--source-root','--dependency-root','--out'].includes(args[i])||values[args[i]])throw Error('Unknown or duplicate build argument');values[args[i]]=args[i+1];}
  const result=await buildDeclarationPack({sourceRoot:values['--source-root'],dependencyRoot:values['--dependency-root'],out:values['--out']});console.log(JSON.stringify(result));
}
