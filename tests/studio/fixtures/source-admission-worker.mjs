import { parentPort,workerData } from 'node:worker_threads';
import { handleSourceAdmission } from '../../../apps/studio/src/source/admission-worker-handler.mjs';
parentPort.on('message',request=>{
  if (workerData === 'hang') return;
  if (workerData === 'error') throw Error('worker failed');
  if (workerData === 'wrong-id') return parentPort.postMessage({id:request.id+1,ok:true});
  if (workerData === 'forged-token') return parentPort.postMessage({id:request.id,ok:true,assetSetHash:'0'.repeat(64),trusted:true});
  parentPort.postMessage(handleSourceAdmission(request));
});
