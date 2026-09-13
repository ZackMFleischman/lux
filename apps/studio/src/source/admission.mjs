// Session-local ownership and asynchronous source admission.
import { validateSource,validateSourceEnvelope,snapshotRecord,violation } from '../../../build-worker/src/source-policy.mjs';

function freezeSource(source) {
  Object.freeze(source.files);
  return Object.freeze(source);
}

function verifyInWorker(source, createWorker, id, timeoutMs) {
  return new Promise((resolve,reject)=>{
    let worker, timer, finished = false;
    const finish = error => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      if (worker) {
        for (const [type,listener] of [['message',message],['error',failed],['messageerror',failed]]) worker.removeEventListener(type,listener);
        try { worker.terminate(); }
        catch { error = violation('Source admission worker termination failed','SERVICE_UNAVAILABLE'); }
      }
      if (error) reject(error); else resolve();
    };
    const message = event => {
      try {
        const result = snapshotRecord(event.data);
        const fields = result.ok === true ? ['id','ok'] : ['id','ok','code','message'];
        if (Object.keys(result).length !== fields.length || fields.some(key=>!Object.hasOwn(result,key)) || result.id !== id || typeof result.ok !== 'boolean') throw violation('Invalid source admission response','SERVICE_UNAVAILABLE');
        if (!result.ok) {
          if (!['SOURCE_BOUNDARY_VIOLATION','QUOTA_EXCEEDED','SERVICE_UNAVAILABLE'].includes(result.code) || typeof result.message !== 'string' || result.message.length > 2000) throw violation('Invalid source admission error','SERVICE_UNAVAILABLE');
          finish(violation(result.message,result.code));
        } else finish();
      } catch (error) { finish(error); }
    };
    const failed = () => finish(violation('Source admission worker failed','SERVICE_UNAVAILABLE'));
    try {
      worker = createWorker();
      for (const [type,listener] of [['message',message],['error',failed],['messageerror',failed]]) worker.addEventListener(type,listener);
      timer = setTimeout(()=>finish(violation('Source admission timed out','SOURCE_ADMISSION_TIMEOUT')),timeoutMs);
      worker.postMessage(Object.freeze({id,source}));
    } catch (error) { finish(error); }
  });
}

/** Host-owned session. No received JSON or hash can mint source ownership. */
export function createSourceAdmissionSession() {
  const owned = new WeakSet();
  let nextId = 0, pending = false;
  const remember = source => { freezeSource(source); owned.add(source); return source; };
  return Object.freeze({
    admit(source) { return remember(validateSource(source)); },
    edit(source, files) {
      if (!owned.has(source)) throw violation('Text edits require a source owned by this admission session');
      const next = validateSourceEnvelope({...source,files});
      if (source.sourceVersion === 2) next.assets = source.assets;
      return remember(next);
    },
    async admitAsync(source, createWorker, timeoutMs = 2000) {
      if (pending) throw violation('Source admission is busy','SOURCE_ADMISSION_BUSY');
      if (typeof createWorker !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) throw violation('Source admission requires a worker and a 1–5000 ms timeout');
      pending = true;
      try {
        const snapshot = freezeSource(validateSourceEnvelope(source));
        await verifyInWorker(snapshot,createWorker,++nextId,timeoutMs);
        // The private snapshot was the exact immutable request; arbitrary response
        // data never becomes a source or a cache token. Each worker fully verifies.
        return remember(snapshot);
      } finally { pending = false; }
    },
  });
}
