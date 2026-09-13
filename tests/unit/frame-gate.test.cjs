const test=require('node:test'),assert=require('node:assert/strict');
const {ControlledFrameGate}=require('../../tools/gpu-spike/frame-gate.cjs');
test('controlled compositor admission permits one paint per completed worker draw and never claims proof',()=>{
 const gate=new ControlledFrameGate({revisionId:'a'.repeat(64),schemaHash:'b'.repeat(64),count:2});
 assert.equal(gate.consumePaint(),null);assert.equal(gate.begin(),true);assert.equal(gate.begin(),false);assert.equal(gate.consumePaint(),null);
 gate.acknowledge({revisionId:'a'.repeat(64),frameId:'1',controlSequence:0,controlSchemaHash:'b'.repeat(64)},[0.2,0.8]);
 const claim=gate.consumePaint();assert.equal(claim.correlation,'producer-claim-unverified');assert.deepEqual(claim.normalized,[0.2,0.8]);assert.equal(gate.consumePaint(),null);assert.equal(gate.begin(),true);
 assert.throws(()=>gate.acknowledge({revisionId:'a'.repeat(64),frameId:'1',controlSequence:0,controlSchemaHash:'b'.repeat(64)},[0.2,0.8]),/frame/);
});
