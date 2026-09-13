import type {ComponentFrame,ComponentInstance,ImageResource} from '../../../visual-sdk/src/sdk-components.ts';
// Captured before authored import, including methods rather than mutable owners.
const ownKeys=Reflect.ownKeys,descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf;
const objectPrototype=Object.prototype,freeze=Object.freeze,RuntimeError=Error;
const hasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const apply=Reflect.apply,Registry=WeakMap,weakGet=Function.prototype.call.bind(WeakMap.prototype.get),weakSet=Function.prototype.call.bind(WeakMap.prototype.set);
function own(value:any,key:string){const d=descriptor(value,key);if(!d?.enumerable||!hasOwn(d,'value'))throw new RuntimeError('Component requires own data methods/output');return d.value;}
export function componentDisposer(instance:unknown):(()=>unknown)|undefined {
 if(!instance||(typeof instance!=='object'&&typeof instance!=='function'))return;
 const d=descriptor(instance,'dispose');return d&&hasOwn(d,'value')&&typeof d.value==='function'?()=>apply(d.value,instance,[]):undefined;
}
export function captureComponentInstance(instance:unknown):ComponentInstance {
 if(!instance||typeof instance!=='object')throw new RuntimeError('Invalid component instance');
 const methods={} as Record<string,Function>;
 for(const name of ['update','evaluate','reset','dispose']){const fn=own(instance,name);if(typeof fn!=='function')throw new RuntimeError('Component missing '+name);methods[name]=fn;}
 return freeze({update:(frame:ComponentFrame)=>apply(methods.update!,instance,[frame]),evaluate:(inputs:any,context:any)=>apply(methods.evaluate!,instance,[inputs,context]),reset:(seed:number)=>apply(methods.reset!,instance,[seed]),dispose:()=>apply(methods.dispose!,instance,[])});
}
export interface SingleImageBackend {readonly width:number;readonly height:number;render(scene:unknown,camera:unknown):void|Promise<void>}
export function createSingleImageVisual(instance:ComponentInstance,backend:SingleImageBackend){
 const captured=captureComponentInstance(instance),tokens=new Registry<object,object>();
 const width=backend.width,height=backend.height,renderBackend=backend.render;
 let active:object|null=null,pending:Promise<unknown>|undefined,busy=false,disposed=false,disposal:Promise<void>|undefined;
 const invalidate=()=>{active=null;};
 const drain=async()=>{await pending;};
 const empty=freeze({});
 return freeze({
  invalidate,drain,
  update(frame:ComponentFrame){if(disposed)throw new RuntimeError('Component disposed');return captured.update(frame);},
  async render(){
   if(disposed||busy)throw new RuntimeError('Component evaluation unavailable');
   busy=true;await drain();
   if(disposed){busy=false;throw new RuntimeError('Component disposed');}
   const epoch={};active=epoch;let used=false;
   const context=freeze({render(scene:unknown,camera:unknown):Promise<ImageResource>{
    // An async wrapper would reserve too late for reentrant backends.
    let operation:Promise<ImageResource>;
    if(active!==epoch||disposed)operation=Promise.reject(new RuntimeError('Closed evaluation epoch'));
    else if(used)operation=Promise.reject(new RuntimeError('Only one render per evaluation'));
    else {
     used=true;
     // Reserve and install the observation before the backend can reenter.
     operation=Promise.resolve().then(async()=>{
     await apply(renderBackend,backend,[scene,camera]);
     if(active!==epoch||disposed)throw new RuntimeError('Closed evaluation epoch');
     const token=freeze({width,height,colorSpace:'linear-srgb' as const,alphaMode:'premultiplied' as const}) as ImageResource;
     weakSet(tokens,token,epoch);return token;
     });
     pending=operation.then(()=>undefined,()=>undefined);
    }
    // Observe author-facing rejection too, even if evaluate abandons the result.
    void operation.then(()=>undefined,()=>undefined);
    return operation;
   }});
   try{
    const output=await captured.evaluate(empty,context);
    if(active!==epoch||disposed||!output||typeof output!=='object'||(prototype(output)!==objectPrototype&&prototype(output)!==null)||ownKeys(output).length!==1)throw new RuntimeError('Invalid component output');
    const image=own(output,'image');
    if(!image||typeof image!=='object'||weakGet(tokens,image)!==epoch)throw new RuntimeError('Invalid component output token');
   }finally{if(active===epoch)active=null;busy=false;}
  },
  async reset(seed:number){invalidate();await drain();if(disposed)throw new RuntimeError('Component disposed');await captured.reset(seed);},
  dispose():Promise<void>{
   if(disposal)return disposal;disposed=true;invalidate();
   disposal=(async()=>{await drain();await captured.dispose();})();return disposal;
  },
 });
}
