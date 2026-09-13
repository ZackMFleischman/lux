import { parseMetadataJson } from './bounded-json.ts';

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
