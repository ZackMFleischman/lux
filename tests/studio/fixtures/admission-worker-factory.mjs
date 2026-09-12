import { Worker } from 'node:worker_threads';
export function workerFactory(mode = 'admit') {
  const created = [];
  return Object.assign(()=>{
    const worker = new Worker(new URL('./source-admission-worker.mjs',import.meta.url),{workerData:mode});
    const listeners = new Map(), item = {terminated:false,exited:new Promise(resolve=>worker.on('exit',resolve))};
    created.push(item);
    return {
      postMessage(message) { worker.postMessage(message); },
      addEventListener(type,listener) { const wrapper = data=>listener(type === 'message' ? {data} : {message:data.message}); listeners.set(listener,wrapper); worker.on(type,wrapper); },
      removeEventListener(type,listener) { worker.off(type,listeners.get(listener)); },
      terminate() { item.terminated = true; void worker.terminate(); },
    };
  },{created});
}
