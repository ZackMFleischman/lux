import {prepareAuthoredSharedModules} from '../../apps/studio/src/authored-shared-modules.mjs';
import {prepareWorkerControlState} from '../../apps/studio/src/controls/worker-control-state.mjs';
import {encodeCapturedTarget} from '../../apps/studio/src/capture-png.mjs';

const rgbaFormat=1023,unsignedByteType=1009;
const values=schema=>Object.fromEntries(schema.filter(row=>row.type!=='trigger').map(row=>[row.id,row.default]));
const targetDescription=target=>({width:target.width,height:target.height,colorSpace:'linear-srgb',alphaMode:'premultiplied'});
const compactDescriptor=value=>({label:value.label??null,format:value.format??null,size:Array.isArray(value.size)?value.size:{width:value.size?.width,height:value.size?.height,depthOrArrayLayers:value.size?.depthOrArrayLayers},sampleCount:value.sampleCount??1,mipLevelCount:value.mipLevelCount??1,dimension:value.dimension??'2d'});

self.onmessage=async({data})=>{
 if(data?.type!=='run')return;
 const {capsule,canvas,width,height}=data,textureDescriptors=[];let phase='received';
 let sharedGraph,renderer,device,slotA,slotB,front,working,fadeMaterial,fadeQuad,copyMaterial,copyQuad,cleanupAttempted=false;
 const liveInstances=new Set();
 const cleanupInstances=async()=>{const instances=Array.from(liveInstances);liveInstances.clear();const settled=await Promise.allSettled(instances.map(instance=>Promise.resolve().then(()=>instance.dispose()))),errors=settled.filter(row=>row.status==='rejected').map(row=>row.reason);if(errors.length)throw new AggregateError(errors,'Story interop instance disposal failed');};
 const cleanup=async()=>{if(cleanupAttempted)return;cleanupAttempted=true;const errors=[];try{await device?.queue?.onSubmittedWorkDone();}catch(error){errors.push(error);}try{await cleanupInstances();}catch(error){errors.push(error);}for(const item of [fadeMaterial,copyMaterial,slotA,slotB,front,working])try{await item?.dispose?.();}catch(error){errors.push(error);}try{await renderer?.dispose?.();}catch(error){errors.push(error);}try{await sharedGraph?.dispose?.();}catch(error){errors.push(error);}try{await device?.queue?.onSubmittedWorkDone();}catch(error){errors.push(error);}try{device?.destroy();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Story interop cleanup failed');};
 try{
  phase='admitting';sharedGraph=await prepareAuthoredSharedModules(capsule);const ordinary=capsule.visuals.find(row=>row.id==='ordinary'),tsl=capsule.visuals.find(row=>row.id==='tsl');if(!ordinary||!tsl)throw Error('Probe capsule visuals unavailable');
  const controlsA=await prepareWorkerControlState({sdkVersion:'0.2.0',controlSchema:ordinary.controls,controlSchemaHash:ordinary.controlSchemaHash,controls:values(ordinary.controls)},{kind:'visual',sdkVersion:'0.2.0'});
  const controlsB=await prepareWorkerControlState({sdkVersion:'0.2.0',controlSchema:tsl.controls,controlSchemaHash:tsl.controlSchemaHash,controls:values(tsl.controls)},{kind:'visual',sdkVersion:'0.2.0'});
  phase='importing-runtime';const runtime=await sharedGraph.importRuntime(),moduleA=await sharedGraph.importVisual('ordinary');phase='importing-foreign';const moduleB=await sharedGraph.importVisual('tsl'),R=runtime.WebGPU,T=runtime.TSL,assetsA=Object.freeze({}),imagesA=Object.freeze({}),assetsB=Object.freeze({}),imagesB=Object.freeze({});
  const createA=controlsA.checkDefinition(moduleA),createB=controlsB.checkDefinition(moduleB),adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw Error('No WebGPU adapter');
  phase='creating-renderer';device=await adapter.requestDevice();const nativeCreateTexture=device.createTexture.bind(device);device.createTexture=descriptor=>{textureDescriptors.push(compactDescriptor(descriptor));return nativeCreateTexture(descriptor);};
  renderer=new R.WebGPURenderer({canvas,device,alpha:true,antialias:false});renderer.setSize(width,height,false);renderer.setClearColor(0x000000,0);await renderer.init();if(!renderer.backend.isWebGPUBackend)throw Error('WebGPU backend required');
  const slotOptions={format:rgbaFormat,type:unsignedByteType,depthBuffer:true,stencilBuffer:false,samples:0,count:1,depth:1};
  const compositionOptions={format:rgbaFormat,type:unsignedByteType,depthBuffer:false,stencilBuffer:false,samples:0,count:1,depth:1};
  slotA=new R.RenderTarget(width,height,slotOptions);slotB=new R.RenderTarget(width,height,slotOptions);front=new R.RenderTarget(width,height,compositionOptions);working=new R.RenderTarget(width,height,compositionOptions);
  for(const target of [slotA,slotB,front,working]){target.texture.colorSpace=R.SRGBColorSpace;target.texture.generateMipmaps=false;}
  const left=T.texture(slotA.texture),right=T.texture(slotB.texture);fadeMaterial=new R.MeshBasicNodeMaterial();fadeMaterial.fragmentNode=left.mul(0.5).add(right.mul(0.5));fadeMaterial.transparent=false;fadeMaterial.depthTest=false;fadeMaterial.depthWrite=false;fadeMaterial.toneMapped=false;fadeQuad=new R.QuadMesh(fadeMaterial);
  copyMaterial=new R.MeshBasicNodeMaterial();copyMaterial.fragmentNode=T.texture(working.texture);copyMaterial.transparent=false;copyMaterial.depthTest=false;copyMaterial.depthWrite=false;copyMaterial.toneMapped=false;copyQuad=new R.QuadMesh(copyMaterial);
  const settings={width,height,fps:60,seed:0},normalStory={state:'normal',storyEpoch:0},frame={tick:0,timeSeconds:0,deltaSeconds:0,controls:{},events:[],story:normalStory};
  const results=[];
  for(let pass=0;pass<2;pass++){phase=`pass-${pass+1}-create`;
   const context=(target,assets,images)=>Object.freeze({settings,assets,images,random:()=>0.5,reportError(message){throw Error(message)},renderer:Object.freeze({async render(scene,camera,description){if(description.width!==width||description.height!==height||description.colorSpace!=='linear-srgb'||description.alphaMode!=='premultiplied')throw Error('Invalid output descriptor');renderer.setRenderTarget(target);try{await renderer.render(scene,camera);}finally{renderer.setRenderTarget(null);}}})});
   const a=await createA(context(slotA,assetsA,imagesA));liveInstances.add(a);const b=await createB(context(slotB,assetsB,imagesB));liveInstances.add(b);
   try{phase=`pass-${pass+1}-render`;
    a.update(frame);b.update(frame);await a.render(targetDescription(slotA));await b.render(targetDescription(slotB));
    renderer.setRenderTarget(working);try{fadeQuad.render(renderer);}finally{renderer.setRenderTarget(null);}await device.queue.onSubmittedWorkDone();
    renderer.setRenderTarget(front);try{copyQuad.render(renderer);}finally{renderer.setRenderTarget(null);}await device.queue.onSubmittedWorkDone();
    phase=`pass-${pass+1}-readback`;const slotAPixels=await renderer.readRenderTargetPixelsAsync(slotA,0,0,width,height),slotBPixels=await renderer.readRenderTargetPixelsAsync(slotB,0,0,width,height),pixels=await renderer.readRenderTargetPixelsAsync(front,0,0,width,height),center=((Math.floor(height/2)*width)+Math.floor(width/2))*4,pixel=Array.from(pixels.slice(center,center+4)),slotPixels={ordinary:Array.from(slotAPixels.slice(center,center+4)),tsl:Array.from(slotBPixels.slice(center,center+4))},png=encodeCapturedTarget(pixels,width,height);
    renderer.setRenderTarget(null);copyQuad.render(renderer);await device.queue.onSubmittedWorkDone();
    results.push({pass,pixel,slotPixels,png});
   }finally{phase=`pass-${pass+1}-dispose`;await device.queue.onSubmittedWorkDone();await cleanupInstances();}
  }
  const publicTargets=[slotA,slotB,front,working].map(target=>({width:target.width,height:target.height,depthBuffer:target.depthBuffer,stencilBuffer:target.stencilBuffer,samples:target.samples,count:target.textures.length,depth:target.depth,format:target.texture.format,type:target.texture.type,colorSpace:target.texture.colorSpace,generateMipmaps:target.texture.generateMipmaps}));
  phase='cleanup';await cleanup();phase='complete';
  self.postMessage({type:'result',results,publicTargets,textureDescriptors,rendererBundle:'shared-runtime',foreignBundle:'tsl',foreignFeatures:['MeshLambertNodeMaterial','Fn','If','AmbientLight'],cleanup:{instanceDisposals:4,resourceDisposal:'complete',deviceDestroyed:true,sharedModules:sharedGraph.status()},unproved:null},results.map(row=>row.png.buffer));
 }catch(error){const failedPhase=phase;let cleanupError=null;try{await cleanup();}catch(failure){cleanupError=String(failure?.stack||failure);}self.postMessage({type:'failure',phase:failedPhase,message:String(error?.stack||error),cleanupError,textureDescriptors});}
};
