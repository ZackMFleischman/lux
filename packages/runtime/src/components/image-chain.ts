import type {CodeComponentDefinition,ComponentFrame,ComponentContext,ImageResource} from '../../../visual-sdk/src/sdk-composition.ts';
import type {GraphRuntimePlan} from '../graph/runtime-plan.ts';
import {readGraphRuntimePlan} from '../graph/runtime-plan.ts';
import type {BackendImage,CpuResourceBackend,FrameOutput,ResourceHost} from '../graph/resources.ts';
import {createResourceHost,attachResourceHost,beginResourceFrame,openResourceNode,completeResourceNode,failResourceNode,releaseResourceCache,finishResourceFrame,disposeResourceHost,readResourceInputImage,readResourceOutputImage} from '../graph/resources.ts';
import {SeededRandom} from '../seed.ts';
type Backend=Readonly<{resources:CpuResourceBackend;stage(scene:unknown,camera:unknown):void;texture(image:BackendImage):unknown;present(image:BackendImage):void|Promise<void>;drain():Promise<void>}>;
type Options=Readonly<{plan:GraphRuntimePlan;definitions:Readonly<Record<string,CodeComponentDefinition>>;context:ComponentContext;backend:Backend;nodeControls?:(nodePath:readonly string[],frame:ComponentFrame)=>Readonly<Record<string,number>>}>;
const pathKey=(path:readonly string[])=>JSON.stringify(path);
export async function createImageCompositionVisual(options:Options){
 const dto=readGraphRuntimePlan(options.plan),instances=new Map<string,Awaited<ReturnType<CodeComponentDefinition['create']>>>(),randoms=new Map<string,SeededRandom>();
 try{for(const node of dto.nodes){const definition=options.definitions[node.definitionHash];if(!definition||definition.kind!=='component'||definition.sdkVersion!=='0.4.0')throw Error('Missing admitted component factory');const key=pathKey(node.nodePath),random=new SeededRandom(options.context.settings.seed);randoms.set(key,random);instances.set(key,await definition.create(Object.freeze({...options.context,random:()=>random.next()})));}}
 catch(error){for(const instance of [...instances.values()].reverse())try{await instance.dispose();}catch{}throw error;}
 let frame:ComponentFrame|undefined,current:FrameOutput|undefined,disposed=false,disposal:Promise<void>|undefined;
 const host:ResourceHost=createResourceHost({generation:1,sceneSeed:options.context.settings.seed,initialClockEpoch:0,width:options.context.settings.width,height:options.context.settings.height,format:'rgba8unorm',colorSpace:'linear-srgb',alphaMode:'premultiplied'},options.backend.resources);attachResourceHost(host,options.plan);
 const tokens=new WeakMap<object,{output:unknown;image:BackendImage}>();
 const image=(output:unknown,backendImage:BackendImage):ImageResource=>{const value=Object.freeze({width:options.context.settings.width,height:options.context.settings.height,colorSpace:'linear-srgb' as const,alphaMode:'premultiplied' as const,texture:options.backend.texture(backendImage)}) as ImageResource;tokens.set(value,{output,image:backendImage});return value;};
 return Object.freeze({
  update(next:ComponentFrame){if(disposed)throw Error('Composition disposed');frame=next;},
  async render(){if(disposed||!frame)throw Error('Composition unavailable');const resourceFrame=beginResourceFrame(host,0);let finalImage:BackendImage|undefined;
   for(const node of dto.nodes){const key=pathKey(node.nodePath),evaluation=openResourceNode(host,resourceFrame,node.nodePath),definition=dto.definitions[node.definitionHash]!,instance=instances.get(key)!;const controls:any=options.nodeControls?{...options.nodeControls(node.nodePath,frame)}:{...node.initialControls};
    if(!options.nodeControls)for(const [publicId,targets] of Object.entries(dto.publicControlBindings))for(const target of targets)if(target.active&&pathKey(target.nodePath)===key)controls[target.controlId]=(frame.controls as any)[publicId];
    const inputs:any={};for(const [portId,view] of Object.entries(evaluation.inputs)){const backendImage=readResourceInputImage(host,evaluation.scope,view);inputs[portId]=image(view,backendImage);}
    try{instance.update(Object.freeze({...frame,controls:Object.freeze(controls)}));let used=false;const output=await instance.evaluate(Object.freeze(inputs),Object.freeze({render:async(scene:unknown,camera:unknown)=>{if(used)throw Error('Only one render per component evaluation');used=true;options.backend.stage(scene,camera);const token=await evaluation.resources.image('image',{kind:'image',width:options.context.settings.width,height:options.context.settings.height,format:'rgba8unorm',colorSpace:'linear-srgb',alphaMode:'premultiplied'},Object.values(evaluation.inputs));const backendImage=readResourceOutputImage(host,evaluation.scope,token);return image(token,backendImage);}}));
     const captured=tokens.get(output?.image as object);if(!captured)throw Error('Invalid component output token');const cache=await completeResourceNode(host,evaluation.scope,{image:captured.output});releaseResourceCache(host,cache);if(pathKey(node.nodePath)===pathKey(dto.finalOutput.nodePath))finalImage=captured.image;
    }catch(error){failResourceNode(host,evaluation.scope);throw error;}
   }
   const next=finishResourceFrame(host,resourceFrame);try{await options.backend.present(finalImage!);}catch(error){next.release();throw error;}const previous=current;current=next;previous?.release();
  },
  async reset(seed:number){for(const [key,instance] of instances){randoms.get(key)!.reset(seed);await instance.reset(seed);}},
  dispose(){if(disposal)return disposal;disposed=true;current?.release();current=undefined;disposal=(async()=>{let failure:unknown;for(const instance of [...instances.values()].reverse())try{await instance.dispose();}catch(error){failure??=error;}try{await disposeResourceHost(host);}catch(error){failure??=error;}try{await options.backend.drain();}catch(error){failure??=error;}if(failure)throw failure;})();return disposal;},
 });
}
