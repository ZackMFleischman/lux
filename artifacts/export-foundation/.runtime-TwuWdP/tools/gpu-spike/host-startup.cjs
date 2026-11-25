class HostStartup {
  constructor({revisionId,init,promote,update,observe,stopped}) {
    Object.assign(this,{revisionId,init,promote,update,observe,stopped});
    this.ready=false;this.busy=false;this.failed=false;this.last=undefined;
  }
  async apply(value) {
    if(value===null||this.busy||this.failed||this.stopped())return;
    if(!Number.isFinite(value)||value<0||value>1)throw Error('Invalid host snapshot');
    if(this.ready&&value===this.last)return;
    this.busy=true;
    try {
      this.observe(value);
      if(!this.ready){
        const result=await this.init(value);
        if(this.stopped())return;
        if(result.type!=='ready'||result.intensity!==value||result.frameId!=='1'||result.revisionId!==this.revisionId)throw Error('Initial host control/frame acknowledgement mismatch');
        this.ready=true;this.last=value;this.promote(result,value);
      }else{await this.update(value);this.last=value;}
    }catch(error){this.failed=true;throw error;}
    finally{this.busy=false;}
  }
}
module.exports={HostStartup};
