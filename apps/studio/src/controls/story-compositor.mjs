const freeze=Object.freeze,RuntimeError=Error,RuntimePromise=Promise,promiseResolve=RuntimePromise.resolve.bind(RuntimePromise),allSettled=RuntimePromise.allSettled.bind(RuntimePromise),call=Function.prototype.call,promiseThen=call.bind(RuntimePromise.prototype.then),apply=Reflect.apply,finite=Number.isFinite;
const rgbaFormat=1023,unsignedByteType=1009;

export function createStoryCompositor({WebGPU,TSL,renderer,device,width,height}){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw new RuntimeError('Invalid Story compositor dimensions');
 const slotOptions={format:rgbaFormat,type:unsignedByteType,depthBuffer:true,stencilBuffer:false,samples:0,count:1,depth:1};
 const compositionOptions={format:rgbaFormat,type:unsignedByteType,depthBuffer:false,stencilBuffer:false,samples:0,count:1,depth:1};
 const slots=[new WebGPU.RenderTarget(width,height,slotOptions),new WebGPU.RenderTarget(width,height,slotOptions)];
 const compositions=[new WebGPU.RenderTarget(width,height,compositionOptions),new WebGPU.RenderTarget(width,height,compositionOptions)];
 for(let index=0;index<4;index++){const target=index<2?slots[index]:compositions[index-2];target.texture.colorSpace=WebGPU.SRGBColorSpace;target.texture.generateMipmaps=false;}
 const weights=[TSL.uniform(0),TSL.uniform(0)];
 const fadeMaterial=new WebGPU.MeshBasicNodeMaterial();
 fadeMaterial.fragmentNode=TSL.texture(slots[0].texture).mul(weights[0]).add(TSL.texture(slots[1].texture).mul(weights[1]));
 fadeMaterial.transparent=false;fadeMaterial.depthTest=false;fadeMaterial.depthWrite=false;fadeMaterial.toneMapped=false;
 const fadeQuad=new WebGPU.QuadMesh(fadeMaterial),copyMaterials=[],copyQuads=[];
 for(let index=0;index<2;index++){const material=new WebGPU.MeshBasicNodeMaterial();material.fragmentNode=TSL.texture(compositions[index].texture);material.transparent=false;material.depthTest=false;material.depthWrite=false;material.toneMapped=false;copyMaterials[index]=material;copyQuads[index]=new WebGPU.QuadMesh(material);}
 let frontIndex=0,pendingIndex=null,disposed=false,disposal,chargedBytes=24*width*height;
 const setRenderTarget=renderer.setRenderTarget,readPixels=renderer.readRenderTargetPixelsAsync,queueDone=device.queue.onSubmittedWorkDone;
 const fadeRender=fadeQuad.render,copyRenders=[copyQuads[0].render,copyQuads[1].render];
 const disposeRows=[fadeMaterial,copyMaterials[0],copyMaterials[1],slots[0],slots[1],compositions[0],compositions[1]].map(value=>freeze({value,dispose:value.dispose}));
 function requireOpen(){if(disposed)throw new RuntimeError('Story compositor is disposed');}
 function slotTarget(index){requireOpen();if(index!==0&&index!==1)throw new RuntimeError('Invalid Story slot target');return slots[index];}
 async function compose(rows){
  requireOpen();if(pendingIndex!==null)throw new RuntimeError('Story composition is awaiting presentation');weights[0].value=0;weights[1].value=0;
  for(let index=0;index<rows.length;index++){const row=rows[index];if((row.targetIndex!==0&&row.targetIndex!==1)||typeof row.weight!=='number'||!finite(row.weight)||row.weight<0||row.weight>1)throw new RuntimeError('Invalid Story composition row');weights[row.targetIndex].value=row.weight;}
  const workingIndex=1-frontIndex;apply(setRenderTarget,renderer,[compositions[workingIndex]]);try{apply(fadeRender,fadeQuad,[renderer]);}finally{apply(setRenderTarget,renderer,[null]);}await apply(queueDone,device.queue,[]);pendingIndex=workingIndex;
 }
 async function present(){requireOpen();if(pendingIndex===null)throw new RuntimeError('Story composition is not ready to present');const index=pendingIndex;apply(setRenderTarget,renderer,[null]);apply(copyRenders[index],copyQuads[index],[renderer]);await apply(queueDone,device.queue,[]);frontIndex=index;pendingIndex=null;}
 async function capture(){requireOpen();return apply(readPixels,renderer,[compositions[frontIndex],0,0,width,height]);}
 function dispose(){
  if(disposal)return disposal;disposed=true;
  disposal=(async()=>{await apply(queueDone,device.queue,[]);const operations=[];for(let index=0;index<disposeRows.length;index++){const row=disposeRows[index];operations[index]=promiseThen(promiseResolve(),()=>row.dispose?apply(row.dispose,row.value,[]):undefined);}const results=await allSettled(operations);let failure;for(let index=0;index<results.length;index++)if(results[index].status==='rejected'){failure=results[index];break;}if(failure)throw failure.reason;chargedBytes=0;})();return disposal;
 }
 return freeze({slotTarget,compose,present,capture,frontTarget:()=>compositions[frontIndex],weights:()=>freeze([weights[0].value,weights[1].value]),dispose,status:()=>freeze({storyTargetBytes:chargedBytes})});
}
