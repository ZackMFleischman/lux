// Captured before authored modules execute. Authored code receives only the
// frozen facade; callback epochs and backend ownership remain private here.
const freeze=Object.freeze,RuntimeError=Error,apply=Reflect.apply;
const call=Function.prototype.call,SetCtor=Set,setAdd=call.bind(Set.prototype.add),setDelete=call.bind(Set.prototype.delete),setSize=call.bind(Object.getOwnPropertyDescriptor(Set.prototype,'size').get);
const RuntimePromise=Promise,promiseResolve=RuntimePromise.resolve.bind(RuntimePromise),promiseReject=RuntimePromise.reject.bind(RuntimePromise),allSettled=RuntimePromise.allSettled.bind(RuntimePromise),promiseThen=call.bind(RuntimePromise.prototype.then),promiseCatch=call.bind(RuntimePromise.prototype.catch),arrayFrom=Array.from.bind(Array);

export function prepareStoryRenderScopeFactory({renderer}){
 const setTarget=renderer.setRenderTarget,renderBackend=renderer.render;
 return freeze({create({target}){return createCapturedStoryRenderScope({renderer,target,setTarget,renderBackend});}});
}
export function createStoryRenderScope({renderer,target}){return prepareStoryRenderScopeFactory({renderer}).create({target});}
function createCapturedStoryRenderScope({renderer,target,setTarget,renderBackend}){
 const pending=new SetCtor();let active=null,closed=false,failure=null;
 function status(){return freeze({closed,pendingCallbacks:setSize(pending),active:active!==null});}
 function observe(operation,epoch){
  setAdd(pending,operation);epoch.inFlight=operation;
  promiseThen(operation,()=>{setDelete(pending,operation);if(epoch.inFlight===operation)epoch.inFlight=null;},error=>{failure??=error;setDelete(pending,operation);if(epoch.inFlight===operation)epoch.inFlight=null;});
  // Observe a caller-abandoned rejection without converting the returned promise.
  void promiseCatch(operation,()=>{});return operation;
 }
 const rendererFacade=freeze({render(scene,camera){
  const epoch=active;
  if(closed||!epoch)return promiseReject(new RuntimeError('Closed render callback'));
  if(epoch.inFlight)return promiseReject(new RuntimeError('Render callback already in flight'));
  const operation=promiseThen(promiseResolve(),async()=>{
   if(closed||active!==epoch)throw new RuntimeError('Closed render callback');
   apply(setTarget,renderer,[target]);
   try{await apply(renderBackend,renderer,[scene,camera]);}
   finally{apply(setTarget,renderer,[null]);}
  });
  return observe(operation,epoch);
 }});
 async function drain(){while(setSize(pending))await allSettled(arrayFrom(pending));if(failure)throw failure;}
 async function run(callback){
  if(closed)throw new RuntimeError('Story render scope is closed');
  if(active)throw new RuntimeError('Story render callback already active');
  const epoch={inFlight:null};active=epoch;let callbackFailure;
  try{await callback(rendererFacade);}catch(error){callbackFailure=error;}
  try{await drain();}finally{if(active===epoch)active=null;}
  if(callbackFailure)throw callbackFailure;
  if(failure)throw failure;
 }
 async function close(){if(closed)return drain();closed=true;active=null;return drain();}
 return freeze({renderer:rendererFacade,run,drain,close,status});
}
