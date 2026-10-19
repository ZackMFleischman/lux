import {snapshotRecord} from '../../../apps/build-worker/src/source-policy.mjs';

/** One local audio file that plays in sync with scene time. The scene stores a
 * reference and a content hash, never the audio bytes. `path` is relative to the
 * scene file when the save location permits it; `absolutePath` is the fallback. */
export type SceneSoundtrack=Readonly<{path:string;absolutePath:string;sha256:string;offsetSeconds:number;volume:number}>;

export const soundtrackExtensions=Object.freeze(['mp3','wav','ogg','oga','m4a','aac','flac']);
export const soundtrackByteLimit=200*1024*1024;
export const soundtrackMaxOffsetSeconds=86400;
const fields=['path','absolutePath','sha256','offsetSeconds','volume'];

function filePath(value:unknown,label:string):string{
 if(typeof value!=='string'||value.length<1||value.length>4096||value.includes('\0'))throw Error(`Soundtrack ${label} must be a non-empty path`);
 return value;
}
export function soundtrackHasSupportedExtension(path:string):boolean{
 const match=/\.([A-Za-z0-9]+)$/.exec(path);
 return !!match&&soundtrackExtensions.includes(match[1]!.toLowerCase());
}
export function normalizeSceneSoundtrack(value:unknown):SceneSoundtrack{
 const raw=snapshotRecord(value,fields);
 const path=filePath(raw.path,'path'),absolutePath=filePath(raw.absolutePath,'absolutePath');
 if(!soundtrackHasSupportedExtension(absolutePath))throw Error('Soundtrack must be an MP3, WAV, OGG, M4A, AAC or FLAC file');
 if(typeof raw.sha256!=='string'||!/^[0-9a-f]{64}$/.test(raw.sha256))throw Error('Soundtrack sha256 must be 64 lowercase hex digits');
 const offsetSeconds=raw.offsetSeconds,volume=raw.volume;
 if(typeof offsetSeconds!=='number'||!Number.isFinite(offsetSeconds)||offsetSeconds<0||offsetSeconds>soundtrackMaxOffsetSeconds)throw Error('Soundtrack offsetSeconds must be between 0 and 86400');
 if(typeof volume!=='number'||!Number.isFinite(volume)||volume<0||volume>1)throw Error('Soundtrack volume must be between 0 and 1');
 return Object.freeze({path,absolutePath,sha256:raw.sha256,offsetSeconds,volume});
}
/** Display name of the linked file (last path segment). */
export function soundtrackFileName(soundtrack:Pick<SceneSoundtrack,'absolutePath'>):string{
 return soundtrack.absolutePath.split(/[\\/]/).pop()||soundtrack.absolutePath;
}
