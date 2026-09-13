import type { GraphRuntimePlan } from './runtime-plan.ts';
import { readGraphRuntimePlan } from './runtime-plan.ts';
import type { NodePath } from '../../../runtime-contracts/src/graph.ts';
import type { NestedExecutionPlan, NestedPlannedNode } from '../../../runtime-contracts/src/nested-graph.ts';
import type { ResourceCounts, ResourceLedger, ResourceReservation } from './resource-accounting.ts';
import { createResourceLedger, resourceCapacities } from './resource-accounting.ts';
declare const hostBrand: unique symbol, frameBrand: unique symbol;
declare const scopeBrand: unique symbol, outputBrand: unique symbol;
declare const inputBrand: unique symbol, cacheBrand: unique symbol;
export type ResourceHost = Readonly<{readonly [hostBrand]: true}>;
export type ResourceFrame = Readonly<{readonly [frameBrand]: true}>;
export type EvaluationScope = Readonly<{readonly [scopeBrand]: true}>;
export type OutputToken = Readonly<{readonly [outputBrand]: true}>;
export type InputView = Readonly<{readonly [inputBrand]: true}>;
export type CachedOutputs = Readonly<{readonly [cacheBrand]: true}>;
export type HostProfile = Readonly<{
  generation:number; sceneSeed:number; initialClockEpoch:number;
  width:number; height:number; format:'rgba8unorm';
  colorSpace:'linear-srgb'; alphaMode:'premultiplied';
}>;
export type ImageDescriptor = Readonly<{
  kind:'image'; width:number; height:number; format:'rgba8unorm';
  colorSpace:'linear-srgb'; alphaMode:'premultiplied';
}>;
export type SignalDescriptor = Readonly<{
  kind:'signal'; value:number; unit:string|null; clock:'frame';
}>;
export type OutputMap = Readonly<Record<string,OutputToken>>;
export type InputMap = Readonly<Record<string,InputView>>;
export type BackendImage = Readonly<{
  generation:number; clockEpoch:number; version:number;
  nodePath:NodePath; portId:string; descriptor:ImageDescriptor;
}>;
export type CpuResourceBackend = Readonly<{
  produce(output:BackendImage, inputs:readonly BackendImage[]):void|PromiseLike<void>;
  release(image:BackendImage):void|PromiseLike<void>;
  capture(image:BackendImage):void|PromiseLike<void>;
}>;
export type CaptureHold = Readonly<{release():void}>;
export type FrameOutput = Readonly<{
  descriptor:ImageDescriptor; generation:number; clockEpoch:number;
  version:number; capture():CaptureHold; release():void;
}>;
export type CallbackResources = Readonly<{
  readSignal(input:InputView):SignalDescriptor;
  imageDescriptor(input:InputView):ImageDescriptor;
  signal(portId:string,value:number):OutputToken;
  image(portId:string,descriptor:ImageDescriptor,inputs:readonly InputView[]):Promise<OutputToken>;
}>;
export type Evaluation = Readonly<{
  scope:EvaluationScope; inputs:InputMap; resources:CallbackResources;
}>;
export type ResourceStatus = Readonly<{
  state:'active'|'resetting'|'terminal'|'drained'; clockEpoch:number;
  counts:ResourceCounts; openCallbacks:number;
  cleanupPending:number; releaseFailed:number;
}>;
export type ResourceErrorCode = 'RESOURCE_INVALID'|'RESOURCE_CAPACITY'|
  'RESOURCE_REENTRY'|'RESOURCE_STALE'|'RESOURCE_TERMINAL'|
  'RESOURCE_BACKEND'|'RESOURCE_CLEANUP';
export type ResourceFailureDetail = Readonly<{
  code:'RESOURCE_CLEANUP'; version:number; nodePath:NodePath;
  portId:string; message:string;
}>;
export type ResourceError = Error & Readonly<{
  code:ResourceErrorCode; unreclaimed?:number;
  cleanupFailures?:readonly ResourceFailureDetail[];
}>;

type Dimension = keyof ResourceCounts;
type Deferred<T> = {promise:Promise<T>; resolve(value:T):void; reject(reason:unknown):void};
type Host = {
  profile:HostProfile; backend:CpuResourceBackend; ledger:ResourceLedger;
  plan?:NestedExecutionPlan; authority?:GraphRuntimePlan; frame?:Frame; slot?:Scope;
  state:'active'|'terminal'|'drained'; marker:object; guarded:boolean;
  version:number; frameId:number; openCallbacks:number; producers:number;
  allocations:Set<Allocation>; caches:Set<Cache>; cleanupPending:number;
  failures:ResourceFailureDetail[]; primary?:ResourceError;
  disposal?:Deferred<void>; disposalSettled:boolean; queued:boolean;
};
type Frame = {host:Host; id:number; epoch:number; retired:boolean; nodes:Map<string,Node>; final?:Allocation};
type Node = {plan:NestedPlannedNode; selected:boolean; complete:boolean; obligations:Obligation[]};
type Obligation = {reservation?:ResourceReservation; sourceKey:string; sourcePort:string; port:string; allocation?:Allocation; notified:boolean; reads:number};
type Scope = {host:Host; frame:Frame; node:Node; notified:boolean; finished:boolean; outputs:Map<string,Allocation>; pending:number; settled:Deferred<void>};
type Allocation = {host:Host; version:number; path:NodePath; port:string; descriptor?:ImageDescriptor|SignalDescriptor; image?:BackendImage; reservation:ResourceReservation; holds:number; attempted:boolean; released:boolean};
type Output = {host:Host; scope:Scope; port:string; allocation:Allocation};
type View = {scope:Scope; obligation:Obligation};
type Cache = {host:Host; released:boolean; allocations:Allocation[]};
const hosts=new WeakMap<object,Host>(), frames=new WeakMap<object,Frame>();
const scopes=new WeakMap<object,Scope>(), outputs=new WeakMap<object,Output>();
const views=new WeakMap<object,View>(), caches=new WeakMap<object,Cache>();
const ownErrors=new WeakSet<object>();
const dimensions:readonly Dimension[]=['allocations','backend','inputs','frames','captures'];
const profileKeys=['generation','sceneSeed','initialClockEpoch','width','height','format','colorSpace','alphaMode'];
const imageKeys=['kind','width','height','format','colorSpace','alphaMode'];
const emptyCounts=():Record<Dimension,number>=>({allocations:0,backend:0,inputs:0,frames:0,captures:0});
const opaque=<T>():T=>Object.freeze(Object.create(null)) as T;
const pathKey=(path:NodePath):string=>JSON.stringify(path);
function deferred<T>():Deferred<T> {
  let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  // Every public rejection is observed even if its caller abandons the promise.
  void promise.catch(()=>{});
  return {promise,resolve,reject};
}
function error(code:ResourceErrorCode,message:string):ResourceError {
  const result=new Error(message) as ResourceError;
  Object.defineProperty(result,'message',{value:message,writable:false,configurable:false});
  Object.defineProperty(result,'code',{value:code,enumerable:true});ownErrors.add(result);return result;
}
function invalid():never {throw error('RESOURCE_INVALID','Invalid resource data or authority');}
function stale():never {throw error('RESOURCE_STALE','Resource authority is closed');}
function getHost(token:ResourceHost):Host {const h=hosts.get(token);if(!h)invalid();return h;}
function active(h:Host):void {if(h.state!=='active')throw error('RESOURCE_TERMINAL','Resource host is terminal');}
function changed(h:Host,marker:object):void {active(h);if(h.marker!==marker)stale();}
function enter(h:Host):void {if(h.guarded)throw error('RESOURCE_REENTRY','Resource admission reentry');h.guarded=true;}
function admit<T>(h:Host,body:(marker:object)=>T):T {
  enter(h);try{active(h);return body(h.marker);}catch(e){if(typeof e==='object'&&e!==null&&ownErrors.has(e))throw e;invalid();}finally{h.guarded=false;kick(h);}
}
function captureRecord(value:unknown,keys:readonly string[]):Record<string,unknown> {
  if(value===null||typeof value!=='object'||Array.isArray(value))invalid();
  const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)invalid();
  const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)))invalid();
  const result:Record<string,unknown>=Object.create(null);
  for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d||!Object.hasOwn(d,'value'))invalid();result[k]=d.value;}
  return result;
}
function captureArray(value:unknown,min:number,max:number):unknown[] {
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)invalid();
  const length=Object.getOwnPropertyDescriptor(value,'length');if(!length||!Object.hasOwn(length,'value'))invalid();
  const n:unknown=length.value;if(typeof n!=='number'||!Number.isInteger(n)||n<min||n>max)invalid();
  const keys=Reflect.ownKeys(value);if(keys.length!==n+1)invalid();
  const result:unknown[]=[];
  for(let i=0;i<n;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!Object.hasOwn(d,'value'))invalid();result.push(d.value);}
  return result;
}
function capturePath(value:NodePath):NodePath {
  const list=captureArray(value,1,8);for(const part of list)if(typeof part!=='string'||part.length!==36)invalid();
  // Membership in the authentic admitted plan supplies exact UUID validation.
  return Object.freeze(list) as NodePath;
}
function captureImage(h:Host,value:ImageDescriptor):ImageDescriptor {
  const d=captureRecord(value,imageKeys);
  for(const k of imageKeys)if(d[k]!== (k==='kind'?'image':h.profile[k as keyof HostProfile]))invalid();
  return Object.freeze(d) as ImageDescriptor;
}
function checkedNext(value:number):number {
  if(!Number.isSafeInteger(value)||value<0||value===Number.MAX_SAFE_INTEGER)throw error('RESOURCE_CAPACITY','Resource identity exhausted');
  return value+1;
}
function reserveGroup(ledger:ResourceLedger,parts:readonly Dimension[]):ResourceReservation[] {
  const total=emptyCounts();for(const part of parts)total[part]++;
  const snapshot=ledger.snapshot();
  for(const field of dimensions)if(total[field]>resourceCapacities[field]-snapshot[field])throw error('RESOURCE_CAPACITY',`Resource capacity exceeded: ${field}`);
  const tokens:ResourceReservation[]=[];
  try{for(const field of parts)tokens.push(ledger.reserve({...emptyCounts(),[field]:1}));return tokens;}
  catch {for(let i=tokens.length-1;i>=0;i--)ledger.release(tokens[i]!);throw error('RESOURCE_CAPACITY','Resource reservation group failed');}
}
function message(value:unknown):string {
  try{if((typeof value==='object'&&value!==null)||typeof value==='function'){const d=Object.getOwnPropertyDescriptor(value,'message');if(d&&Object.hasOwn(d,'value')&&typeof d.value==='string')return d.value.slice(0,1024);}}catch{}
  return 'Resource operation failed';
}
function startDisposal(h:Host):Deferred<void> {
  if(h.disposal)return h.disposal;
  h.disposal=deferred<void>();h.state='terminal';h.marker={};
  // Unselected nodes have never had an evaluation or backend dispatch.
  if(h.frame)for(const n of h.frame.nodes.values())if(!n.selected){n.selected=true;for(const o of n.obligations){o.notified=true;finishObligation(h,o);}}
  kick(h);return h.disposal;
}
function failure(h:Host,code:ResourceErrorCode,value:unknown):void {
  // Publish first-failure ownership before reflecting on an arbitrary error.
  const first=!h.primary;if(first)h.primary=error(code,'Resource operation failed');
  startDisposal(h);
  if(first){const was=h.guarded;h.guarded=true;try{h.primary=error(code,message(value));}finally{h.guarded=was;}}
  kick(h);
}
function terminalError(h:Host):ResourceError {return h.primary??error('RESOURCE_TERMINAL','Resource host is terminal');}
function drop(a:Allocation):void {a.holds--;kick(a.host);}
function finishObligation(h:Host,o:Obligation):void {
  if(!o.notified||o.reads!==0||!o.reservation)return;
  h.ledger.release(o.reservation);o.reservation=undefined;
  if(o.allocation){drop(o.allocation);o.allocation=undefined;}
}
function notify(s:Scope):void {
  if(s.notified)stale();s.notified=true;s.host.openCallbacks--;
  for(const o of s.node.obligations){o.notified=true;finishObligation(s.host,o);}
}
function finishScope(s:Scope):void {
  if(s.finished||!s.notified||s.pending!==0)return;
  s.finished=true;for(const a of s.outputs.values())drop(a);s.outputs.clear();s.node.obligations=[];
  if(s.host.slot===s)s.host.slot=undefined;kick(s.host);
}
function getScope(h:Host,token:EvaluationScope):Scope {const s=scopes.get(token);if(!s||s.host!==h)invalid();return s;}
function getFrame(h:Host,token:ResourceFrame):Frame {const f=frames.get(token);if(!f||f.host!==h)invalid();if(f.retired||h.frame!==f)stale();return f;}
function currentScope(s:Scope):void {active(s.host);if(s.notified||s.finished||s.host.slot!==s||s.frame.retired||s.host.frame!==s.frame)stale();}
function input(s:Scope,token:InputView,kind:'image'|'signal'):Obligation {
  const view=views.get(token);if(!view||view.scope!==s)invalid();currentScope(s);
  const o=view.obligation;if(!o.allocation||o.allocation.released||o.allocation.descriptor?.kind!==kind)invalid();return o;
}
function port(s:Scope,id:string,kind:'image'|'signal') {
  if(typeof id!=='string')invalid();
  const p=s.host.plan!.definitions[s.node.plan.definitionHash]!.metadata.outputs[id];
  if(!p||p.type.kind!==kind||s.outputs.has(id))invalid();return p.type;
}
function allocation(s:Scope,id:string,descriptor:ImageDescriptor|SignalDescriptor,reservation:ResourceReservation,version:number):{a:Allocation;token:OutputToken} {
  const h=s.host,path=s.node.plan.nodePath;
  const image=descriptor.kind==='image'?Object.freeze({generation:h.profile.generation,clockEpoch:s.frame.epoch,version,nodePath:Object.freeze([...path]),portId:id,descriptor}):undefined;
  const a:Allocation={host:h,version,path,port:id,descriptor,image,reservation,holds:1,attempted:false,released:false};
  const token=opaque<OutputToken>();outputs.set(token,{host:h,scope:s,port:id,allocation:a});
  h.version=version;h.allocations.add(a);s.outputs.set(id,a);return {a,token};
}
function observe(call:()=>void|PromiseLike<void>,settle:(failed:boolean,value?:unknown)=>void):void {
  let once=false;const done=(failed:boolean,value?:unknown)=>{if(once)return;once=true;settle(failed,value);};
  try{const result=call();void Promise.resolve(result).then(()=>done(false),e=>done(true,e));}catch(e){done(true,e);}
}
function issueImage(s:Scope,id:string,descriptor:ImageDescriptor,list:readonly InputView[]):Promise<OutputToken> {
  const h=s.host;let committed:{a:Allocation;token:OutputToken;backend:ResourceReservation;reads:Obligation[];promise:Deferred<OutputToken>};
  try{committed=admit(h,marker=>{
    currentScope(s);port(s,id,'image');const captured=captureImage(h,descriptor);changed(h,marker);currentScope(s);
    const raw=captureArray(list,0,16);changed(h,marker);currentScope(s);
    const seen=new Set<unknown>(),reads:Obligation[]=[];
    for(const token of raw){if(seen.has(token))invalid();seen.add(token);reads.push(input(s,token as InputView,'image'));}
    const version=checkedNext(h.version);changed(h,marker);
    const reservations=reserveGroup(h.ledger,['allocations','backend']);
    const result=allocation(s,id,captured,reservations[0]!,version);result.a.holds++;
    if(s.pending===0)s.settled=deferred<void>();s.pending++;h.producers++;
    for(const o of reads)o.reads++;
    return {...result,backend:reservations[1]!,reads,promise:deferred<OutputToken>()};
  });}catch(e){const rejected=deferred<OutputToken>();rejected.reject(e);return rejected.promise;}
  const {a,token,backend,reads,promise}=committed;
  const images=Object.freeze(reads.map(o=>o.allocation!.image!));
  observe(()=>h.backend.produce(a.image!,images),(failed,value)=>{
    h.ledger.release(backend);h.producers--;s.pending--;drop(a);
    for(const o of reads){o.reads--;finishObligation(h,o);}reads.length=0;
    if(failed)failure(h,'RESOURCE_BACKEND',value);
    if(!failed&&h.state==='active'&&!s.notified)promise.resolve(token);else promise.reject(terminalError(h));
    if(s.pending===0){s.settled.resolve();if(h.state!=='active')finishScope(s);}
    kick(h);
  });
  return promise.promise;
}
function callbackResources(s:Scope):CallbackResources {
  const h=s.host;
  return Object.freeze({
    readSignal:Object.freeze((view:InputView):SignalDescriptor=>admit(h,()=>input(s,view,'signal').allocation!.descriptor as SignalDescriptor)),
    imageDescriptor:Object.freeze((view:InputView):ImageDescriptor=>admit(h,()=>input(s,view,'image').allocation!.descriptor as ImageDescriptor)),
    signal:Object.freeze((id:string,value:number):OutputToken=>admit(h,marker=>{
      currentScope(s);const type=port(s,id,'signal');if(type.kind!=='signal'||typeof value!=='number'||!Number.isFinite(value))invalid();
      const version=checkedNext(h.version);changed(h,marker);const [reservation]=reserveGroup(h.ledger,['allocations']);
      return allocation(s,id,Object.freeze({kind:'signal',value,unit:type.unit,clock:'frame'}),reservation!,version).token;
    })),
    image:Object.freeze((id:string,d:ImageDescriptor,inputs:readonly InputView[])=>issueImage(s,id,d,inputs)),
  });
}

export function createResourceHost(profile:HostProfile,backend:CpuResourceBackend):ResourceHost {
  let captured:HostProfile,methods:Record<string,unknown>;
  try{
    const p=captureRecord(profile,profileKeys);
    for(const k of ['generation','initialClockEpoch'])if(typeof p[k]!=='number'||!Number.isSafeInteger(p[k])||(p[k] as number)<0)invalid();
    if(typeof p.sceneSeed!=='number'||!Number.isInteger(p.sceneSeed)||p.sceneSeed<0||p.sceneSeed>4294967295)invalid();
    for(const k of ['width','height'])if(typeof p[k]!=='number'||!Number.isInteger(p[k])||(p[k] as number)<1||(p[k] as number)>4096)invalid();
    if((p.width as number)*(p.height as number)>16777216||p.format!=='rgba8unorm'||p.colorSpace!=='linear-srgb'||p.alphaMode!=='premultiplied')invalid();
    captured=Object.freeze(p) as HostProfile;methods=captureRecord(backend,['produce','release','capture']);
    for(const name of ['produce','release','capture'])if(typeof methods[name]!=='function')invalid();
  }catch{invalid();}
  const produce=methods.produce as CpuResourceBackend['produce'],release=methods.release as CpuResourceBackend['release'],capture=methods.capture as CpuResourceBackend['capture'];
  const bound:CpuResourceBackend=Object.freeze({produce:Object.freeze((image:BackendImage,inputs:readonly BackendImage[])=>Reflect.apply(produce,backend,[image,inputs])),release:Object.freeze((image:BackendImage)=>Reflect.apply(release,backend,[image])),capture:Object.freeze((image:BackendImage)=>Reflect.apply(capture,backend,[image]))});
  const token=opaque<ResourceHost>();hosts.set(token,{profile:captured,backend:bound,ledger:createResourceLedger(),state:'active',marker:{},guarded:false,version:0,frameId:0,openCallbacks:0,producers:0,allocations:new Set(),caches:new Set(),cleanupPending:0,failures:[],disposalSettled:false,queued:false});return token;
}
export function attachResourceHost(host:ResourceHost,plan:GraphRuntimePlan):void {
  const h=getHost(host);admit(h,()=>{if(h.authority)invalid();let p:NestedExecutionPlan;try{p=readGraphRuntimePlan(plan);}catch{invalid();}h.authority=plan;h.plan=p;});
}
export function beginResourceFrame(host:ResourceHost,clockEpoch:number):ResourceFrame {
  const h=getHost(host);return admit(h,marker=>{
    if(!h.plan||h.frame||h.slot||h.ledger.snapshot().inputs!==0||clockEpoch!==h.profile.initialClockEpoch)invalid();
    const id=checkedNext(h.frameId),nodes=new Map<string,Node>();const count=h.plan.nodes.reduce((n,v)=>n+v.inputs.length,0);changed(h,marker);
    const reservations=reserveGroup(h.ledger,Array.from({length:count},()=>'inputs' as const));let index=0;
    for(const plan of h.plan.nodes)nodes.set(pathKey(plan.nodePath),{plan,selected:false,complete:false,obligations:plan.inputs.map(i=>({reservation:reservations[index++]!,sourceKey:pathKey(i.source.nodePath),sourcePort:i.source.portId,port:i.portId,notified:false,reads:0}))});
    const frame:Frame={host:h,id,epoch:clockEpoch,retired:false,nodes};const token=opaque<ResourceFrame>();frames.set(token,frame);h.frame=frame;h.frameId=id;return token;
  });
}
export function openResourceNode(host:ResourceHost,frame:ResourceFrame,nodePath:NodePath):Evaluation {
  const h=getHost(host);return admit(h,marker=>{
    const f=getFrame(h,frame);if(h.slot)invalid();const path=capturePath(nodePath);changed(h,marker);
    const n=f.nodes.get(pathKey(path));if(!n||n.selected||n.obligations.some(o=>!o.allocation))invalid();
    const s:Scope={host:h,frame:f,node:n,notified:false,finished:false,outputs:new Map(),pending:0,settled:deferred<void>()};
    const token=opaque<EvaluationScope>();scopes.set(token,s);const inputs:Record<string,InputView>=Object.create(null);
    for(const o of n.obligations){const view=opaque<InputView>();views.set(view,{scope:s,obligation:o});inputs[o.port]=view;}
    changed(h,marker);n.selected=true;h.slot=s;h.openCallbacks++;
    return Object.freeze({scope:token,inputs:Object.freeze(inputs),resources:callbackResources(s)});
  });
}
export function completeResourceNode(host:ResourceHost,scope:EvaluationScope,value:unknown):Promise<CachedOutputs> {
  const result=deferred<CachedOutputs>();let h:Host,s:Scope,marker:object,valid=false;
  try{h=getHost(host);enter(h);try{
    s=getScope(h,scope);notify(s);marker=h.marker;
    try{
      const ports=Object.keys(h.plan!.definitions[s.node.plan.definitionHash]!.metadata.outputs);
      const captured=captureRecord(value,ports);changed(h,marker);
      for(const id of ports){const o=outputs.get(captured[id] as OutputToken);if(!o||o.host!==h||o.scope!==s||o.port!==id||o.allocation!==s.outputs.get(id))invalid();}
      if(s.outputs.size!==ports.length)invalid();valid=true;
    }catch(e){failure(h,typeof e==='object'&&e!==null&&ownErrors.has(e)?(e as ResourceError).code:'RESOURCE_INVALID',e);}
  }finally{h.guarded=false;kick(h);}}catch(e){result.reject(e);return result.promise;}
  const complete=()=>{
    try{
      if(!valid||h.state!=='active')throw terminalError(h);changed(h,marker);
      const allocations=[...s.outputs.values()];const cache:Cache={host:h,released:false,allocations};const token=opaque<CachedOutputs>();
      // All publication holds are installed before dropping producer ownership.
      for(const a of allocations)a.holds++;
      for(const n of s.frame.nodes.values())for(const o of n.obligations)if(o.reservation&&!o.allocation&&o.sourceKey===pathKey(s.node.plan.nodePath)){
        const a=s.outputs.get(o.sourcePort)!;a.holds++;o.allocation=a;
      }
      if(pathKey(h.plan!.finalOutput.nodePath)===pathKey(s.node.plan.nodePath)){const a=s.outputs.get(h.plan!.finalOutput.portId)!;a.holds++;s.frame.final=a;}
      caches.set(token,cache);h.caches.add(cache);s.node.complete=true;finishScope(s);result.resolve(token);
    }catch(e){failure(h,typeof e==='object'&&e!==null&&ownErrors.has(e)?(e as ResourceError).code:'RESOURCE_INVALID',e);finishScope(s);result.reject(terminalError(h));}
    kick(h);
  };
  if(s.pending===0)void Promise.resolve().then(complete);else void s.settled.promise.then(complete);
  return result.promise;
}
export function failResourceNode(host:ResourceHost,scope:EvaluationScope):void {
  const h=getHost(host);enter(h);try{const s=getScope(h,scope);notify(s);failure(h,'RESOURCE_BACKEND',error('RESOURCE_BACKEND','Resource callback failed'));finishScope(s);}finally{h.guarded=false;kick(h);}
}
function releaseCache(cache:Cache):void {
  if(cache.released)return;cache.released=true;cache.host.marker={};cache.host.caches.delete(cache);
  for(const a of cache.allocations)drop(a);cache.allocations=[];
}
export function releaseResourceCache(host:ResourceHost,cache:CachedOutputs):void {
  const h=getHost(host),c=caches.get(cache);if(!c||c.host!==h)invalid();releaseCache(c);
}
export function finishResourceFrame(host:ResourceHost,frame:ResourceFrame):FrameOutput {
  const h=getHost(host);return admit(h,marker=>{
    const f=getFrame(h,frame);if(h.slot||h.producers||[...f.nodes.values()].some(n=>!n.complete)||!f.final?.image)invalid();changed(h,marker);
    const [reservation]=reserveGroup(h.ledger,['frames']);const a=f.final,image=a.image!;let released=false;
    const release=Object.freeze(()=>{if(released)return;released=true;h.marker={};h.ledger.release(reservation!);drop(a);});
    const capture=Object.freeze(():CaptureHold=>{
      let work:ResourceReservation,hold:ResourceReservation;let ended=false,settled=false,finished=false;
      admit(h,m=>{if(released)stale();changed(h,m);const r=reserveGroup(h.ledger,['captures','backend']);hold=r[0]!;work=r[1]!;a.holds++;});
      const finish=()=>{if(finished||!ended||!settled)return;finished=true;h.ledger.release(hold);drop(a);};
      const token=Object.freeze({release:Object.freeze(()=>{if(ended)return;ended=true;h.marker={};finish();})});
      observe(()=>h.backend.capture(image),(failed,value)=>{settled=true;h.ledger.release(work);if(failed)failure(h,'RESOURCE_BACKEND',value);finish();kick(h);});
      return token;
    });
    f.final=undefined;f.retired=true;f.nodes.clear();h.frame=undefined;
    return Object.freeze({descriptor:image.descriptor,generation:image.generation,clockEpoch:image.clockEpoch,version:image.version,capture,release});
  });
}
export function disposeResourceHost(host:ResourceHost):Promise<void> {return startDisposal(getHost(host)).promise;}
export function readResourceStatus(host:ResourceHost):ResourceStatus {
  const h=getHost(host);return Object.freeze({state:h.state,clockEpoch:h.profile.initialClockEpoch,counts:h.ledger.snapshot(),openCallbacks:h.openCallbacks,cleanupPending:h.cleanupPending,releaseFailed:h.failures.length});
}
function retire(a:Allocation):void {
  a.released=true;a.host.ledger.release(a.reservation);a.host.allocations.delete(a);a.descriptor=undefined;a.image=undefined;
}
function kick(h:Host):void {
  if(h.queued)return;h.queued=true;queueMicrotask(()=>{h.queued=false;drain(h);});
}
function drain(h:Host):void {
  if(h.guarded){kick(h);return;}
  if(h.state==='terminal'&&h.openCallbacks===0&&h.producers===0&&!h.slot){
    for(const c of h.caches)releaseCache(c);
    if(h.frame){if(h.frame.final)drop(h.frame.final);h.frame.final=undefined;h.frame.retired=true;h.frame.nodes.clear();h.frame=undefined;}
  }
  // One bounded scan per scheduled drain; no recursively invoked release chain.
  for(const a of h.allocations){
    if(a.holds!==0||a.attempted)continue;
    if(!a.image){retire(a);continue;}
    a.attempted=true;h.cleanupPending++;const image=a.image;
    observe(()=>h.backend.release(image),(failed,value)=>{
      h.cleanupPending--;
      if(failed){failure(h,'RESOURCE_CLEANUP',value);const was=h.guarded;h.guarded=true;let text:string;try{text=message(value);}finally{h.guarded=was;}
        h.failures.push(Object.freeze({code:'RESOURCE_CLEANUP',version:a.version,nodePath:a.path,portId:a.port,message:text}));
      }else retire(a);
      kick(h);
    });
  }
  if(!h.disposal||h.disposalSettled)return;
  const c=h.ledger.snapshot();if(h.openCallbacks||h.slot||h.producers||c.backend||c.inputs||c.frames||c.captures||h.cleanupPending)return;
  if(c.allocations===0){h.state='drained';h.disposalSettled=true;h.disposal.resolve();}
  else if(h.failures.length===c.allocations){
    const primary=h.primary??error('RESOURCE_CLEANUP','Resource cleanup failed');const result=error(primary.code,primary.message);
    Object.defineProperties(result,{unreclaimed:{value:c.allocations,enumerable:true},cleanupFailures:{value:Object.freeze([...h.failures]),enumerable:true}});
    h.disposalSettled=true;h.disposal.reject(result);
  }
}
