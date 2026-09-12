const fs = require('node:fs/promises');
// Bounded asynchronous append queue. A slow disk drops records, never blocks GPU callbacks.
class Recorder {
  constructor(filename, capacity=4096) {
    this.capacity=capacity; this.queue=[];this.lost=0;this.error=null;this.busy=false;
    this.ready=fs.open(filename,'wx');
    this.timer=setInterval(()=>this.flush(),20);
  }
  record(value) {
    if(this.queue.length>=this.capacity){this.lost++;return;}
    this.queue.push(value);
  }
  async flush() {
    if(this.busy||!this.queue.length||this.error)return;
    this.busy=true;
    const batch=this.queue.splice(0,512);
    try {const file=await this.ready;await file.write(batch.map(value=>JSON.stringify(value)+'\n').join(''));}
    catch(error){this.error=String(error);this.lost+=batch.length;}
    finally {this.busy=false;}
  }
  async close() {
    clearInterval(this.timer);
    while(this.busy||this.queue.length&&!this.error){await this.flush();await new Promise(resolve=>setTimeout(resolve,5));}
    const file=await this.ready;await file.close();
    return {lost:this.lost,error:this.error,remaining:this.queue.length};
  }
}
module.exports={Recorder};
