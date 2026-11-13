import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,statSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createStudioDiagnostics,diagnosticLocation,summarizeCompilerStderr} from '../../scripts/studio-diagnostics.mjs';

test('diagnostics persist bounded rotated records and exclude arbitrary request fields',()=>{
 const directory=mkdtempSync(join(tmpdir(),'lux-logs-'));try {
  const log=createStudioDiagnostics({directory,sessionId:'session-1',maxBytes:2048});
  for(let i=0;i<60;i++)log.write('compile.failed',{operationId:'compile-1',stage:'shader-compile',elapsedMs:9000,attemptMs:8990,file:'src/visual.ts',line:4,column:7,message:'failure '+i+' '.repeat(40),source:'private scene',token:'private token',deviceId:'private device'});
  const location=diagnosticLocation(directory);
  for(const file of [location.path,location.previousPath])assert.ok(statSync(file).size<=2048);
  const records=readFileSync(location.path,'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(records.at(-1).event,'compile.failed');assert.equal(records.at(-1).sessionId,'session-1');assert.ok(Date.parse(records.at(-1).timestamp));
  assert.equal(records.at(-1).stage,'shader-compile');assert.equal(records.at(-1).elapsedMs,9000);assert.equal(records.at(-1).attemptMs,8990);assert.equal(records.at(-1).file,'src/visual.ts');assert.equal(records.at(-1).line,4);assert.equal(records.at(-1).column,7);assert.equal(records.at(-1).operationId,'compile-1');
  assert.doesNotMatch(JSON.stringify(records),/private/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('diagnostic messages strip source frames, paths, credentials, long IDs and data payloads',()=>{
 const directory=mkdtempSync(join(tmpdir(),'lux-logs-'));try{
  const log=createStudioDiagnostics({directory,sessionId:'session-2'});
  log.write('compile.failed',{message:'Error: shader compile failed C:\\Users\\private\\visual.ts:4\n  4 | const secretScene = 1;\nAuthorization: Bearer secret\ntoken=secret-value\ndeviceId=cable-private\ndata:image/png;base64,privateBytes\n'+ 'a'.repeat(64)+' password=hunter2 Unknown identifier secretScene /opt/private/visual.ts\n{"files":{"visual.ts":"private code"}}'});
  const text=readFileSync(log.location.path,'utf8');assert.match(text,/shader compile failed/);assert.match(text,/Unknown identifier secretScene/);assert.doesNotMatch(text,/private|secret-value|privateBytes|a{64}|hunter2/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('diagnostic write failure stays observable and does not throw into the app',()=>{
 const directory=mkdtempSync(join(tmpdir(),'lux-logs-'));try{
  const file=join(directory,'not-a-directory');writeFileSync(file,'');const log=createStudioDiagnostics({directory:file,sessionId:'session-3'});
  assert.doesNotThrow(()=>log.write('startup.failed',{message:'test'}));assert.equal(log.status().writable,false);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('arbitrary child output cannot persist authored JSON payloads through native summaries',()=>{
 const result=summarizeCompilerStderr('payload: {"source":"FULL_SCENE","assets":"ASSET_DATA","deviceId":"short-id"}\nError [ERR_MODULE_NOT_FOUND]: missing dependency');
 assert.equal(result.code,'ERR_MODULE_NOT_FOUND');assert.match(result.message,/ERR_MODULE_NOT_FOUND/);
 assert.doesNotMatch(JSON.stringify(result),/FULL_SCENE|ASSET_DATA|short-id/);
 const directory=mkdtempSync(join(tmpdir(),'lux-logs-'));try{
  const log=createStudioDiagnostics({directory,sessionId:'exit-check'});log.write('compile.exit',{exitCode:1,signal:'SIGTERM',...result});
  const record=JSON.parse(readFileSync(log.location.path,'utf8'));assert.equal(record.exitCode,1);assert.equal(record.code,'ERR_MODULE_NOT_FOUND');assert.equal(record.signal,'SIGTERM');
 }finally{rmSync(directory,{recursive:true,force:true});}
});
