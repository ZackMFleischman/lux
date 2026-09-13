import { validateSource,snapshotRecord,violation } from '../../../build-worker/src/source-policy.mjs';
import {createReadonlyImageMap,decodeCanonicalBase64} from '../../../../packages/assets/src/index.mjs';

/** Presentation-only pixels; this response is never an admission capability. */
export function handleImagePreview(message) {
  try {
    const {asset}=snapshotRecord(message,['asset']);
    const extension=asset.mediaType==='image/bmp'?'bmp':asset.mediaType==='image/png'?'png':'jpg';
    const path=`assets/preview.${extension}`,images=createReadonlyImageMap({[path]:asset});
    return {ok:true,pixels:images.get(path),byteLength:decodeCanonicalBase64(asset.data).byteLength};
  } catch { return {ok:false,error:'Image unavailable: unsupported or invalid image.'}; }
}

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
