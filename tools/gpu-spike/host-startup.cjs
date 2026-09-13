class HostStartup {
  constructor({revisionId,schema,schemaHash,init,promote,update,observe,stopped}) {
    Object.assign(this,{revisionId,schema,schemaHash,init,promote,update,observe,stopped});
    this.ready=false;this.busy=false;this.failed=false;this.last=undefined;
  }
  async apply(value) {
    if(value===null||this.busy||this.failed||this.stopped())return;
    const snapshot=value;
    if(this.schema){
      value=require('./parameter-mapping.cjs').mapHostSnapshot(this.schema,this.schemaHash,snapshot);
      if(this.sequence&&BigInt(snapshot.sequence)<BigInt(this.sequence))throw Error('Stale host snapshot sequence');
    }else if(!Number.isFinite(value)||value<0||value>1)throw Error('Invalid host snapshot');
    const key=JSON.stringify(value);
    if(this.ready&&key===this.last)return;
    this.busy=true;
    try {
      this.observe(value);
      if(!this.ready){
        const result=await this.init(value);
        if(this.stopped())return;
        const matching=this.schema?result.controlSchemaHash===this.schemaHash&&JSON.stringify(result.controls)===key:result.intensity===value;
        if(result.type!=='ready'||!matching||result.frameId!=='1'||result.revisionId!==this.revisionId)throw Error('Initial host control/frame acknowledgement mismatch');
        this.ready=true;this.last=key;this.promote(result,value);
      }else{await this.update(value);this.last=key;}
      if(this.schema)this.sequence=snapshot.sequence;
    }catch(error){this.failed=true;throw error;}
    finally{this.busy=false;}
  }
}
module.exports={HostStartup};
