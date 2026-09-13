// Routine observations only: these summaries never certify hardware budgets.
// Capture intrinsics before submitted visual code can replace globals/prototypes.
const freeze=Object.freeze, finite=Number.isFinite, integer=Number.isSafeInteger;
const ceil=Math.ceil, max=Math.max, sort=Function.call.bind(Array.prototype.sort),push=Function.call.bind(Array.prototype.push);
const FloatBuffer=Float64Array;
export const LIVE_LIMITS=freeze({records:4096,windowMs:120000,summaryMs:500});

export function createFrameCollector({startMs,capacity=4096,windowMs=120000}={}) {
  if(!finite(startMs)||startMs<0||!integer(capacity)||capacity<1||capacity>4096||!integer(windowMs)||windowMs<1||windowMs>120000)throw Error('Invalid bounded collector options');
  // time, frame, update, synchronous render call, queue wait, async, render await.
  const records=new FloatBuffer(capacity*7);
  let count=0,completed=0,lost=0,invalid=0,totalLost=0,totalInvalid=0,lastFrame=0,lastAt=startMs,windowStart=startMs,sequence=0;
  const distribution=(values,expected,reason)=>{
    const n=values.length,missing=max(0,expected-n);
    const base={unit:'ms',availability:n?'available':'pending',sampleCount:n,expectedCount:expected,missingCount:missing,
      samplingPolicy:'all completed frames in this summary interval',validity:missing||reason?'incomplete':'complete',gate:'not_evaluated'};
    if(reason)base.reason=reason;
    if(n){sort(values,(a,b)=>a-b);base.p50=values[ceil(n*.5)-1];base.p95=values[ceil(n*.95)-1];base.p99=values[ceil(n*.99)-1];base.max=values[n-1];}
    return freeze(base);
  };
  return freeze({
    record(at,frame,update,renderCall,queueWait,asyncRender,renderAwait=0) {
      if(!finite(at)||at<lastAt||!integer(frame)||frame<=lastFrame) {
        invalid++;totalInvalid++;return false;
      }
      lastAt=at;lastFrame=frame;
      if(!finite(update)||update<0||!finite(renderCall)||renderCall<0||!finite(queueWait)||queueWait<0||!finite(renderAwait)||renderAwait<0||typeof asyncRender!=='boolean') {
        invalid++;totalInvalid++;return false;
      }
      completed++;
      if(count===capacity){lost++;totalLost++;return false;}
      const i=count++*7;
      records[i]=at;records[i+1]=frame;records[i+2]=update;records[i+3]=renderCall;records[i+4]=queueWait;records[i+5]=asyncRender?1:0;records[i+6]=renderAwait;
      return true;
    },
    summary(now,{timestampQuerySupported=null,timestampQueryEnabled=false}={}) {
      if(!finite(now)||now<lastAt||now<windowStart)throw Error('Collector clock must be monotonic');
      const update=[],render=[],cpu=[],wait=[],awaited=[];
      let asyncCount=0,expired=0;
      for(let row=0;row<count;row++) {
        const i=row*7;if(records[i]<now-windowMs){expired++;continue;}
        push(update,records[i+2]);push(render,records[i+3]);push(cpu,records[i+2]+records[i+3]);push(wait,records[i+4]);push(awaited,records[i+6]);asyncCount+=records[i+5];
      }
      const expected=completed+invalid,reason=lost||invalid||expired?'Telemetry lost, invalid or expired; duration distribution is incomplete':undefined;
      const elapsed=now-windowStart;
      const result=freeze({schemaVersion:1,mode:'routine',sequence:++sequence,clockDomain:'dedicated-worker-monotonic-ms',windowStartMs:windowStart,windowEndMs:now,
        lostRecords:totalLost,invalidRecords:totalInvalid,intervalLostRecords:lost,intervalInvalidRecords:invalid,retainedRecords:cpu.length,
        produced:freeze({unit:'Hz',availability:elapsed>0?'available':'pending',...(elapsed>0?{value:completed*1000/elapsed}:{}),sampleCount:completed,expectedCount:completed+invalid,missingCount:invalid,
          samplingPolicy:'completed frames over independent summary interval',validity:invalid?'incomplete':'complete',gate:'not_evaluated'}),
        update:distribution(update,expected,reason),renderCall:distribution(render,expected,reason),
        cpuCall:distribution(cpu,expected,asyncCount?'Asynchronous render continuation CPU work is not fully measured':reason),
        renderAwait:distribution(awaited,expected,reason),queueWait:distribution(wait,expected,reason),
        gpu:freeze({unit:'ms',availability:'unsupported',reason:'Full visual GPU pass coverage is unavailable; queue completion wait is not GPU duration',sampleCount:0,expectedCount:completed,missingCount:completed,
          samplingPolicy:'none',validity:'incomplete',gate:'not_evaluated',timestampQuerySupported,timestampQueryEnabled}),
      });
      count=0;completed=0;lost=0;invalid=0;windowStart=now;
      return result;
    },
  });
}
