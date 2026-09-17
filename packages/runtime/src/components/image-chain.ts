import type {CodeComponentDefinition,ComponentFrame,ComponentContext,ImageResource,Paths2DResource,ShaderFieldResource} from '../../../visual-sdk/src/sdk-composition.ts';
import type {ControlValues} from '../../../runtime-contracts/src/parameters.mjs';
import type {ShaderFieldSnapshot} from '../../../runtime-contracts/src/shader-field.mjs';
import type {Paths2DSnapshot} from '../../../runtime-contracts/src/paths2d.mjs';
import type {GraphRuntimePlan} from '../graph/runtime-plan.ts';
import {readGraphRuntimePlan} from '../graph/runtime-plan.ts';
import type {BackendImage,CpuResourceBackend,FrameOutput,InputView,OutputToken,ResourceHost} from '../graph/resources.ts';
import {createResourceHost,attachResourceHost,beginResourceFrame,openResourceNode,completeResourceNode,failResourceNode,releaseResourceCache,finishResourceFrame,disposeResourceHost,readResourceInputImage,readResourceOutputImage,readResourceOutputPaths,readResourceOutputShaderField} from '../graph/resources.ts';
import {SeededRandom} from '../seed.ts';

type Backend=Readonly<{resources:CpuResourceBackend;stage(scene:unknown,camera:unknown):void;texture(image:BackendImage):unknown;present(image:BackendImage):void|Promise<void>;drain():Promise<void>}>;
type AnyComponent=CodeComponentDefinition<any,any,any>;
type Options=Readonly<{plan:GraphRuntimePlan;definitions:Readonly<Record<string,AnyComponent>>;context:ComponentContext;backend:Backend;nodeControls?:(nodePath:readonly string[],frame:ComponentFrame)=>ControlValues;nodeSampleControl?:(nodePath:readonly string[],controlId:string,instanceKey:string|number,frame:ComponentFrame)=>number;nodeEvents?:(nodePath:readonly string[],frame:ComponentFrame)=>ComponentFrame['events']}>;
type WrappedResource={output:OutputToken|InputView;kind:'image'|'paths2d'|'shader-field';image?:BackendImage;paths?:Paths2DSnapshot;shaderField?:ShaderFieldSnapshot};
const pathKey=(path:readonly string[])=>JSON.stringify(path);

function outputResources(value:unknown,ports:Readonly<Record<string,{type:{kind:string}}>>,tokens:WeakMap<object,WrappedResource>):{tokens:Record<string,OutputToken>;resources:Record<string,WrappedResource>} {
 if(value===null||typeof value!=='object'||Array.isArray(value))throw Error('Invalid component output resources');
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)throw Error('Invalid component output resources');
 const ids=Object.keys(ports),keys=Reflect.ownKeys(value);if(keys.length!==ids.length||keys.some(key=>typeof key!=='string'||!ids.includes(key)))throw Error('Invalid component output resources');
 const outputs:Record<string,OutputToken>=Object.create(null),resources:Record<string,WrappedResource>=Object.create(null);
 for(const id of ids){const descriptor=Object.getOwnPropertyDescriptor(value,id);if(!descriptor||!Object.hasOwn(descriptor,'value')||descriptor.value===null||typeof descriptor.value!=='object')throw Error('Invalid component output resources');
  const resource=tokens.get(descriptor.value);if(!resource||resource.kind!==ports[id]!.type.kind)throw Error('Invalid component output resources');outputs[id]=resource.output as OutputToken;resources[id]=resource;}
 return {tokens:outputs,resources};
}

export async function createImageCompositionVisual(options:Options){
 const dto=readGraphRuntimePlan(options.plan),instances=new Map<string,Awaited<ReturnType<AnyComponent['create']>>>(),randoms=new Map<string,SeededRandom>();
 try{for(const node of dto.nodes){const definition=options.definitions[node.definitionHash];if(!definition||definition.kind!=='component'||definition.sdkVersion!=='0.4.0')throw Error('Missing admitted component factory');const key=pathKey(node.nodePath),random=new SeededRandom(options.context.settings.seed);randoms.set(key,random);instances.set(key,await definition.create(Object.freeze({...options.context,random:()=>random.next()})));}}
 catch(error){for(const instance of [...instances.values()].reverse())try{await instance.dispose();}catch{}throw error;}
 let frame:ComponentFrame|undefined,current:FrameOutput|undefined,disposed=false,disposal:Promise<void>|undefined;
 const host:ResourceHost=createResourceHost({generation:1,sceneSeed:options.context.settings.seed,initialClockEpoch:0,width:options.context.settings.width,height:options.context.settings.height,format:'rgba8unorm',colorSpace:'linear-srgb',alphaMode:'premultiplied'},options.backend.resources);attachResourceHost(host,options.plan);
 const tokens=new WeakMap<object,WrappedResource>();
 const image=(output:OutputToken|InputView,backendImage:BackendImage):ImageResource=>{const value=Object.freeze({width:options.context.settings.width,height:options.context.settings.height,colorSpace:'linear-srgb' as const,alphaMode:'premultiplied' as const,texture:options.backend.texture(backendImage)}) as ImageResource;tokens.set(value,{output,kind:'image',image:backendImage});return value;};
 const shaderField=(output:OutputToken|InputView,data:ShaderFieldSnapshot):ShaderFieldResource=>{const value=Object.freeze({data}) as ShaderFieldResource;tokens.set(value,{output,kind:'shader-field',shaderField:data});return value;};
 const paths=(output:OutputToken|InputView,data:Paths2DSnapshot):Paths2DResource=>{const value=Object.freeze({data}) as Paths2DResource;tokens.set(value,{output,kind:'paths2d',paths:data});return value;};
 return Object.freeze({
  update(next:ComponentFrame){if(disposed)throw Error('Composition disposed');frame=next;},
  async render(){if(disposed||!frame)throw Error('Composition unavailable');const resourceFrame=beginResourceFrame(host,0);let finalImage:BackendImage|undefined;
   for(const node of dto.nodes){const key=pathKey(node.nodePath),definition=dto.definitions[node.definitionHash]!,instance=instances.get(key)!,evaluation=openResourceNode(host,resourceFrame,node.nodePath);let completionStarted=false;
    try{
     const controls:any=options.nodeControls?{...options.nodeControls(node.nodePath,frame)}:{...node.initialControls};
     if(!options.nodeControls)for(const [publicId,targets] of Object.entries(dto.publicControlBindings))for(const target of targets)if(target.active&&pathKey(target.nodePath)===key)controls[target.controlId]=(frame.controls as any)[publicId];
     const inputs:any={},imageInputs:InputView[]=[];
     for(const [portId,view] of Object.entries(evaluation.inputs)){const kind=definition.metadata.inputs[portId]!.type.kind;if(kind==='image'){const backendImage=readResourceInputImage(host,evaluation.scope,view);inputs[portId]=image(view,backendImage);imageInputs.push(view);}else if(kind==='paths2d'){const data=evaluation.resources.readPaths(view);inputs[portId]=paths(view,data);}else if(kind==='shader-field'){const data=evaluation.resources.readShaderField(view);inputs[portId]=shaderField(view,data);}else throw Error('Unsupported authored signal input');}
     instance.update(Object.freeze({...frame,controls:Object.freeze(controls),events:options.nodeEvents?options.nodeEvents(node.nodePath,frame):frame.events,sampleControl:options.nodeSampleControl?(controlId:string,instanceKey:string|number)=>options.nodeSampleControl!(node.nodePath,controlId,instanceKey,frame!):undefined}));
     let renderPending=false;
     const context=Object.freeze({
      shaderField:(portId:string,snapshot:unknown)=>{const token=evaluation.resources.shaderField(portId,snapshot),data=readResourceOutputShaderField(host,evaluation.scope,token);return shaderField(token,data);},
      paths:(portId:string,snapshot:unknown)=>{const token=evaluation.resources.paths(portId,snapshot),data=readResourceOutputPaths(host,evaluation.scope,token);return paths(token,data);},
      render:async(scene:unknown,camera:unknown,portId='image')=>{if(renderPending)throw Error('Concurrent component render calls are unsupported');renderPending=true;try{options.backend.stage(scene,camera);const token=await evaluation.resources.image(portId,{kind:'image',width:options.context.settings.width,height:options.context.settings.height,format:'rgba8unorm',colorSpace:'linear-srgb',alphaMode:'premultiplied'},imageInputs);const backendImage=readResourceOutputImage(host,evaluation.scope,token);return image(token,backendImage);}finally{renderPending=false;}},
     });
     const output=await instance.evaluate(Object.freeze(inputs),context),captured=outputResources(output,definition.metadata.outputs,tokens);
     const selected=pathKey(node.nodePath)===pathKey(dto.finalOutput.nodePath)?captured.resources[dto.finalOutput.portId]:undefined;
     completionStarted=true;const cache=await completeResourceNode(host,evaluation.scope,captured.tokens);releaseResourceCache(host,cache);
     if(selected){if(selected.kind!=='image'||!selected.image)throw Error('Final graph output must be an image');finalImage=selected.image;}
    }catch(error){if(!completionStarted)failResourceNode(host,evaluation.scope);throw error;}
   }
   if(!finalImage)throw Error('Composition produced no final image');
   const next=finishResourceFrame(host,resourceFrame);try{await options.backend.present(finalImage);}catch(error){next.release();throw error;}const previous=current;current=next;previous?.release();
  },
  async reset(seed:number){for(const [key,instance] of instances){randoms.get(key)!.reset(seed);await instance.reset(seed);}},
  dispose(){if(disposal)return disposal;disposed=true;current?.release();current=undefined;disposal=(async()=>{let failure:unknown;try{await disposeResourceHost(host);}catch(error){failure??=error;}for(const instance of [...instances.values()].reverse())try{await instance.dispose();}catch(error){failure??=error;}try{await options.backend.drain();}catch(error){failure??=error;}if(failure)throw failure;})();return disposal;},
 });
}
