import {open} from 'node:fs/promises';
import {violation} from './source-policy.mjs';
export async function readBoundedJson(path,limit) {
  const file=await open(path,'r');
  try {
    if((await file.stat()).size>limit) throw violation('JSON input exceeds bounded byte limit','QUOTA_EXCEEDED');
    const bytes=Buffer.alloc(limit+1);let offset=0;
    while(offset<bytes.length) {const {bytesRead}=await file.read(bytes,offset,bytes.length-offset,null);if(!bytesRead)break;offset+=bytesRead;}
    if(offset>limit) throw violation('JSON input exceeds bounded byte limit','QUOTA_EXCEEDED');
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,offset)));
  } finally {await file.close();}
}
export function boundedJson(value,limit) {
  const json=JSON.stringify(value);
  if(Buffer.byteLength(json,'utf8')>limit) throw violation('JSON output exceeds bounded byte limit','QUOTA_EXCEEDED');
  return json;
}
