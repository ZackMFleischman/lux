import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const out=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(out,'../..');
if(fs.existsSync(path.join(out,'configuration.json')))throw Error('Use a fresh artifact directory');
const hash=file=>({path:path.resolve(file),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const executable=path.join(root,'node_modules/electron/dist/electron.exe'),entry=path.join(root,'tools/gpu-spike/query-overhead/main.cjs');
const configuration={root,out,executable,entry,timeoutMs:30000,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim()};
const write=(name,data)=>fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2)+'\n');write('configuration.json',configuration);
const sources=[],binaries=[];
function walk(directory){for(const item of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,item.name);if(item.isDirectory())walk(file);else (/\.(exe|dll|pak|bin|dat|asar)$/i.test(file)?binaries:sources).push(hash(file));}}
walk(path.dirname(executable));walk(path.join(root,'tools/gpu-spike/query-overhead'));
for(const relative of ['packages/performance/gpu-pass.mjs','packages/performance/collection-mode.mjs','scripts/experiment-runner.mjs','scripts/experiment-job.cs','scripts/experiment-job.ps1'])sources.push(hash(path.join(root,relative)));
for(const name of ['prepare.mjs','launch.mjs','inspect.mjs','configuration.json'])sources.push(hash(path.join(out,name)));
write('review-request.json',{schema:1,authorized:false,reviewer:null,expiresUtc:null,hostClosedConfirmed:false,hypothesis:'Measure direct GPU query/resolve/copy queue-interval delta using the unchanged real timer, one submit per fixed 30-frame1080p batch,8 ABBA blocks after warmup. Test-only staged submit and deferred map.30-second outer Job. No full-Studio2% or CPU-hook acceptance.',executable,args:[entry],sources,binaries});
console.log(JSON.stringify({configuration:path.join(out,'configuration.json'),review:path.join(out,'review-request.json'),sources:sources.length,binaries:binaries.length,gpuLaunched:false},null,2));
