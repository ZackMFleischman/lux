import {appendFileSync,mkdirSync,renameSync,statSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';

const maxRecordBytes=8192;
export function diagnosticLocation(directory){const folder=join(directory,'logs');return {path:join(folder,'studio.jsonl'),previousPath:join(folder,'studio.previous.jsonl'),maxFileBytes:256*1024,retainedFiles:2};}
// Keep bounded diagnostic explanations, never request/source payloads or code frames.
function safeMessage(value){
 return String(value).slice(0,16384).split(/\r?\n/)
  .filter(line=>!/^\s*(?:\d+\s*\||[|^~]+|(?:source|files|assets|headers)\s*[:=]|[{[])/i.test(line))
  .filter(line=>!/["']?(?:source|files|assets)["']?\s*:/.test(line))
  .join('\n').replace(/data:[^\s"']+/gi,'[data]')
  .replace(/(?:["']?(?:authorization|token|password|passwd|secret|api[_-]?key|deviceId|groupId)["']?\s*[:=]\s*)(?:Bearer\s+)?(?:"[^"\n]*"|'[^'\n]*'|[^\s,;}]+)/gi,'[credential]')
  .replace(/\bBearer\s+[^\s"']+/gi,'[credential]')
  .replace(/(?:[A-Za-z]:[\\/]|file:\/\/\/|\/(?!\/)[A-Za-z0-9_.-]+\/)[^\s"'<>]+/g,'[path]')
  .replace(/\b[A-Za-z0-9_+/=-]{48,}\b/g,'[long-value]').slice(0,4096);
}
/** Arbitrary child output may dump authored payloads: retain recognized native causes only. */
export function summarizeCompilerStderr(text){
 const code=String(text).match(/\b(ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|EACCES|EPERM|ENOENT|ENOMEM|ERR_OUT_OF_MEMORY)\b/)?.[1];
 const name=String(text).match(/\b(SyntaxError|ReferenceError|TypeError|RangeError)\b/)?.[1];
 return {stage:'compiler-stderr',stderrTailBytes:Buffer.byteLength(text),...(code?{code}:{}),...(name?{errorName:name}:{}),
  message:code?'Compiler native failure: '+code:name?'Compiler exception: '+name:'Compiler wrote diagnostic output; inspect structured compile diagnostics and exit status'};
}
/** Local metadata only. Never pass request bodies, source, assets, headers or audio identity. */
export function createStudioDiagnostics({directory,sessionId,maxBytes=256*1024}){
 const location=diagnosticLocation(directory);maxBytes=Math.min(location.maxFileBytes,Math.max(1024,maxBytes));
 let writable=null;
 return {location,status:()=>({...location,writable}),write(event,details={}){
  try{
   const record={timestamp:new Date().toISOString(),sessionId,event:String(event).slice(0,80)};
   for(const key of ['operationId','command','stage','code','signal','elapsedMs','line','column','errorName','stderrTailBytes','exitCode']){
    const value=details[key];if(typeof value==='string'||typeof value==='number')record[key]=typeof value==='string'?String(value).replace(/[^A-Za-z0-9._: -]/g,'').slice(0,160):value;
   }
   if(typeof details.file==='string'&&/^[A-Za-z0-9_-][A-Za-z0-9_./-]{0,179}\.[cm]?[jt]sx?$/.test(details.file)&&!details.file.split('/').includes('..'))record.file=details.file;
   if(details.message!==undefined)record.message=safeMessage(details.message);
   let line=JSON.stringify(record)+'\n';
   // Bound UTF-8 bytes as well as characters. No partial JSON writes.
   if(Buffer.byteLength(line)>Math.min(maxRecordBytes,maxBytes)){record.message='Diagnostic exceeded record limit';line=JSON.stringify(record)+'\n';}
   mkdirSync(join(directory,'logs'),{recursive:true});
   let size=0;try{size=statSync(location.path).size;}catch(error){if(error.code!=='ENOENT')throw error;}
   if(size+Buffer.byteLength(line)>maxBytes){try{unlinkSync(location.previousPath);}catch(error){if(error.code!=='ENOENT')throw error;}renameSync(location.path,location.previousPath);}
   appendFileSync(location.path,line,{encoding:'utf8',mode:0o600});writable=true;
  }catch{writable=false;}
 }};
}
