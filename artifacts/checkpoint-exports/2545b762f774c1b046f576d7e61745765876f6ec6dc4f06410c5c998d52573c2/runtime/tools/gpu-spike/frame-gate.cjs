'use strict';
// Diagnostic serialization only. OSR gives no worker-frame tag. A single draw
// and one admitted paint narrows correspondence but cannot prove no older
// compositor texture was queued; retain the explicit unverified classification.
class ControlledFrameGate{
 constructor({revisionId,schemaHash,count}){Object.assign(this,{revisionId,schemaHash,count});this.state='idle';this.lastFrame=0n;this.claim=null;}
 begin(){if(this.state!=='idle')return false;this.state='drawing';return true;}
 acknowledge(frame,normalized){
  if(this.state!=='drawing'||frame.revisionId!==this.revisionId||frame.controlSchemaHash!==this.schemaHash||!/^\d{1,20}$/.test(frame.frameId)||BigInt(frame.frameId)<=this.lastFrame||!Number.isSafeInteger(frame.controlSequence)||frame.controlSequence<0)throw Error('Controlled frame acknowledgement mismatch');
  if(!Array.isArray(normalized)||normalized.length!==this.count||normalized.some(x=>!Number.isFinite(x)||x<0||x>1))throw Error('Invalid controlled normalized snapshot');
  this.lastFrame=BigInt(frame.frameId);this.claim=Object.freeze({correlation:'producer-claim-unverified',revisionId:this.revisionId,schemaHash:this.schemaHash,frameId:frame.frameId,controlSequence:String(frame.controlSequence),normalized:Object.freeze([...normalized])});this.state='painting';
 }
 consumePaint(){if(this.state!=='painting')return null;const result=this.claim;this.claim=null;this.state='idle';return result;}
 get busy(){return this.state!=='idle';}
}
module.exports={ControlledFrameGate};
