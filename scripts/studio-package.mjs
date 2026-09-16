import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile, readdir, realpath, lstat, symlink, rename } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { ComponentLibraryStore } from '../packages/core/src/component-library-store.ts';

const within = (root, path) => { const rel=relative(root,path); return rel==='' || (!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep)); };
export function desktopSourceFile(path) {
 return /^(library\/|packages\/|apps\/build-worker\/src\/|apps\/studio\/src\/|apps\/render-host\/src\/|apps\/installed-runtime\/src\/|scripts\/|tools\/gpu-spike\/)/.test(path)
  || /^(package\.json|tsconfig[^/]*\.json|apps\/studio\/build\.mjs|apps\/(studio|build-worker)\/package\.json)$/.test(path);
}
export function repositoryLibraryRootFromCommonDirectory(commonDirectory) {
 const common=resolve(commonDirectory);
 if(basename(common).toLowerCase()!=='.git')throw Error(`Unsupported Git common directory: ${common}`);
 return join(dirname(common),'library');
}
/** Snapshot cataloged immutable revisions, including Studio saves not yet in Git. */
export async function copyDesktopLibrary(sourceRoot,destination) {
 await mkdir(destination,{recursive:true});
 if((await readdir(destination)).length)throw Error('Packaged library destination must be empty');
 await new ComponentLibraryStore(destination,{seedRoot:sourceRoot}).list();
 const files=[];
 async function collect(prefix='') {
  for(const entry of await readdir(join(destination,prefix),{withFileTypes:true})) {
   const path=prefix?`${prefix}/${entry.name}`:entry.name;
   if(entry.isDirectory())await collect(path);
   else if(entry.isFile())files.push(path);
   else throw Error('Packaged library contains a non-regular file');
  }
 }
 await collect();
 return files.sort();
}
export function installedMainSource(canonicalLibraryRoot) {
 return `const path = require('node:path');
const testing = process.env.LUX_STUDIO_MCP_TEST === '1' && /^test-[a-z0-9-]+$/.test(process.env.LUX_STUDIO_PROFILE || '');
process.env.LUX_STUDIO_PROFILE = testing ? process.env.LUX_STUDIO_PROFILE : 'desktop';
process.env.LUX_STUDIO_DESKTOP = '1';
process.env.LUX_STUDIO_CANONICAL_LIBRARY_ROOT = ${JSON.stringify(canonicalLibraryRoot)};
process.env.LUX_WORKSPACE = path.join(__dirname, 'runtime');
process.env.LUX_NODE_EXECUTABLE = path.join(__dirname, 'node.exe');
delete process.env.LUX_STUDIO_SESSION_ID; delete process.env.LUX_STUDIO_DIST;
if (!testing) { delete process.env.LUX_STUDIO_SMOKE; delete process.env.LUX_STUDIO_MCP_TEST; delete process.env.LUX_STUDIO_LIBRARY_ROOT; }
require('./runtime/apps/studio/dist/main.cjs');
`;
}
/** Copy actual bytes, then recreate only links that stay inside this tree. No dependency on the source checkout. */
export async function copyIndependentTree(source, destination, workspaceLinks = new Map(), select = () => true) {
 source=await realpath(source); destination=resolve(destination);
 if(within(source,destination)||within(destination,source)) throw Error('Copy trees must not overlap');
 const links=[];
 async function visit(from,to) {
  if (!select(relative(source,from).replaceAll('\\','/'))) return;
  const stat=await lstat(from);
  if(stat.isSymbolicLink()) {
   const target=await realpath(from);
   const mapped=workspaceLinks.get(target);
   if(!within(source,target)&&!mapped)throw Error(`Dependency link outside package tree: ${from}`);
   links.push({to,target:mapped||join(destination,relative(source,target)),directory:(await lstat(target)).isDirectory()});
  } else if(stat.isDirectory()) {
   await mkdir(to,{recursive:true});
   for(const entry of await readdir(from)) await visit(join(from,entry),join(to,entry));
  } else if(stat.isFile()) await copyFile(from,to);
  else throw Error(`Unsupported package file: ${from}`);
 }
 await visit(source,destination);
 for(const link of links) {
  await mkdir(dirname(link.to),{recursive:true});
  await symlink(process.platform==='win32'?link.target:relative(dirname(link.to),link.target),link.to,
    link.directory?(process.platform==='win32'?'junction':'dir'):'file');
 }
}
/** Select pnpm package closures without dev-only tooling or a second Electron distribution. */
export async function dependencySelection(modules,names) {
 modules=await realpath(modules);const entries=new Set(),pending=[];
 function selectTarget(target) {
  const rel=relative(modules,target).replaceAll('\\','/');
  if(!rel.startsWith('.pnpm/'))throw Error('Desktop packaging requires pnpm-local dependencies: '+target);
  const entry=rel.split('/')[1];if(!entries.has(entry)){entries.add(entry);pending.push(join(modules,'.pnpm',entry));}
 }
 for(const name of names)selectTarget(await realpath(join(modules,name)));
 async function scan(path) {
  const st=await lstat(path);
  if(st.isSymbolicLink()){selectTarget(await realpath(path));return;}
  if(st.isDirectory())for(const name of await readdir(path))await scan(join(path,name));
 }
 while(pending.length)await scan(pending.pop());
 return path=>!path||path==='.pnpm'||(path.startsWith('.pnpm/')&&entries.has(path.split('/')[1]))||names.some(name=>path===name||name.startsWith(path+'/'));
}

export function desktopInstallRoot(env=process.env) {
 if(!env.LOCALAPPDATA)throw Error('LOCALAPPDATA is required');
 return join(env.LOCALAPPDATA,'Programs','Lux');
}
export async function packageDesktop({ source=resolve(import.meta.dirname,'..'), installRoot=desktopInstallRoot() }={}) {
 if(process.platform!=='win32')throw Error('Desktop packaging currently supports Windows');
 const pkg=JSON.parse(await readFile(join(source,'package.json'),'utf8'));
 if(process.versions.node!==pkg.engines.node)throw Error(`Use Node ${pkg.engines.node}`);
 const electronRoot=await realpath(join(source,'node_modules/electron'));
 const requireElectron=createRequire(join(electronRoot,'package.json'));
 const { downloadArtifact }=requireElectron('@electron/get');
 const version=pkg.devDependencies.electron, archiveName='electron-v'+version+'-win32-'+process.arch+'.zip';
 const checksums=JSON.parse(await readFile(join(electronRoot,'checksums.json'),'utf8'));
 const archive=await downloadArtifact({version,artifactName:'electron',platform:'win32',arch:process.arch,checksums,
  mirrorOptions:{resolveAssetURL:details=>{
   if(details.version!=='v'+version)throw Error('Unexpected Electron version override');
   return 'https://github.com/electron/electron/releases/download/v'+version+'/'+(details.isGeneric?details.artifactName:archiveName);
  }}});
 const archiveHash=createHash('sha256').update(await readFile(archive)).digest('hex');
 if(archiveHash!==checksums[archiveName])throw Error('Official Electron archive checksum mismatch');
 const git=(...args)=>execFileSync('git',['-c',`safe.directory=${source.replaceAll('\\','/')}`,...args],{cwd:source,encoding:'utf8',windowsHide:true}).trim();
 const commit=git('rev-parse','HEAD');
 const canonicalLibraryRoot=repositoryLibraryRootFromCommonDirectory(git('rev-parse','--path-format=absolute','--git-common-dir'));
 const directory=join(resolve(installRoot),'builds',`${commit.slice(0,8)}-${randomUUID().slice(0,8)}`);
 await mkdir(directory,{recursive:true});
 console.error('Extracting the checksum-verified official Electron archive...');
 execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(source,'scripts/studio-extract.ps1'),'-Archive',archive,'-Destination',directory],{windowsHide:true,stdio:'pipe'});
 const executable=join(directory,'Lux.exe'); await rename(join(directory,'electron.exe'),executable);
 const app=join(directory,'resources','app'), workspace=join(app,'runtime');
 await mkdir(workspace,{recursive:true});
 // Library storage is a complete validated snapshot, not a Git tracked-file list.
 const files=git('ls-files','-z').split('\0').filter(Boolean).filter(path=>desktopSourceFile(path)&&!path.startsWith('library/'));
 // Include new packaging sources before their first commit; never glob private working files.
 for(const path of ['scripts/studio-package.mjs','scripts/studio-desktop.mjs','scripts/studio-installed-mcp.mjs','scripts/studio-shortcuts.ps1','scripts/set-lux-executable-icon.ps1','scripts/studio-extract.ps1']) if(!files.includes(path))files.push(path);
 const digest=createHash('sha256');
 for(const path of files.sort()) {
  const from=join(source,path); const stat=await lstat(from);
  if(!stat.isFile()||stat.isSymbolicLink())throw Error(`Source is not a regular file: ${path}`);
  const bytes=await readFile(from);digest.update(path).update(bytes);
  await mkdir(dirname(join(workspace,path)),{recursive:true}); await writeFile(join(workspace,path),bytes);
 }
 const libraryDestination=join(workspace,'library');
 for(const relativePath of await copyDesktopLibrary(canonicalLibraryRoot,libraryDestination)) {
  const path=`library/${relativePath}`;
  digest.update(path).update(await readFile(join(libraryDestination,relativePath)));
 }
 await copyIndependentTree(join(source,'apps','studio','assets'),join(workspace,'apps','studio','assets'));
 execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(source,'scripts/set-lux-executable-icon.ps1'),'-Executable',executable,'-Icon',join(workspace,'apps/studio/assets/branding/lux.ico')],{windowsHide:true,stdio:'pipe'});
 console.error('Copying independent package dependencies...');
 const workspaceLinks=new Map();
 for(const path of ['apps/build-worker','apps/studio','packages/runtime-contracts','packages/visual-sdk']) {
  workspaceLinks.set(await realpath(join(source,path)),join(workspace,path));
 }
 const names=Object.keys({...pkg.dependencies,...pkg.devDependencies}).filter(name=>!['electron','playwright','jsdom','@types/jsdom','openai'].includes(name)&&!name.startsWith('@testing-library/'));
 const selection=await dependencySelection(join(source,'node_modules'),names);
 await copyIndependentTree(join(source,'node_modules'),join(workspace,'node_modules'),workspaceLinks,selection);
 const node=join(app,'node.exe'); await copyFile(process.execPath,node);
 const profile='desktop';
 const adapter=join(workspace,'scripts','studio-installed-mcp.mjs');
 const record={version:1,name:'Lux',sourceCommit:commit,sourceTree:'working tree snapshot',canonicalLibraryRoot,electron:{version,archiveName,sha256:archiveHash,source:'https://github.com/electron/electron/releases/download/v'+version+'/'+archiveName},installedAt:new Date().toISOString(),directory,executable,workspace,node,adapter,profile};
 await writeFile(join(app,'package.json'),JSON.stringify({name:'lux-studio',productName:'Lux',version:'0.1.0',main:'main.cjs'}));
 await writeFile(join(app,'main.cjs'),installedMainSource(canonicalLibraryRoot));
 console.error('Building the installed Studio...');
 const env={...process.env}; delete env.LUX_STUDIO_DIST; delete env.ELECTRON_RUN_AS_NODE;
 // Build script is a packaging input, not a runtime dependency on the source checkout.
 await copyFile(join(source,'apps/studio/build.mjs'),join(workspace,'apps/studio/build.mjs'));
 execFileSync(node,[join(workspace,'apps/studio/build.mjs')],{cwd:workspace,env,stdio:'inherit',windowsHide:true});
 // Source digest is provenance, not a signature; include branding/build inputs and generated bootstrap.
 for(const path of ['apps/studio/build.mjs','apps/studio/assets/branding/lux-icon.png','apps/studio/assets/branding/lux.ico','apps/studio/assets/branding/lux-favicon.svg','apps/studio/assets/licenses/node-LICENSE.txt']) digest.update(path).update(await readFile(join(workspace,path)));
 digest.update(await readFile(join(app,'main.cjs'))).update(await readFile(join(app,'package.json')));
 record.sourceDigest=digest.digest('hex');
 await writeFile(join(directory,'installation.json'),JSON.stringify(record,null,2));
 return record;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 packageDesktop().then(record=>console.log(JSON.stringify(record,null,2))).catch(error=>{console.error(error);process.exitCode=1;});
}
