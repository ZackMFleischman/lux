import { validateSource,snapshotRecord,violation } from '../../../build-worker/src/source-policy.mjs';

/** Runs only in a trusted dedicated CPU worker, before any submitted code. */
export function handleSourceAdmission(message) {
  let id = 0;
  try {
    const request = snapshotRecord(message,['id','source']);
    if (!Number.isSafeInteger(request.id) || request.id < 1) throw violation('Invalid admission request ID');
    id = request.id;
    validateSource(request.source); // Full admission of every declared original.
    return {id,ok:true};
  } catch (error) {
    const code = ['SOURCE_BOUNDARY_VIOLATION','QUOTA_EXCEEDED'].includes(error?.code) ? error.code : 'SERVICE_UNAVAILABLE';
    return {id,ok:false,code,message:String(error?.message ?? 'Source admission failed').slice(0,2000)};
  }
}
