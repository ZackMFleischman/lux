import { parseMetadataJson, snapshotJsonData, metadataLimits } from './bounded-json.ts';
import { admitProjectMetadata, hashMetadata, validateMetadata, projectLimits } from './contracts.ts';
import type { ProjectMetadata, DependencyLock, ComponentRef, CodeExport } from './contracts.ts';
import { metadataPath } from './metadata-paths.ts';

export type ToolingFile = Readonly<{path: string; byteLength: number; sha256: string}>;
export type ToolingPackage = Readonly<{name: string; version: string; metadataPath: string; licensePaths: readonly string[]}>;
export type DeclarationPackManifest = Readonly<{
  format: 'lux-declaration-pack'; version: 1;
  typescriptVersion: '7.0.2'; threeVersion: '0.186.0'; threeTypesVersion: '0.186.0';
  sdkVariants: Readonly<Record<'0.1.0'|'0.2.0', Readonly<{declarationEntry: string; contractHash: string}>>>;
  packages: readonly ToolingPackage[]; files: readonly ToolingFile[];
}>;
export type VerifiedDeclarationPack = Readonly<{manifest: DeclarationPackManifest; declarationPackHash: string; files: Readonly<Record<string, Uint8Array>>}>;
export const toolingLimits = Object.freeze({manifestBytes:1048576,files:8192,fileBytes:8388608,totalBytes:33554432,pathBytes:240,packages:32} as const);
type Code = 'TOOLCHAIN_INVALID'|'TOOLCHAIN_MODIFIED'|'TOOLCHAIN_UNAVAILABLE'|'QUOTA_EXCEEDED';
function fail(code: Code, message: string, path?: string): never { throw Object.assign(Error(message), {code, ...(path === undefined ? {} : {path})}); }
const invalid = (message: string): never => fail('TOOLCHAIN_INVALID',message);
const encoder = new TextEncoder();
const arrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const intrinsicLength = Object.getOwnPropertyDescriptor(arrayPrototype,'byteLength')!.get!;
const intrinsicBuffer = Object.getOwnPropertyDescriptor(arrayPrototype,'buffer')!.get!;
const intrinsicShared = typeof SharedArrayBuffer === 'undefined' ? undefined : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype,'byteLength')!.get!;
function byteLength(bytes: unknown): number {
  if (!(bytes instanceof Uint8Array)) return invalid('Expected Uint8Array bytes');
  try {
    const buffer = intrinsicBuffer.call(bytes);
    let shared = false;
    if(intrinsicShared) { try { intrinsicShared.call(buffer); shared=true; } catch { /* ordinary storage */ } }
    if(shared) return invalid('Shared bytes are unsupported');
    new Uint8Array(buffer,0,0); // Detect detached storage without copying or invoking iteration.
    return intrinsicLength.call(bytes) as number;
  } catch { return invalid('Invalid or detached byte storage'); }
}
function record(value: unknown, fields?: readonly string[], max=Number.MAX_SAFE_INTEGER): Record<string,unknown> {
  if(!value || typeof value !== 'object' || ![null,Object.prototype].includes(Object.getPrototypeOf(value))) return invalid('Expected plain own-data record');
  const keys=Reflect.ownKeys(value);
  if(keys.length>max) fail('QUOTA_EXCEEDED','Record cardinality exceeded');
  if(fields && (keys.length !== fields.length || keys.some(k=>typeof k!=='string'||!fields.includes(k)))) return invalid('Unexpected or missing fields');
  const out: Record<string,unknown>=Object.create(null);
  for(const key of keys) {
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(typeof key!=='string'||!descriptor?.enumerable||!Object.hasOwn(descriptor,'value')) return invalid('Expected enumerable own string data');
    out[key]=descriptor.value;
  }
  return out;
}
function array(value: unknown, max: number): unknown[] {
  if(!Array.isArray(value)) return invalid('Expected array');
  if(value.length>max) fail('QUOTA_EXCEEDED','Array cardinality exceeded');
  return value;
}
function hash(value: unknown): string { return typeof value==='string' && /^[a-f0-9]{64}$/.test(value) ? value : invalid('Expected canonical SHA256'); }
function path(value: unknown): string {
  if(typeof value!=='string') return invalid('Expected path string');
  if(encoder.encode(value).length>toolingLimits.pathBytes) fail('QUOTA_EXCEEDED','Path byte ceiling exceeded',value);
  if(!value || /[^\x20-\x7e]|[\\:<>"|?*]/.test(value) || value.toLowerCase()==='pack.json') return invalid('Unsafe declaration path');
  for(const segment of value.split('/')) if(!segment||segment==='.'||segment==='..'||/[. ]$/.test(segment)||/^(?:con|prn|aux|nul|conin\$|conout\$|clock\$|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment)) return invalid('Unsafe declaration path segment');
  if(!/(?:\.d\.(?:ts|mts|cts)|\.json|\.txt|\.md)$/.test(value) && value.split('/').at(-1)!=='LICENSE') return invalid('Non-declaration executable or unsupported file');
  return value;
}
function uniquePaths(paths: readonly string[]) {
  const names=new Set<string>();
  for(const name of paths) { const lower=name.toLowerCase(); if(names.has(lower)) return invalid('Duplicate or case-colliding path'); names.add(lower); }
  for(const name of names) { const parts=name.split('/'); parts.pop(); while(parts.length) { if(names.has(parts.join('/'))) return invalid('File/directory collision'); parts.pop(); } }
}
function freeze<T>(value:T): T { if(value && typeof value==='object') { for(const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }

/** Pure wire admission. Canonical identity ignores JSON whitespace and field order. */
export function parseDeclarationPackManifest(raw: Uint8Array): DeclarationPackManifest {
  if(byteLength(raw)>toolingLimits.manifestBytes) fail('QUOTA_EXCEEDED','Manifest byte ceiling exceeded');
  let parsed: unknown;
  try { parsed=parseMetadataJson(raw); } catch(error) { return fail(/limit exceeded/.test((error as Error).message)?'QUOTA_EXCEEDED':'TOOLCHAIN_INVALID',(error as Error).message); }
  const root=record(parsed,['format','version','typescriptVersion','threeVersion','threeTypesVersion','sdkVariants','packages','files']);
  if(root.format!=='lux-declaration-pack'||root.version!==1||root.typescriptVersion!=='7.0.2'||root.threeVersion!=='0.186.0'||root.threeTypesVersion!=='0.186.0') return invalid('Unsupported declaration pack version');
  const variants=record(root.sdkVariants,['0.1.0','0.2.0']);
  const variant=(version:'0.1.0'|'0.2.0')=>{const v=record(variants[version],['declarationEntry','contractHash']);const entry=path(v.declarationEntry); if(!/\.d\.(ts|mts|cts)$/.test(entry)) return invalid('SDK entry must be a declaration');return {declarationEntry:entry,contractHash:hash(v.contractHash)};};
  const sdkVariants={'0.1.0':variant('0.1.0'),'0.2.0':variant('0.2.0')};
  uniquePaths(Object.values(sdkVariants).map(v=>v.declarationEntry));
  let total=0;
  const files=array(root.files,toolingLimits.files).map(value=>{
    const f=record(value,['path','byteLength','sha256']);
    if(typeof f.byteLength!=='number'||!Number.isSafeInteger(f.byteLength)||f.byteLength<0) return invalid('Invalid file byte length');
    if(f.byteLength>toolingLimits.fileBytes || f.byteLength>toolingLimits.totalBytes-total) fail('QUOTA_EXCEEDED','File or aggregate byte ceiling exceeded');
    total+=f.byteLength; return {path:path(f.path),byteLength:f.byteLength,sha256:hash(f.sha256)};
  }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  uniquePaths(files.map(f=>f.path));
  const available=new Set(files.map(f=>f.path));
  const required=(p:string)=>{if(!available.has(p)) fail('TOOLCHAIN_UNAVAILABLE','Missing declared entry, metadata or notice',p);};
  for(const v of Object.values(sdkVariants)) required(v.declarationEntry);
  const identities=new Set<string>();
  const packages=array(root.packages,toolingLimits.packages).map(value=>{
    const p=record(value,['name','version','metadataPath','licensePaths']);
    if(typeof p.name!=='string'||! /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(p.name)||typeof p.version!=='string'||! /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/.test(p.version)) return invalid('Invalid package identity');
    const key=JSON.stringify([p.name,p.version]); if(identities.has(key)) return invalid('Duplicate package identity'); identities.add(key);
    const metadataPath=path(p.metadataPath); if(!metadataPath.endsWith('/package.json')) return invalid('Expected package metadata path'); required(metadataPath);
    const licensePaths=array(p.licensePaths,toolingLimits.files).map(path).sort(); uniquePaths(licensePaths);
    if(!licensePaths.length) fail('TOOLCHAIN_UNAVAILABLE','Package notice is missing',metadataPath);
    for(const notice of licensePaths) { if(!/(?:\.txt|\.md|\/LICENSE)$/.test(notice)) return invalid('Invalid package notice path'); required(notice); }
    return {name:p.name,version:p.version,metadataPath,licensePaths};
  }).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:a.version<b.version?-1:a.version>b.version?1:0);
  return freeze({format:'lux-declaration-pack',version:1,typescriptVersion:'7.0.2',threeVersion:'0.186.0',threeTypesVersion:'0.186.0',sdkVariants,packages,files});
}
async function sha(bytes:Uint8Array):Promise<string> { const digest=await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>); return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''); }
/** Attests only the supplied identity; installed distribution authority is separate. */
export async function verifyDeclarationPack(rawManifest:Uint8Array, input:Readonly<Record<string,Uint8Array>>, expectedPackHash:string):Promise<VerifiedDeclarationPack> {
  const expected=hash(expectedPackHash), manifest=parseDeclarationPackManifest(rawManifest);
  const values=record(input,undefined,toolingLimits.files), lengths:Record<string,number>=Object.create(null);
  let total=0;
  // All caller lengths and cardinality are checked before any payload snapshot/digest.
  for(const [name,bytes] of Object.entries(values)) { path(name); const length=byteLength(bytes); if(length>toolingLimits.fileBytes||length>toolingLimits.totalBytes-total) fail('QUOTA_EXCEEDED','Original byte ceiling exceeded',name); lengths[name]=length; total+=length; }
  uniquePaths(Object.keys(values));
  const declared=new Map(manifest.files.map(f=>[f.path,f]));
  for(const file of manifest.files) if(!Object.hasOwn(values,file.path)) fail('TOOLCHAIN_UNAVAILABLE','Missing declared bytes',file.path);
  for(const name of Object.keys(values)) if(!declared.has(name)) fail('TOOLCHAIN_INVALID','Unexpected bytes',name);
  for(const file of manifest.files) if(lengths[file.path]!==file.byteLength) fail('TOOLCHAIN_MODIFIED','Byte length differs',file.path);
  const files:Record<string,Uint8Array>=Object.create(null);
  for(const file of manifest.files) { const copy=new Uint8Array(file.byteLength); Uint8Array.prototype.set.call(copy,values[file.path] as Uint8Array); files[file.path]=copy; }
  for(const file of manifest.files) if(await sha(files[file.path]!)!==file.sha256) fail('TOOLCHAIN_MODIFIED','File digest differs',file.path);
  const declarationPackHash=await sha(encoder.encode(JSON.stringify(['lux-declaration-pack',1,manifest])));
  if(declarationPackHash!==expected) fail('TOOLCHAIN_MODIFIED','Declaration pack identity differs');
  return Object.freeze({manifest,declarationPackHash,files:Object.freeze(files)});
}

export type EditorFile = Readonly<{ path: string; bytes: Uint8Array; sha256: string }>;
export type EditorOrigin = Readonly<{ projectPath: string; owners: readonly ComponentRef[] }>;
export type DefinitionEditorConfig = Readonly<{
  definition: ComponentRef; sdkVersion: '0.1.0'|'0.2.0'; configPath: string;
  entryPath: string; origins: readonly EditorOrigin[];
  selection: 'nearest-local'|'explicit-package-context';
}>;
declare const editorPlanBrand: unique symbol;
export type ProjectEditorPlan = Readonly<{
  [editorPlanBrand]: true; version: 1; projectId: string;
  toolchain: DependencyLock['toolchain']; files: readonly EditorFile[];
  definitionConfigs: readonly DefinitionEditorConfig[]; planHash: string;
}>;
export type EditorObservation = Readonly<Record<string, Uint8Array>>;
export type EditorConfigMismatch = Readonly<{
  code: 'EDITOR_CONFIG_MISMATCH'; path: string; expectedSha256: string; actualSha256: string|null;
}>;
export type EditorReplacement = Readonly<{
  path: string; expect: Readonly<{ exists: false }>|Readonly<{exists: true; sha256: string}>;
  bytes: Uint8Array; sha256: string;
}>;
export type EditorRepairProposal = Readonly<{
  version: 1; planHash: string; proposalHash: string; desiredToolchain: DependencyLock['toolchain'];
  diagnostics: readonly EditorConfigMismatch[]; replacements: readonly EditorReplacement[];
}>;
export const editorLimits = Object.freeze({definitions:256,configFiles:257,configBytes:65536,totalConfigBytes:2097152,
  originRows:8192,traversalSteps:65536,observedFileBytes:262144,observedTotalBytes:8388608,
  projectPathBytes:240,relativePathBytes:1024} as const);
const issuedEditorPlans = new WeakMap<ProjectEditorPlan, { files: readonly EditorFile[]; toolchain: DependencyLock['toolchain']; planHash: string }>();
const lexical = (a:string,b:string) => a<b?-1:a>b?1:0;
const definitionKey = (ref:ComponentRef) => ref.kind==='local' ? `local:${ref.componentId}` : `package:${ref.packageId}:${ref.exportId}`;
function editorError(code:Code|'PROJECT_INVALID', message:string, location?:string, expected?:string, actual?:string):never {
  throw Object.assign(Error(message),{code,...(location===undefined?{}:{path:location.slice(0,1024)}),
    ...(expected===undefined?{}:{expected:expected.slice(0,240)}),...(actual===undefined?{}:{actual:actual.slice(0,240)})});
}
function captureJson(input:unknown):unknown {
  try { return snapshotJsonData(input); }
  catch(error) { return editorError(/limit exceeded/.test((error as Error).message)?'QUOTA_EXCEEDED':'TOOLCHAIN_INVALID',(error as Error).message); }
}
const intrinsicByteKind = Object.getOwnPropertyDescriptor(arrayPrototype,Symbol.toStringTag)!.get!;
function editorByteLength(input:unknown):number {
  // No instanceof/prototype walk: a genuine typed array may have a hostile
  // prototype. After record descriptors finish, preflight and copy run using
  // only intrinsic slots, with no user code between lengths and snapshots.
  try {
    if(intrinsicByteKind.call(input)!=='Uint8Array')return invalid('Expected Uint8Array bytes');
    const buffer=intrinsicBuffer.call(input);
    let shared=false;
    if(intrinsicShared){try{intrinsicShared.call(buffer);shared=true;}catch{/* ordinary storage */}}
    if(shared)return invalid('Shared bytes are unsupported');
    new Uint8Array(buffer,0,0);
    return intrinsicLength.call(input) as number;
  } catch{return invalid('Invalid or detached byte storage');}
}
function captureEditorBytes(input:unknown,count:number,each:number,aggregate:number,allowed?:Set<string>):Record<string,Uint8Array> {
  const values=record(input,undefined,count),lengths=new Map<string,number>(); let total=0;
  for(const [name,value] of Object.entries(values)) {
    if(allowed && !allowed.has(name)) editorError('TOOLCHAIN_INVALID','Unexpected editor observation',name);
    const size=editorByteLength(value);
    if(size>each || size>aggregate-total) editorError('QUOTA_EXCEEDED','Editor byte ceiling exceeded',name);
    total+=size;lengths.set(name,size);
  }
  const result:Record<string,Uint8Array>=Object.create(null);
  for(const [name,size] of lengths) { const copy=new Uint8Array(size); Uint8Array.prototype.set.call(copy,values[name] as Uint8Array);result[name]=copy; }
  return result;
}
function logicalDocuments(value:unknown):Record<string,Uint8Array> {
  const root=record(value,['project','scenes','components','assets','lock','packages']);
  // Validate shapes before using registry paths to reconstruct logical documents.
  try {
    const project=validateMetadata('project',root.project),lock=validateMetadata('lock',root.lock);
    const scenes=record(root.scenes),components=record(root.components),packages=record(root.packages);
    const exactKeys=(map:Record<string,unknown>,registered:object,label:string)=>{
      if(Object.keys(map).length!==Object.keys(registered).length || Object.keys(map).some(k=>!Object.hasOwn(registered,k))) editorError('PROJECT_INVALID','Metadata map differs from registry',label);
    };
    exactKeys(scenes,project.scenes,'scenes');exactKeys(components,project.components,'components');exactKeys(packages,lock.packages,'packages');
    const documents:Record<string,Uint8Array>=Object.create(null);let total=0;
    const put=(name:string,data:unknown)=>{const raw=encoder.encode(JSON.stringify(data));if(raw.length>metadataLimits.projectBytes-total) editorError('QUOTA_EXCEEDED','Logical metadata byte ceiling exceeded',name);total+=raw.length;documents[name]=raw;};
    put('project.json',project);put('dependencies.lock.json',lock);put('assets/manifest.json',root.assets);
    for(const [id,directory] of Object.entries(project.scenes))put(`${directory}/scene.json`,scenes[id]);
    for(const [id,directory] of Object.entries(project.components))put(`${directory}/component.json`,components[id]);
    for(const [id,pin] of Object.entries(lock.packages))put(`libraries/${pin.contentHash}/package.json`,packages[id]);
    return documents;
  } catch(error) {
    if((error as {code?:string}).code)throw error;
    return editorError(/limit exceeded|quota exceeded/.test((error as Error).message)?'QUOTA_EXCEEDED':'PROJECT_INVALID',(error as Error).message);
  }
}
function projectEditorPath(value:string):string {
  if(encoder.encode(value).length>editorLimits.projectPathBytes)editorError('QUOTA_EXCEEDED','Editor project path ceiling exceeded',value);
  try {return metadataPath(value);} catch {return editorError('PROJECT_INVALID','Invalid editor project path',value);}
}
function uniqueEditorPaths(paths:readonly string[],location:string):void {
  try{uniquePaths(paths);}catch(error){editorError('PROJECT_INVALID',(error as Error).message,location);}
}
/** Both paths are already confined project paths; no platform filesystem semantics. */
function editorRelative(configPath:string,target:string):string {
  // Declaration targets use the pack's grammar (including versioned SDK
  // directories), but their complete project-root path has this same ceiling.
  if(encoder.encode(target).length>editorLimits.projectPathBytes)editorError('QUOTA_EXCEEDED','Editor project path ceiling exceeded',target);
  const from=configPath.split('/');from.pop();const to=target.split('/');let common=0;
  while(common<from.length && common<to.length && from[common]===to[common])common++;
  const result=[...Array<string>(from.length-common).fill('..'),...to.slice(common)].join('/');
  if(!result || encoder.encode(result).length>editorLimits.relativePathBytes)editorError('QUOTA_EXCEEDED','Editor relative path ceiling exceeded',target);
  const resolved=[...from];for(const part of result.split('/')) {if(part==='..'){if(!resolved.length)editorError('TOOLCHAIN_INVALID','Relative path escaped project',target);resolved.pop();}else resolved.push(part);}
  if(resolved.join('/')!==target)editorError('TOOLCHAIN_INVALID','Relative path target differs',target);
  return result;
}

/** Pure logical metadata/config planning. Supplied selection is not installed authority. */
export async function createProjectEditorPlan(metadata:ProjectMetadata,pack:VerifiedDeclarationPack,suppliedToolchain:DependencyLock['toolchain']):Promise<ProjectEditorPlan> {
  // Capture every caller-owned value before any admission/hash can yield.
  const capturedMetadata=captureJson(metadata),capturedSelection=captureJson(suppliedToolchain);
  const packRecord=record(pack,['manifest','declarationPackHash','files']);
  hash(packRecord.declarationPackHash);
  const manifestBytes=encoder.encode(JSON.stringify(captureJson(packRecord.manifest)));
  const packBytes=captureEditorBytes(packRecord.files,toolingLimits.files,toolingLimits.fileBytes,toolingLimits.totalBytes);
  const documents=logicalDocuments(capturedMetadata);
  let selection:DependencyLock['toolchain'];
  try {selection=validateMetadata('lock',{schemaVersion:1,toolchain:capturedSelection,packages:{}}).toolchain;}
  catch(error){return editorError('TOOLCHAIN_INVALID',(error as Error).message,'suppliedToolchain');}
  const lock=validateMetadata('lock',parseMetadataJson(documents['dependencies.lock.json']!));
  const selectionKey=await hashMetadata('lock',{schemaVersion:1,toolchain:selection,packages:{}});
  if(await hashMetadata('lock',{schemaVersion:1,toolchain:lock.toolchain,packages:{}})!==selectionKey)editorError('TOOLCHAIN_UNAVAILABLE','Supplied toolchain differs from project selection','dependencies.lock.json',selectionKey,await hashMetadata('lock',{schemaVersion:1,toolchain:lock.toolchain,packages:{}}));
  const verified=await verifyDeclarationPack(manifestBytes,packBytes,selection.declarationPackHash);
  if(packRecord.declarationPackHash!==verified.declarationPackHash)editorError('TOOLCHAIN_MODIFIED','Claimed pack identity differs','declarationPackHash',verified.declarationPackHash,packRecord.declarationPackHash as string);
  for(const field of ['typescriptVersion','threeVersion','threeTypesVersion'] as const)if(verified.manifest[field]!==selection[field])editorError('TOOLCHAIN_UNAVAILABLE','Selected pack version unavailable',field,selection[field],verified.manifest[field]);
  for(const [sdk,wanted] of Object.entries(selection.sdkVariants)) {
    const actual=verified.manifest.sdkVariants[sdk as '0.1.0'|'0.2.0'];
    for(const field of ['declarationEntry','contractHash'] as const)if(actual?.[field]!==wanted[field])editorError('TOOLCHAIN_UNAVAILABLE','Selected SDK declaration unavailable',`sdkVariants/${sdk}/${field}`,wanted[field],actual?.[field]);
  }
  const threeEntries=['node_modules/@types/three/build/three.webgpu.d.ts','node_modules/@types/three/build/three.tsl.d.ts'];
  for(const entry of threeEntries) {
    if(!Object.hasOwn(verified.files,entry))editorError('TOOLCHAIN_UNAVAILABLE','Required Three declaration unavailable',entry);
    if(!verified.manifest.packages.some(p=>p.name==='@types/three' && p.version==='0.186.0' && p.metadataPath==='node_modules/@types/three/package.json'))editorError('TOOLCHAIN_UNAVAILABLE','Required Three package identity unavailable',entry,'@types/three@0.186.0');
  }
  let admitted:ProjectMetadata;
  try {admitted=await admitProjectMetadata(documents,selection);}
  catch(error){return editorError(/limit exceeded|quota exceeded/.test((error as Error).message)?'QUOTA_EXCEEDED':/Missing SDK toolchain variant/.test((error as Error).message)?'TOOLCHAIN_UNAVAILABLE':'PROJECT_INVALID',(error as Error).message);}
  type Node = {ref:ComponentRef;definition:CodeExport;prefix:string;configPath:string};
  let count=Object.keys(admitted.components).length;
  for(const pkg of Object.values(admitted.packages))count+=Object.keys(pkg.exports).length;
  if(count>editorLimits.definitions)editorError('QUOTA_EXCEEDED','Editor definition ceiling exceeded','definitions');
  const nodes=new Map<string,Node>();
  for(const component of Object.values(admitted.components)) {
    const ref:ComponentRef={kind:'local',componentId:component.componentId},prefix=admitted.project.components[component.componentId]!;
    nodes.set(definitionKey(ref),{ref,definition:component,prefix,configPath:projectEditorPath(`${prefix}/tsconfig.json`)});
  }
  for(const [id,pkg] of Object.entries(admitted.packages))for(const [exportId,definition] of Object.entries(pkg.exports)) {
    const ref:ComponentRef={kind:'package',packageId:id,exportId},contentHash=admitted.lock.packages[id]!.contentHash;
    nodes.set(definitionKey(ref),{ref,definition,prefix:`libraries/${contentHash}`,configPath:projectEditorPath(`vendor/editor/${selection.declarationPackHash}/packages/${contentHash}/${exportId}/tsconfig.json`)});
  }
  uniqueEditorPaths([...nodes.values()].map(n=>n.configPath),'definitionConfigs');
  const definitionConfigs:DefinitionEditorConfig[]=[],pendingFiles:{path:string;bytes:Uint8Array}[]=[];
  let steps=0,originCount=0,totalBytes=0;
  const step=()=>{if(steps===editorLimits.traversalSteps)editorError('QUOTA_EXCEEDED','Editor traversal ceiling exceeded','references');steps++;};
  const publishCandidate=(configPath:string,value:unknown)=>{
    if(pendingFiles.length===editorLimits.configFiles)editorError('QUOTA_EXCEEDED','Editor config count ceiling exceeded',configPath);
    const text=JSON.stringify(value,null,2)+'\n',raw=encoder.encode(text);
    if(raw.length>editorLimits.configBytes || raw.length>editorLimits.totalConfigBytes-totalBytes)editorError('QUOTA_EXCEEDED','Editor config byte ceiling exceeded',configPath);
    totalBytes+=raw.length;pendingFiles.push({path:configPath,bytes:raw});
  };
  for(const rootKey of [...nodes.keys()].sort(lexical)) {
    const root=nodes.get(rootKey)!,done=new Set<string>(),active=new Set<string>(),origins=new Map<string,Map<string,ComponentRef>>();
    const visit=(node:Node)=>{
      const key=definitionKey(node.ref);if(active.has(key))editorError('PROJECT_INVALID','Editor reference cycle',key);if(done.has(key))return;
      step();active.add(key);
      if(node.definition.sdkVersion!==root.definition.sdkVersion)editorError('PROJECT_INVALID','Mixed SDK editor closure',key);
      for(const file of node.definition.files) {
        const projectPath=projectEditorPath(`${node.prefix}/${file}`);
        let owners=origins.get(projectPath);
        if(!owners){if(origins.size===projectLimits.closureFiles || originCount===editorLimits.originRows)editorError('QUOTA_EXCEEDED','Editor origin ceiling exceeded',projectPath);originCount++;owners=new Map();origins.set(projectPath,owners);}
        owners.set(key,node.ref);
      }
      for(const ref of node.definition.references){step();const child=nodes.get(definitionKey(ref));if(!child)editorError('PROJECT_INVALID','Unknown editor reference',definitionKey(ref));visit(child);}
      active.delete(key);done.add(key);
    };
    visit(root);uniqueEditorPaths([...origins.keys()],root.configPath);
    const rows=[...origins].sort(([a],[b])=>lexical(a,b)).map(([projectPath,owners])=>({projectPath,owners:[...owners].sort(([a],[b])=>lexical(a,b)).map(([,ref])=>ref)}));
    const sdk=selection.sdkVariants[root.definition.sdkVersion];if(!sdk)editorError('TOOLCHAIN_UNAVAILABLE','Selected SDK unavailable',root.definition.sdkVersion);
    const relative=(target:string)=>editorRelative(root.configPath,target),prefix=`vendor/toolchain/${selection.declarationPackHash}/`;
    publishCandidate(root.configPath,{compilerOptions:{target:'ES2023',module:'ESNext',moduleResolution:'Bundler',strict:true,noEmit:true,allowImportingTsExtensions:true,types:[],lib:['ES2023','DOM'],skipLibCheck:false,paths:{'@lux/visual-sdk':[relative(prefix+sdk.declarationEntry)],'three/webgpu':[relative(prefix+threeEntries[0])],'three/tsl':[relative(prefix+threeEntries[1])]}},files:rows.map(r=>relative(r.projectPath)).sort(lexical)});
    definitionConfigs.push({definition:root.ref,sdkVersion:root.definition.sdkVersion,configPath:root.configPath,entryPath:projectEditorPath(`${root.prefix}/${root.definition.entry}`),origins:rows,selection:root.ref.kind==='local'?'nearest-local':'explicit-package-context'});
  }
  publishCandidate('tsconfig.json',{files:[],references:[...nodes.values()].map(n=>n.configPath).sort(lexical).map(path=>({path}))});
  pendingFiles.sort((a,b)=>lexical(a.path,b.path));
  const files:EditorFile[]=[];for(const file of pendingFiles)files.push(Object.freeze({...file,sha256:await sha(file.bytes)}));
  const definitionRows=definitionConfigs.map(c=>[definitionKey(c.definition),c.sdkVersion,c.configPath,c.entryPath,c.selection,c.origins.map(o=>[o.projectPath,o.owners.map(definitionKey)])]);
  const planHash=await sha(encoder.encode(JSON.stringify(['lux-project-editor-plan',1,admitted.project.projectId,selectionKey,definitionRows,files.map(f=>[f.path,f.bytes.length,f.sha256])])));
  const toolchain=freeze(selection);
  const plan=Object.freeze({version:1,projectId:admitted.project.projectId,toolchain,files:Object.freeze(files.map(f=>Object.freeze({...f,bytes:f.bytes.slice()}))),definitionConfigs:freeze(definitionConfigs),planHash}) as unknown as ProjectEditorPlan;
  issuedEditorPlans.set(plan,{files,toolchain,planHash});return plan;
}

/** Raw-byte comparison only. Missing keys mean an explicitly observed absence. */
export async function compareProjectEditorFiles(plan:ProjectEditorPlan,observed:EditorObservation):Promise<EditorRepairProposal> {
  const issued=issuedEditorPlans.get(plan);if(!issued)editorError('TOOLCHAIN_INVALID','Expected an issued editor plan');
  const captured=captureEditorBytes(observed,editorLimits.configFiles,editorLimits.observedFileBytes,editorLimits.observedTotalBytes,new Set(issued.files.map(f=>f.path)));
  const diagnostics:EditorConfigMismatch[]=[],replacements:EditorReplacement[]=[];
  for(const file of issued.files) {
    const actual=captured[file.path],actualSha256=actual===undefined?null:await sha(actual);
    if(actual && actual.length===file.bytes.length && actual.every((v,i)=>v===file.bytes[i]))continue;
    diagnostics.push({code:'EDITOR_CONFIG_MISMATCH',path:file.path,expectedSha256:file.sha256,actualSha256});
    replacements.push(Object.freeze({path:file.path,expect:actualSha256===null?Object.freeze({exists:false as const}):Object.freeze({exists:true as const,sha256:actualSha256}),bytes:file.bytes.slice(),sha256:file.sha256}));
  }
  const proposalHash=await sha(encoder.encode(JSON.stringify(['lux-editor-repair-proposal',1,issued.planHash,diagnostics.map(d=>[d.path,d.actualSha256,d.expectedSha256])])));
  return Object.freeze({version:1,planHash:issued.planHash,proposalHash,desiredToolchain:issued.toolchain,diagnostics:freeze(diagnostics),replacements:Object.freeze(replacements)});
}
