class FrameProgress {
  constructor(){this.frame=0n;this.changedAt=null;}
  observe(frameId,now){
    if(typeof frameId!=='string'||!/^\d{1,20}$/.test(frameId))return;
    const frame=BigInt(frameId);
    if(frame>this.frame){this.frame=frame;this.changedAt=now;}
  }
  expired(now){return this.changedAt!==null&&now-this.changedAt>2000;}
}
module.exports={FrameProgress};
