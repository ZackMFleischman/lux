import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectReceiverWorkerTiming as inspect} from '../../tools/gpu-spike/receiver-worker-timing-inspect.mjs';
const id='a'.repeat(32),frequency='1000';
const envelope=()=>({start:'100',end:'200',frequency});
const record=(stage,start,end,sequence,bound=true)=>({kind:'receiver-worker-timing',instanceId:id,sequence,stage,start,end,generation:bound?2:0,outputGeneration:bound?3:0,frameId:bound?'4':'0',boundFrame:bound,complete:true,...(stage.endsWith('sleep')?{requestedSleepMs:1}:{})});
const summary=count=>({kind:'receiver-worker-timing-summary',instanceId:id,domain:'qpc',frequency,capacity:32768,recorded:count,attempted:count,lostRecords:0,clockFailures:0,incompleteSpans:0,allocationFailed:false,aborted:false,valid:true});
const fixture=()=>[record('outer-sleep','100','116',1,false),summary(1)];
const run=rows=>inspect(rows,id,frequency,envelope());
test('requested 1 ms can take 16 ms; missing stages remain unavailable and GPU duration is false',()=>{
 const result=run(fixture());assert.equal(result.stages['outer-sleep'].medianMs,16);assert.equal(result.stages['outer-sleep'].p95Ms,16);assert.equal(result.gpuDurationMeasured,false);
 assert.deepEqual(result.stages['nv-lock'],{count:0,medianMs:null,p95Ms:null,maxMs:null});
});
test('all five stages accept nested completion order and envelope boundary equality',()=>{
 const rows=[record('outer-sleep','100','116',1,false),record('local-copy-poll-sleep','120','136',2),record('copy-submit-to-query-done','116','140',3),record('nv-lock','140','150',4),record('gl-fence-to-ready','150','200',5),summary(5)];
 const result=run(rows);for(const stage of Object.values(result.stages))assert.equal(stage.count,1);
 assert.equal(result.stages['copy-submit-to-query-done'].maxMs,24);
});
test('missing, duplicate, unknown and truncated output is rejected',()=>{
 for(const change of [r=>r.pop(),r=>r.shift(),r=>r.push(r[1]),r=>r.splice(1,0,r[0]),r=>r[0].kind='other',r=>r[0].stage='gpu',r=>r[0]=null,r=>r[1]=undefined]){const r=fixture();change(r);assert.throws(()=>run(r));}
 for(const rows of [[],{},null,Array(32770).fill({})])assert.throws(()=>run(rows));
 const line=JSON.stringify(fixture()[0]);assert.throws(()=>JSON.parse(line.slice(0,12)));assert.throws(()=>run([JSON.parse(line)]));
});
test('canonical uint64 ticks reject coercion, noncanonical, negative and overflowing representations',()=>{
 for(const value of [0,100,100n,null,undefined,{},[],true,'','01','+1','-1','1.0','1e3',' 1','1 ','18446744073709551616']){
  for(const field of ['start','end','frameId']){const rows=fixture();rows[0][field]=value;assert.throws(()=>run(rows));}
  assert.throws(()=>inspect(fixture(),id,value,{...envelope(),frequency:value}));
 }
 for(const value of ['0']){const rows=fixture();rows[0].start=value;assert.throws(()=>run(rows));assert.throws(()=>inspect(rows,id,value,{...envelope(),frequency:value}));}
});
test('strict counts, generations, sequences, booleans and identities cannot be coerced',()=>{
 for(const field of ['generation','outputGeneration','sequence'])for(const value of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'1',null]){const r=fixture();r[0][field]=value;assert.throws(()=>run(r));}
 for(const field of ['recorded','attempted','capacity','lostRecords','clockFailures','incompleteSpans'])for(const value of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'1',null]){const r=fixture();r[1][field]=value;assert.throws(()=>run(r));}
 for(const field of ['boundFrame','complete'])for(const value of ['true',1,null,undefined]){const r=fixture();r[0][field]=value;assert.throws(()=>run(r));}
 for(const field of ['aborted','allocationFailed','valid'])for(const value of ['false',0,null,undefined]){const r=fixture();r[1][field]=value;assert.throws(()=>run(r));}
 for(const identity of ['',id.toUpperCase(),id+'a','b'.repeat(32),1]){for(const index of [0,1]){const r=fixture();r[index].instanceId=identity;assert.throws(()=>run(r));}}
 assert.throws(()=>inspect(fixture(),1,frequency,envelope()));
});
test('invalid completeness and accounting never becomes a valid summary',()=>{
 for(const [index,field,value] of [[0,'complete',false],[0,'sequence',2],[1,'recorded',0],[1,'attempted',2],[1,'lostRecords',1],[1,'clockFailures',1],[1,'incompleteSpans',1],[1,'allocationFailed',true],[1,'aborted',true],[1,'valid',false],[1,'frequency','2'],[1,'domain','cpu']]){const r=fixture();r[index][field]=value;assert.throws(()=>run(r));}
});
test('independent child envelope is mandatory, frequency matched, and contains every whole span',()=>{
 for(const env of [undefined,null,{}, {...envelope(),frequency:'1'},{...envelope(),start:'0'},{...envelope(),end:'99'},{...envelope(),start:100}])assert.throws(()=>inspect(fixture(),id,frequency,env));
 for(const [start,end] of [['99','116'],['100','201'],['117','116']]){const r=fixture();Object.assign(r[0],{start,end});assert.throws(()=>run(r));}
 const rows=[record('outer-sleep','100','150',1,false),record('outer-sleep','110','140',2,false),summary(2)];assert.throws(()=>run(rows));
});
test('binding and requested sleep have exact stage semantics',()=>{
 for(const change of [r=>r[0].generation=1,r=>r[0].outputGeneration=1,r=>r[0].frameId='1',r=>r[0].boundFrame=true,r=>r[0].requestedSleepMs=0,r=>r[0].requestedSleepMs='1',r=>delete r[0].requestedSleepMs,r=>r[0].stage='nv-lock']){const r=fixture();change(r);assert.throws(()=>run(r));}
 const rows=[record('nv-lock','100','116',1),summary(1)];rows[0].requestedSleepMs=1;assert.throws(()=>run(rows));
});
test('capacity equality is bounded and the next row cannot be hidden',()=>{
 const rows=Array.from({length:32768},(_,i)=>record('outer-sleep','100','116',i+1,false));rows.push(summary(32768));assert.equal(run(rows).recorded,32768);rows.splice(0,0,rows[0]);assert.throws(()=>run(rows));
});
test('captured native production-formatted output joins the strict inspector', {skip:!process.env.LUX_TIMING_CPU_FIXTURE},()=>{
 const rows=readFileSync(process.env.LUX_TIMING_CPU_FIXTURE,'utf8').trim().split(/\r?\n/).map(line=>JSON.parse(line));assert.equal(run(rows).stages['outer-sleep'].maxMs,16);
 const failed=readFileSync(process.env.LUX_TIMING_CPU_FIXTURE.replace('native-fixture.jsonl','native-failed-flush-fixture.jsonl'),'utf8').trim().split(/\r?\n/).map(line=>JSON.parse(line));assert.throws(()=>run(failed));
});
