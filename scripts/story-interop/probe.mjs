window.runStoryInterop=({capsule,width=64,height=64})=>new Promise((resolve,reject)=>{
 const canvas=document.querySelector('canvas');canvas.width=width;canvas.height=height;const worker=new Worker('./dist/probe-worker.js',{type:'module'}),timer=setTimeout(()=>{worker.terminate();reject(Error('Story interop probe exceeded 20 seconds'));},20000);
 worker.onmessage=({data})=>{if(data.type==='failure'){clearTimeout(timer);worker.terminate();resolve(data);return;}if(data.type==='result'){clearTimeout(timer);worker.terminate();resolve({...data,results:data.results.map(row=>({...row,png:Array.from(row.png)}))});}};
 worker.onerror=event=>{clearTimeout(timer);worker.terminate();reject(Error(event.message));};const offscreen=canvas.transferControlToOffscreen();worker.postMessage({type:'run',capsule,width,height,canvas:offscreen},[offscreen]);
});
