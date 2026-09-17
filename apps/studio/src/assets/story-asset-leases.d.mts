import type {DerivedAssets,DecodedImage} from '../../../../packages/assets/src/index.mjs';
import type {SharedVisualCapsule} from '../../../build-worker/src/shared-link-identity.mjs';

export type StoryAssetGenerationIdentity=Readonly<{instanceId:string;generation:number;scheduleHash:string;capsuleHash:string}>;
export type StoryAssetCharge=Readonly<{encodedBytes:number;rgbaBytes:number;totalBytes:number}>;
export type StoryAssetBrokerRequest=
 | Readonly<{kind:'story-asset-staging-reserve';requestId:string;identity:StoryAssetGenerationIdentity;visualId:string;assetSetHash:string;decoderVersion:string;charge:StoryAssetCharge}>
 | Readonly<{kind:'story-asset-staging-release';requestId:string;identity:StoryAssetGenerationIdentity;grantId:string;disposition:'verified'|'failed'|'cancelled'}>
 | Readonly<{kind:'story-asset-decode-authorize';requestId:string;decodeRequestId:string;identity:StoryAssetGenerationIdentity;grantId:string;mode:'verify'|'lease';visualId:string;assetSetHash:string;decoderVersion:string;charge:StoryAssetCharge}>
 | Readonly<{kind:'story-asset-staging-transfer';requestId:string;identity:StoryAssetGenerationIdentity;grantId:string;leaseKey:string}>
 | Readonly<{kind:'story-asset-lease-release';requestId:string;identity:StoryAssetGenerationIdentity;leaseGrantId:string;leaseKey:string}>;
export type StoryAssetBrokerResponse=
 | Readonly<{kind:'story-asset-staging-granted';requestId:string;identity:StoryAssetGenerationIdentity;grantId:string;visualId:string;assetSetHash:string;decoderVersion:string;charge:StoryAssetCharge}>
 | Readonly<{kind:'story-asset-staging-released';requestId:string;identity:StoryAssetGenerationIdentity;grantId:string;disposition:'verified'|'failed'|'cancelled'}>
 | Readonly<{kind:'story-asset-decode-authorized';requestId:string;decodeRequestId:string;identity:StoryAssetGenerationIdentity;grantId:string;mode:'verify'|'lease';visualId:string;assetSetHash:string;decoderVersion:string;charge:StoryAssetCharge}>
 | Readonly<{kind:'story-asset-lease-granted';requestId:string;identity:StoryAssetGenerationIdentity;grantId:string;leaseGrantId:string;leaseKey:string;charge:StoryAssetCharge}>
 | Readonly<{kind:'story-asset-lease-released';requestId:string;identity:StoryAssetGenerationIdentity;leaseGrantId:string;leaseKey:string}>;
export type StoryAssetBroker=(request:StoryAssetBrokerRequest)=>Promise<StoryAssetBrokerResponse>;

export type StoryAssetDecodeRequest=Readonly<{
 kind:'story-assets-decode';mode:'verify'|'lease';requestId:string;identity:StoryAssetGenerationIdentity;
 stagingGrantId:string;decoderVersion:string;visualId:string;assetSetHash:string;assets:DerivedAssets;
}>;
export type StoryAssetDecodedRow=Readonly<{path:string;mediaType:'image/bmp'|'image/png'|'image/jpeg';encoded:Uint8Array;width:number;height:number;pixels:Uint8Array}>;
export type StoryAssetDecodeResult=
 | Readonly<{kind:'story-assets-decoded';mode:'verify'|'lease';requestId:string;identity:StoryAssetGenerationIdentity;stagingGrantId:string;decoderVersion:string;visualId:string;assetSetHash:string;charge:StoryAssetCharge;rows:readonly StoryAssetDecodedRow[]}>
 | Readonly<{kind:'story-assets-decode-error';requestId:string;identity:StoryAssetGenerationIdentity;stagingGrantId:string;visualId:string;assetSetHash:string;code:string;message:string}>;
export type StoryAssetDecoder=(request:StoryAssetDecodeRequest)=>Promise<StoryAssetDecodeResult>;
export const storyAssetDecoderVersion:'lux-story-assets-v1';
export function storyAssetLeaseKey(assetSetHash:string):string;

export type StoryAssetLease=Readonly<{
 leaseId:string;visualId:string;assetSetHash:string;chargedBytes:number;
 assets:ReadonlyMap<string,Readonly<Uint8Array>>;images:ReadonlyMap<string,DecodedImage>;
 release():Promise<boolean>;
}>;
export type StoryAssetLeaseStatus=Readonly<{closed:boolean;leaseCount:number;backingEntries:number;assetLeaseBytes:number;pendingStagingJobs:number;assetStagingBytes:number}>;
export type PreparedStoryAssetLeaseFactory=Readonly<{
 verifyAll():Promise<void>;acquire(visualId:string,slotKey:string):Promise<StoryAssetLease>;
 status():StoryAssetLeaseStatus;dispose():Promise<void>;
}>;
export function prepareStoryAssetLeaseFactory(input:Readonly<{
 identity:StoryAssetGenerationIdentity;capsule:SharedVisualCapsule;broker:StoryAssetBroker;decoder:StoryAssetDecoder;requestId?:()=>string;
}>):Promise<PreparedStoryAssetLeaseFactory>;
