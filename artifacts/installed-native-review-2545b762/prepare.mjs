// CPU-only: validate existing distributions, privately register, and inventory.
import fs from 'node:fs';
import path from 'node:path';
import Module, {createRequire, isBuiltin, stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const out=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(out,'../..');
const releaseId='2545b762f774c1b046f576d7e61745765876f6ec6dc4f06410c5c998d52573c2';
const runtimeId='8205289821b2dc3185a691664749a7e7b191bb269bbbef1533a99883ae7fb539';
const packageDirectory=path.join(root,'artifacts/checkpoint-exports',releaseId);
const local=path.join(root,'artifacts/installed-package/profile-RmYLyN/local');
const installRoot=path.join(local,'Lux/Installed'),runtime=path.join(installRoot,'runtimes',runtimeId);
const packageRuntime=path.join(packageDirectory,'runtime'),plugins=path.join(out,'plugins');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');
const assert=(condition,message)=>{if(!condition)throw Error(message);};
fs.mkdirSync(out,{recursive:true});
process.env.LOCALAPPDATA=local;delete process.env.NODE_PATH;delete process.env.NODE_OPTIONS;
const roots=[runtime,packageRuntime].map(x=>path.resolve(x).toLowerCase()+path.sep),resolvedModules=new Set();
const originalResolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...rest){
 const resolved=originalResolve.call(this,request,parent,...rest);
 if(!isBuiltin(resolved)){
  assert(roots.some(prefix=>path.resolve(resolved).toLowerCase().startsWith(prefix)),'Development module lookup: '+resolved);
  resolvedModules.add(resolved);
 }
 return resolved;
};
let registration,release,manifest;
try{
 const require=createRequire(path.join(runtime,'package.cjs'));
 const io=require(path.join(runtime,'package.cjs'));
 const verified=io.validatePackage(packageDirectory);release=verified.release;manifest=verified.runtime;
 assert(release.releaseId===releaseId&&manifest.runtimeId===runtimeId,'Unexpected package identity');
 assert(release.version===2&&release.savedControls.backdrop===1,'Expected parameter release and saved white backdrop');
 assert(io.validateRuntime(runtime).runtimeId===runtimeId,'Installed runtime identity changed');
 assert(io.validateRelease(path.join(installRoot,'releases',releaseId)).releaseId===releaseId,'Installed release identity changed');
 for(const name of ['tools/gpu-spike/host-startup.cjs','tools/gpu-spike/frame-gate.cjs','tools/gpu-spike/producer-session.cjs','apps/installed-runtime/src/registry.cjs'])require(path.join(runtime,name));
 registration=require(path.join(runtime,'register.cjs')).registerSource({installRoot,releaseId,pluginDirectory:plugins});
}finally{Module._resolveFilename=originalResolve;}
const sourceFiles=new Set(),binaryFiles=new Set();
const binary=/\.(exe|dll|node|lib|pak|bin|dat|asar)$/i;
function add(file){(binary.test(file)?binaryFiles:sourceFiles).add(path.resolve(file));}
for(const base of [packageRuntime,runtime]){
 add(path.join(base,'runtime.json'));
 for(const file of manifest.files)add(path.join(base,file.path));
}
for(const base of [path.join(packageDirectory,'release'),path.join(installRoot,'releases',releaseId)]){
 add(path.join(base,'release.json'));add(path.join(base,release.transportHash+'.json'));
}
add(path.join(packageDirectory,'install.cmd'));add(registration.dllPath);add(registration.sidecarPath);
const host=path.join(root,'native/build/Release/lux_standalone_host.exe');add(host);add(process.execPath);
for(const name of ['prepare.mjs','launch.mjs','inspect.mjs','inspect-selftest.mjs','README.md'])add(path.join(out,name));
for(const name of ['scripts/experiment-runner.mjs','scripts/experiment-job.ps1','scripts/experiment-job.cs','scripts/native-build.ps1','native/CMakeLists.txt','tools/gpu-spike/standalone_host.cc','apps/render-host/src/main.ts','apps/studio/src/visual-worker.mjs','tools/gpu-spike/build.mjs','package.json','pnpm-lock.yaml','artifacts/studio-common-images/result.json','artifacts/studio-common-images/reopened.png','artifacts/installed-package/result.json'])add(path.join(root,name));
function tree(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())tree(file);else if(/\.(h|hpp|hxx|cc|cpp|cxx|c|inl)$/i.test(file))add(file);}}
for(const name of ['native/ffgl-source/src','native/texture-bridge/include','native/texture-bridge/src','native/vendor/ffgl/source/lib'])tree(path.join(root,name));
const digest=file=>{const bytes=fs.readFileSync(file);return {path:file,sha256:sha(bytes),bytes:bytes.length,modifiedUtc:fs.statSync(file).mtime.toISOString()};};
const sources=[...sourceFiles].sort().map(digest),binaries=[...binaryFiles].sort().map(digest);
const inventory=new Map([...sources,...binaries].map(row=>[row.path,row]));
for(const file of manifest.files)for(const base of [runtime,packageRuntime]){
 const actual=inventory.get(path.join(base,file.path));assert(actual.sha256===file.sha256&&actual.bytes===file.bytes,'Distribution changed: '+actual.path);
}
const reference=json(path.join(root,'artifacts/studio-common-images/result.json')).captures.find(x=>x.name==='reopened');
assert(reference.metadata.revisionId===release.sourceHash&&reference.metadata.controlSchemaHash===release.controlSchemaHash,'Capture is not the exported source/schema');
assert(reference.metadata.controls.backdrop===1&&reference.samples.every(row=>row[3]===255),'Expected opaque reopened reference');
const transport=json(path.join(installRoot,'releases',releaseId,release.transportHash+'.json'));
const assets=Object.entries(transport.linked.assets).map(([name,asset])=>({name,mediaType:asset.mediaType,bytes:Buffer.from(asset.data,'base64').length,sha256:sha(Buffer.from(asset.data,'base64'))}));
const nativeMatches=['LuxTracerTR02.dll','lux_texture_bridge.node'].map(name=>({name,package:inventory.get(path.join(packageRuntime,'native/build/Release',name)).sha256,workspace:digest(path.join(root,'native/build/Release',name)).sha256}));
const emittedMain=stripTypeScriptTypes(fs.readFileSync(path.join(root,'apps/render-host/src/main.ts'),'utf8'));
const attribution={reportedNativeBuildCommit:'d302558',reportedPackageWorker:'Includes capture alpha correction; predates scheduler-only commit 60297e1',
 inspectedCheckout:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),
 nativeMatches,mainEmissionMatches:sha(emittedMain)===inventory.get(path.join(packageRuntime,'apps/render-host/src/main.cjs')).sha256,
 status:'Exact distribution hashes verified; build commit attribution supplied by coordinator, not independently reproducible-build proof',
 host:digest(host),compilerCacheExcerpt:fs.readFileSync(path.join(root,'native/build/CMakeCache.txt'),'utf8').split(/\r?\n/).filter(x=>/^CMAKE_(CXX_COMPILER|GENERATOR|VS_WINDOWS_TARGET_PLATFORM_VERSION)/.test(x))};
const limitations=[
 'This is a native fixture test, not actual Resolume acceptance, composition persistence, multi-instance, parameter-gesture or restart testing.',
 'The fixture does not call FF_SETPARAMETER; immutable saved/default normalized backdrop=1 drives startup. It reads one final bottom-up RGBA8 framebuffer. Pixel inspection is a separate required step.',
 'The reopened reference renders the PNG asset. Both original PNG and oriented JPEG bytes are pinned in the release, but this scene does not render the JPEG in this run.',
 'The fixture runs 10 seconds after FFGL initialization; the outer Windows Job budget is 30 seconds total and then confirms descendant cleanup. Cold installed validation consumes part of these budgets.',
 'The outer Job can kill the idle supervisor immediately after host exit; missing producer lifecycle completion logs must not be treated as complete per-attempt lifecycle evidence.',
 'No development modules are needed by the installed runtime. CPU require resolution was constrained to packaged/installed runtime modules plus Node builtins; this is not a system loader trace or absence-of-files experiment.',
 'Harness code, its Node interpreter and fixture executable are checkout-based. Installed application executes its package-local main/worker and bundled validators; system graphics drivers and Windows DLLs remain external.',
 'Exact runtime/package bytes and source snapshots are inventoried. Reproducible compiler provenance, OS file-cache clearing and system/driver immutability are not established.',
 'No worker/compositor correspondence or performance acceptance follows from the pixels. LUX_CONTROLLED_FRAMES is deliberately unset.',
 'A Job deadline cannot recover a whole-system GPU/driver freeze; ordinary existing runner isolation and lock rules still apply.'
];
const configuration={root,out,packageDirectory,installRoot,local,runtime,runtimeId,releaseId,host,registration,final:path.join(out,'final.rgba'),hostLog:path.join(out,'receiver.jsonl'),reference,assets,attribution,limitations};
write('configuration.json',configuration);add(path.join(out,'configuration.json'));sources.push(digest(path.join(out,'configuration.json')));
write('review-request.json',{schema:1,preparedUtc:new Date().toISOString(),authorized:false,reviewer:null,expiresUtc:null,hostClosedConfirmed:false,
 hypothesis:'One private installed SDK 0.2 PNG scene with saved backdrop=1 produces the reopened reference grid through the native FFGL fixture; 10-second host, 30-second outer Job.',
 executable:host,args:[registration.dllPath,configuration.final],sources,binaries,buildAttribution:attribution,limits:limitations});
write('preparation.json',{prepared:true,gpuLaunched:false,hostTested:false,releaseId,runtimeId,registration,
 sourceFiles:sources.length,binaryFiles:binaries.length,moduleLookupAudit:{outsideRuntimeDenied:true,modules:[...resolvedModules].sort()},assets,attribution});
console.log(JSON.stringify({prepared:true,gpuLaunched:false,out,review:path.join(out,'review-request.json'),sourceFiles:sources.length,binaryFiles:binaries.length,registration},null,2));
