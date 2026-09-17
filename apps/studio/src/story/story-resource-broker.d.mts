import type {SharedCapsuleVisual} from '../../../build-worker/src/shared-link-identity.mjs';
import type {StoryAssetBrokerRequest,StoryAssetBrokerResponse,StoryAssetDecodeRequest,StoryAssetGenerationIdentity} from '../assets/story-asset-leases.mjs';
import type {StoryScheduleResources} from '../controls/story-schedule.mjs';

export type StoryGenerationResourceGrant=Readonly<{
 identity:StoryAssetGenerationIdentity;width:number;height:number;maxSlots:2;maxPendingCreates:1;
 storyTargetBytes:number;assetLeaseBytes:6291456;
}>;
export type StoryCaptureResourceGrant=Readonly<{
 identity:StoryAssetGenerationIdentity;requestId:string;grantId:string;readbackBytes:number;
}>;
export type StoryResourceBrokerStatus=Readonly<{
 generations:readonly Readonly<{identity:StoryAssetGenerationIdentity;unreclaimed:boolean;storyTargetBytes:number;assetLeaseBytes:number}>[];
 storyTargetBytes:number;assetLeaseBytes:number;assetStagingBytes:number;readbackBytes:number;
}>;
export type StoryResourceBroker=Readonly<{
 /** Host-only. Visuals must come from its verified capsule matching identity.capsuleHash. */
 reserveGeneration(identity:StoryAssetGenerationIdentity,width:number,height:number,visuals:readonly Pick<SharedCapsuleVisual,'id'|'assetSetHash'|'assets'>[]):StoryGenerationResourceGrant;
 handle(request:StoryAssetBrokerRequest):StoryAssetBrokerResponse;
 /** Validates one authorized request and returns a frozen request built from admitted assets. */
 authorizeDecode(request:unknown):StoryAssetDecodeRequest;
 /** Host-only actual decoder settlement. Never call for a timeout or forced termination. */
 finishDecode(identity:StoryAssetGenerationIdentity,stagingGrantId:string,decodeRequestId:string,outcome:'decoded'|'failed'):void;
 /** Host-local once-only operation; protocol retries must not invoke it twice. */
 reserveCapture(identity:StoryAssetGenerationIdentity,requestId:string):StoryCaptureResourceGrant;
 releaseCapture(identity:StoryAssetGenerationIdentity,grantId:string):void;
 releaseGeneration(identity:StoryAssetGenerationIdentity,resources:StoryScheduleResources):void;
 markUnreclaimed(identity:StoryAssetGenerationIdentity):void;
 status():StoryResourceBrokerStatus;
}>;
export function createStoryResourceBroker():StoryResourceBroker;
