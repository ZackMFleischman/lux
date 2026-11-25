// Read-only package reuse and CPU-only evidence preparation. Never launches apps.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const out=path.dirname(fileURLToPath(import.meta.url)),fixtureRoot=path.resolve(out,'../..');
const prior='C:/Users/zFlei/repos/lux/.worktrees/parameter-integration/artifacts/installed-native-review-2545b762';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),old=read(path.join(prior,'configuration.json')),previous=read(path.join(prior,'review-request.json'));
const digest=file=>{const bytes=fs.readFileSync(file);return {path:path.resolve(file),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,modifiedUtc:fs.statSync(file).mtime.toISOString()};};
for(const row of [...previous.sources,...previous.binaries]){
 const immutable=[old.runtime,old.packageDirectory,path.join(old.installRoot,'releases',old.releaseId)].some(base=>path.resolve(row.path).startsWith(path.resolve(base)+path.sep))||[old.registration.dllPath,old.registration.sidecarPath].includes(row.path);
 if(immutable){const actual=digest(row.path);if(actual.sha256!==row.sha256||actual.bytes!==row.bytes)throw Error('Pinned package changed: '+row.path);}
}
const host=path.join(fixtureRoot,'native/build/Release/lux_standalone_host.exe');
const c={...old,out,host,final:path.join(out,'final.rgba'),hostLog:path.join(out,'receiver.jsonl'),fixtureRoot,mode:'alpha-control',
 limitations:['One installed native fixture; no actual Resolume, worker/compositor identity, full GPU cleanup or performance acceptance.','Requires white image, FF_SET_PARAMETER index0 normalized0 acknowledgement and transparent native RGBA quartet within one 10-second window; outer Job remains30seconds.','Existing immutable package/runtime and private registration reused without new export or installation. Rendered PNG is exercised; packaged JPEG is not rendered by this scene.','Native premultiplied encoded-sRGB pixels are unpremultiplied in encoded space only for PNG preview.','A bounded process Job cannot recover a whole-system driver freeze.']};
fs.writeFileSync(path.join(out,'configuration.json'),JSON.stringify(c,null,2)+'\n');
const own=['tools/gpu-spike/standalone_host.cc','tools/gpu-spike/standalone_alpha.h','tools/gpu-spike/native-alpha-inspect.mjs','tests/native/standalone_alpha_test.cc','tests/unit/native-alpha-inspect.test.mjs'].map(p=>path.join(fixtureRoot,p));
const sources=[...new Set([...previous.sources.map(r=>r.path).filter(p=>p!==path.join(old.root,'tools/gpu-spike/standalone_host.cc')),...own,...['prepare.mjs','launch.mjs','inspect.mjs','configuration.json'].map(p=>path.join(out,p))])].map(digest);
const binaries=[...new Set([...previous.binaries.map(r=>r.path).filter(p=>p!==old.host),host])].map(digest);
const commit=execFileSync('git',['-c',`safe.directory=${fixtureRoot}`,'rev-parse','HEAD'],{cwd:fixtureRoot,encoding:'utf8',windowsHide:true}).trim();
const status=execFileSync('git',['-c',`safe.directory=${fixtureRoot}`,'status','--short'],{cwd:fixtureRoot,encoding:'utf8',windowsHide:true}).trim();
const request={...previous,preparedUtc:new Date().toISOString(),authorized:false,reviewer:null,expiresUtc:null,hostClosedConfirmed:false,
 hypothesis:'Existing installed2545 PNG scene changes from white to transparent native premultiplied RGBA after FF_SET_PARAMETER index0 normalized0; 10-second work /30-second outer Job.',
 executable:host,args:[old.registration.dllPath,c.final],sources,binaries,sourceState:{root:fixtureRoot,commit,dirty:Boolean(status),status},
 buildAttribution:{status:'fixture-built-in-isolated-worktree',commit,hostBuildCommit:'f100c7ff7abd732a17a8f4dca25f96149a3597bb',hostSourceUnchangedSinceBuild:true,host:digest(host),compiler:'MSVC19.50.35721.0 / toolset14.50.35717 / WindowsSDK10.0.26100.0',command:'cmake --build native/build --config Release --target lux_standalone_host',cpuValidation:'C++ matcher /W4 /WX; node --test tests/unit/native-alpha-inspect.test.mjs',packageAttribution:old.attribution},limits:c.limitations};
fs.writeFileSync(path.join(out,'review-request.json'),JSON.stringify(request,null,2)+'\n');
console.log(JSON.stringify({authorized:false,review:path.join(out,'review-request.json'),sources:sources.length,binaries:binaries.length,commit,host:request.buildAttribution.host}));

