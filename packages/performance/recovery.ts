export type RecoveryTarget=Readonly<{instanceId:string;generation:number;revisionId:string;controlSchemaHash:string;controlSequence:number;controls:Readonly<Record<string,number>>}>;
export type RecoveryEvidence=Readonly<{
 schemaVersion:1;provenance:'synthetic'|'recorded';clockDomain:'harness-monotonic-ms';
 injectedAtMs:number;stopRequestedAtMs:number|null;stopObservedAtMs:number|null;restartRequestedAtMs:number|null;
 target:RecoveryTarget;consumed:(RecoveryTarget&Readonly<{atMs:number;frameId:string;referenceImageConfirmed:boolean}>)|null;
 hostResponsive:boolean;sourceIntact:boolean;lostRecords:number;incomplete:boolean;
}>;
type Gate=Readonly<{gate:'pass'|'fail'|'unavailable';reason:string;durationMs?:number}>;
export type RecoveryResult=Readonly<{hardwareAcceptance:'unavailable';watchdog:Gate;recovery:Gate}>;
const number=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const integer=(v:unknown):v is number=>number(v)&&Number.isSafeInteger(v);
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=128;
function target(v:any):boolean {
 if(!v||!id(v.instanceId)||!id(v.revisionId)||!id(v.controlSchemaHash)||!integer(v.generation)||!integer(v.controlSequence)||!v.controls||typeof v.controls!=='object'||Array.isArray(v.controls))return false;
 const keys=Object.keys(v.controls);return keys.length<=32&&keys.every(k=>id(k)&&number(v.controls[k])&&v.controls[k]<=1);
}
const gate=(state:Gate['gate'],reason:string,durationMs?:number):Gate=>Object.freeze({gate:state,reason,...(durationMs===undefined?{}:{durationMs})});
/** CPU validation of one independently recorded recovery attempt. Inert bounded
 * parsed input only. Native QPC endpoints must be normalized from one validated
 * frequency using BigInt differences before conversion; wall clocks are invalid.
 * This does not attest provenance or certify the full hardware workload. */
export function evaluateRecovery(raw:unknown):RecoveryResult {
 const e=raw as RecoveryEvidence;
 const invalid=()=>Object.freeze({hardwareAcceptance:'unavailable' as const,watchdog:gate('unavailable','Invalid or incomplete recovery evidence'),recovery:gate('unavailable','Invalid or incomplete recovery evidence')});
 if(!e||e.schemaVersion!==1||!['synthetic','recorded'].includes(e.provenance)||e.clockDomain!=='harness-monotonic-ms'||
  !number(e.injectedAtMs)||!target(e.target)||!integer(e.lostRecords)||e.lostRecords!==0||e.incomplete!==false||
  e.hostResponsive!==true||e.sourceIntact!==true)return invalid();
 for(const time of [e.stopRequestedAtMs,e.stopObservedAtMs,e.restartRequestedAtMs])if(time!==null&&(!number(time)||time<e.injectedAtMs))return invalid();
 if(e.stopObservedAtMs!==null&&e.stopRequestedAtMs!==null&&e.stopObservedAtMs<e.stopRequestedAtMs)return invalid();
 if(e.consumed!==null&&(!target(e.consumed)||!number(e.consumed.atMs)||!/^([1-9]\d{0,19})$/.test(e.consumed.frameId)||typeof e.consumed.referenceImageConfirmed!=='boolean'||e.restartRequestedAtMs===null||e.consumed.atMs<e.restartRequestedAtMs))return invalid();
 const stop=e.stopObservedAtMs===null?undefined:e.stopObservedAtMs-e.injectedAtMs;
 const watchdog=stop===undefined?gate('unavailable','Execution stop was not independently observed'):gate(stop<=2000?'pass':'fail','Injection to independently observed execution stop',stop);
 let recovery:Gate;
 if(e.restartRequestedAtMs===null||e.consumed===null)recovery=gate('unavailable','No independently observed recovered host frame');
 else {
  const a=e.target,b=e.consumed,keys=Object.keys(a.controls),elapsed=b.atMs-e.restartRequestedAtMs;
  const matches=['instanceId','generation','revisionId','controlSchemaHash','controlSequence'].every(k=>(a as any)[k]===(b as any)[k])&&
   Object.keys(b.controls).length===keys.length&&keys.every(k=>a.controls[k]===b.controls[k])&&b.referenceImageConfirmed;
  recovery=gate(matches&&elapsed<=5000?'pass':'fail',matches?'Restart to reference frame with exact current host controls':'Recovered frame does not match current host identity, values or reference image',elapsed);
 }
 return Object.freeze({hardwareAcceptance:'unavailable',watchdog,recovery});
}
