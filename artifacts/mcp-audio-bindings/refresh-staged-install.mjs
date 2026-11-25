import {readFile,writeFile,copyFile,readdir,mkdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {desktopSourceFile} from '../../scripts/studio-package.mjs';

// Integration helper only. Run AFTER the coordinator has saved and closed Lux.
const args=process.argv.slice(2),files=[];let recordPath,overlayRoot,closedPid;
for(let i=0;i<args.length;i++){
 const arg=args[i],value=args[++i];
 if(arg==='--record')recordPath=value;
 else if(arg==='--overlay-root')overlayRoot=value;
 else if(arg==='--closed-pid')closedPid=Number(value);
 else if(arg==='--file')files.push(value.replaceAll('\\','/'));
 else throw Error('Unknown argument '+arg);
}
if(!recordPath||!overlayRoot||!Number.isSafeInteger(closedPid)||closedPid<=0||!files.length)throw Error('Usage: node refresh-staged-install.mjs --record installation.json --overlay-root ROOT --closed-pid PID --file relative/path [--file ...]');
try{process.kill(closedPid,0);throw Error('Refusing refresh: the specified Lux process is still alive');}catch(error){if(error.code!=='ESRCH')throw error;}
const sourceRoot=resolve(import.meta.dirname,'../..'),overlay=resolve(overlayRoot),record=JSON.parse(await readFile(recordPath,'utf8'));
if(record.profile!=='desktop'||!record.workspace||!record.directory||!record.node)throw Error('Unexpected installation record');
// Also protect any replacement desktop session; caller must supply the real APPDATA.
if(!process.env.APPDATA)throw Error('Real APPDATA is required');
try{const endpoint=JSON.parse(await readFile(join(process.env.APPDATA,'Lux','Studio','profiles','desktop','agent-endpoint.json'),'utf8'));if(endpoint.pid){try{process.kill(endpoint.pid,0);throw Error('Refusing refresh: desktop endpoint still has a live process');}catch(error){if(error.code!=='ESRCH')throw error;}}}catch(error){if(error.code!=='ENOENT')throw error;}
for(const file of files){if(file.startsWith('/')||file.split('/').some(part=>part==='..'||part==='')||!desktopSourceFile(file)||file.startsWith('library/'))throw Error('Invalid overlay source path '+file);}
const gitFiles=execFileSync('git',['-c','safe.directory='+sourceRoot.replaceAll('\\','/'),'ls-files','-z'],{cwd:sourceRoot,encoding:'utf8',windowsHide:true}).split('\0').filter(Boolean).filter(path=>desktopSourceFile(path)&&!path.startsWith('library/'));
const inputs=new Set(gitFiles);
for(const path of ['scripts/studio-package.mjs','scripts/studio-desktop.mjs','scripts/studio-installed-mcp.mjs','scripts/studio-shortcuts.ps1','scripts/set-lux-executable-icon.ps1','scripts/studio-extract.ps1'])inputs.add(path);
for(const file of files){const destination=join(record.workspace,file);await mkdir(dirname(destination),{recursive:true});await copyFile(join(overlay,file),destination);inputs.add(file);}
const env={...process.env};delete env.LUX_STUDIO_DIST;delete env.ELECTRON_RUN_AS_NODE;
execFileSync(record.node,[join(record.workspace,'apps/studio/build.mjs')],{cwd:record.workspace,env,stdio:'inherit',windowsHide:true});
const digest=createHash('sha256');
for(const path of [...inputs].sort())digest.update(path).update(await readFile(join(record.workspace,path)));
async function libraryFiles(prefix=''){const rows=[];for(const entry of await readdir(join(record.workspace,'library',prefix),{withFileTypes:true})){const path=prefix?prefix+'/'+entry.name:entry.name;if(entry.isDirectory())rows.push(...await libraryFiles(path));else if(entry.isFile())rows.push(path);else throw Error('Non-regular packaged library entry');}return rows;}
for(const relative of (await libraryFiles()).sort()){const path='library/'+relative;digest.update(path).update(await readFile(join(record.workspace,path)));}
for(const path of ['apps/studio/build.mjs','apps/studio/assets/branding/lux-icon.png','apps/studio/assets/branding/lux.ico','apps/studio/assets/branding/lux-favicon.svg','apps/studio/assets/licenses/node-LICENSE.txt'])digest.update(path).update(await readFile(join(record.workspace,path)));
const app=dirname(record.workspace);digest.update(await readFile(join(app,'main.cjs'))).update(await readFile(join(app,'package.json')));
record.sourceDigest=digest.digest('hex');record.sourceTree='working tree snapshot';record.installedAt=new Date().toISOString();
await writeFile(recordPath,JSON.stringify(record,null,2));
const overlayCommit=execFileSync('git',['-c','safe.directory='+overlay.replaceAll('\\','/'),'rev-parse','HEAD'],{cwd:overlay,encoding:'utf8',windowsHide:true}).trim();
await writeFile(join(import.meta.dirname,'startup-refresh-receipt.json'),JSON.stringify({recordPath,overlayRoot:overlay,overlayCommit,files,sourceDigest:record.sourceDigest,closedPid,refreshedAt:record.installedAt},null,2));
console.log(JSON.stringify({recordPath,sourceDigest:record.sourceDigest,overlayCommit,files}));
