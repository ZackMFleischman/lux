import fs from 'node:fs';const p='tests/studio/runtime-lifecycle.test.ts';let s=fs.readFileSync(p,'utf8');const start=s.indexOf("test('silent authored candidate"),end=s.indexOf("test('paused stalled commands",start);s=s.slice(0,start)+`test('candidate loading has no heartbeat or activation deadline and retains the previous preview',async t=>{
 const f=fixture(t),old=await f.start();old.reply({playback:'paused'});const previous=f.client.getSnapshot().authoring;
 const pending=f.client.submit(source);pending.catch(()=>{});await f.flush();const candidate=WorkerFixture.all.at(-1)!;
 candidate.reply({type:'startup-progress',stage:'admission'});
 for(let i=0;i<40;i++){await f.advance(250);old.reply({type:'heartbeat'});}
 assert.equal(candidate.terminated,false);assert.equal(old.terminated,false);assert.equal(f.client.getSnapshot().authoring,previous);
 candidate.reply({type:'heartbeat'});candidate.reply({type:'startup-progress',stage:'shader-compile'});
 for(let i=0;i<40;i++){await f.advance(250);old.reply({type:'heartbeat'});}
 assert.equal(candidate.terminated,false);candidate.reply({type:'ready'});await pending;
 assert.equal(old.terminated,true);assert.equal(f.client.getSnapshot().authoring!.generation,candidate.init.generation);
});

test('an explicit startup failure still terminates the candidate and retains the accepted preview',async t=>{
 const f=fixture(t),old=await f.start();old.reply({playback:'paused'});const previous=f.client.getSnapshot().authoring;
 const rejected=assert.rejects(f.client.submit(source),/actual asset failure/);await f.flush();const candidate=WorkerFixture.all.at(-1)!;
 candidate.reply({type:'failure',message:'actual asset failure'});await rejected;
 assert.equal(candidate.terminated,true);assert.equal(old.terminated,false);assert.equal(f.client.getSnapshot().authoring,previous);
});

`+s.slice(end);
const tail=s.indexOf("test('startup failure identifies");s=s.slice(0,tail)+`test('startup stage progress is visible while slow loading remains active',async t=>{
 const f=fixture(t);const pending=f.client.submit(source);pending.catch(()=>{});await f.flush();const candidate=WorkerFixture.all.at(-1)!;
 candidate.reply({type:'startup-progress',stage:'shader-compile'});await f.advance(30000);
 assert.equal(candidate.terminated,false);assert.match(f.client.getSnapshot().jobs[0]!.summary,/shader-compile/);
 candidate.reply({type:'ready'});await pending;await f.advance(1250);assert.equal(candidate.terminated,true,'the accepted runtime still has its heartbeat watchdog');
});
`;
fs.writeFileSync(p,s);
