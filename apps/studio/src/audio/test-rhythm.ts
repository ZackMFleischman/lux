// A local generated input, never a device ID or a source URL.
export const testRhythmInput=Object.freeze({id:'lux:test-rhythm',label:'Test rhythm'});

export function createTestRhythm(context:AudioContext){
  const buffer=context.createBuffer(1,Math.round(context.sampleRate*8),context.sampleRate);
  const samples=buffer.getChannelData(0),notes=[220,261.6256,329.6276,293.6648];
  let random=0x1a2b3c4d;
  for(let index=0;index<samples.length;index++){
    const time=index/context.sampleRate,kickTime=time%.5,hatTime=time%.25,noteTime=time%.5;
    // A short pitch-dropping kick, alternating closed/open hats, and a changing arpeggio.
    const kick=.65*Math.sin(2*Math.PI*(48*kickTime+4*(1-Math.exp(-40*kickTime))))*Math.exp(-24*kickTime);
    random=(Math.imul(random,1664525)+1013904223)>>>0;
    const hat=(random/0x80000000-1)*.14*Math.exp(-hatTime*(Math.floor(time*4)%2?45:100));
    const frequency=notes[Math.floor(time/2)%notes.length]!*(Math.floor(time*2)%2?1.5:1);
    const note=.14*Math.sin(2*Math.PI*frequency*noteTime)*Math.min(1,noteTime/.01)*Math.exp(-7*noteTime);
    samples[index]=kick+hat+note;
  }
  const source=context.createBufferSource(),destination=context.createMediaStreamDestination();
  source.buffer=buffer;source.loop=true;
  let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;try{source.stop();}catch{}try{source.disconnect();}catch{}};
  try{source.connect(destination);source.start();return {stream:destination.stream,context,dispose};}
  catch(error){dispose();for(const track of destination.stream.getTracks())track.stop();throw error;}
}
