import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,readdir,writeFile,cp,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {ComponentLibraryStore} from '../../packages/core/src/component-library-store.ts';
import {validateLibraryComponent} from '../../packages/core/src/component-library.ts';
import {compileVisual} from '../../apps/build-worker/src/compile.mjs';
import {linkRuntime} from '../../apps/build-worker/src/link-runtime.mjs';

const root=resolve(import.meta.dirname,'../..'),output=join(import.meta.dirname,'profile-merge');
await mkdir(output,{recursive:true});
const profiles=join(process.env.APPDATA,'Lux','Studio','profiles');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={sources:[],excluded:[],components:[],before:[],after:[],applied:false};
const entries=new Map();
for(const dir of (await readdir(profiles,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
 if(!dir.isDirectory()||dir.isSymbolicLink())continue;
 const files=(await readdir(join(profiles,dir.name))).filter(name=>/^component-library\.json(?:\.migrated(?:-[a-f0-9]+)?)?$/.test(name)).sort();
 for(const file of files){
  const path=join(profiles,dir.name,file);
  if(dir.name.startsWith('test-')){report.excluded.push({path,reason:'automated test profile'});continue;}
  const bytes=await readFile(path),legacy=JSON.parse(bytes.toString('utf8'));
  assert.equal(legacy.format,'lux-component-library');assert.equal(legacy.version,1);
  const snapshot=join(output,`${dir.name}-${file}`);await writeFile(snapshot,bytes);
  report.sources.push({path,snapshot,sha256:hash(bytes),count:legacy.components.length});
  for(const raw of legacy.components){const component=validateLibraryComponent(raw),prior=entries.get(component.id);if(prior)assert.deepEqual(component,prior,'conflicting profile IDs require review');else entries.set(component.id,component);}
 }
}
const fallback=join(process.env.APPDATA,'Lux','Studio','library');
try{await stat(join(fallback,'catalog.json'));throw Error('A fallback library exists; include it in the reviewed merge before applying');}catch(error){if(error.code!=='ENOENT')throw error;report.fallback={path:fallback,present:false};}
const library=join(root,'library'),store=new ComponentLibraryStore(library);
report.before=await store.list();
for(const component of entries.values()){
 const result=await compileVisual({source:{...component.source,sdkVersion:'0.3.0'}},{dependencyRoot:join(root,'node_modules')});
 assert.equal(result.ok,true,`${component.name}: ${JSON.stringify(result.diagnostics)}`);
 const linked=await linkRuntime(result.artifact,{dependencyRoot:join(root,'node_modules')});assert.equal(linked.linkedVersion,4);
 const existing=report.before.find(row=>row.id===component.id);if(existing)assert.deepEqual(await store.read(component.id),component);
 report.components.push({id:component.id,name:component.name,revision:component.revision,sourceHash:hash(JSON.stringify(component.source)),compiled:true,linkedVersion:linked.linkedVersion,alreadyPresent:!!existing});
}
// Preserve the originals. The existing migration routine may rename only this staged copy.
await cp(library,join(output,'canonical-before'),{recursive:true,errorOnExist:true,force:false});
const staged=join(output,'combined-component-library.json');
await writeFile(staged,JSON.stringify({format:'lux-component-library',version:1,components:[...entries.values()]},null,2));
await writeFile(join(output,'preflight.json'),JSON.stringify(report,null,2));
if(process.argv.includes('--apply')){
 for(const source of report.sources)assert.equal(hash(await readFile(source.path)),source.sha256,'profile changed since snapshot');
 await new ComponentLibraryStore(library,{legacyPath:staged}).list();
 for(const component of entries.values())assert.deepEqual(await store.read(component.id),component);
 report.after=await store.list();
 for(const source of report.sources)assert.equal(hash(await readFile(source.path)),source.sha256,'original profile changed');
 const portable=join(output,'standalone-seed');const portableStore=new ComponentLibraryStore(portable,{seedRoots:[library]});
 assert.deepEqual(await portableStore.list(),report.after);
 for(const component of entries.values())assert.deepEqual(await portableStore.read(component.id),component);
 report.applied=true;report.originalsUnchanged=true;report.standaloneSeedVerified=true;
}
await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
