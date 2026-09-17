/** Trusted pre-import worker operation. The importer must be supplied by runtime code. */
export function loadAuthoredModule<T>(message:unknown,importModule:(code:string)=>Promise<T>):Promise<{module:T;assets:ReadonlyMap<string,Readonly<Uint8Array>>;images:ReadonlyMap<string,import('../../../packages/assets/src/index.mjs').DecodedImage>}>;

export function prepareAuthoredModule(message:unknown):Promise<{readonly admission:Readonly<{kind:'legacy'|'visual'|'component'|'composition';sdkVersion?:string;component?:import('../../../packages/runtime-contracts/src/components.mjs').ComponentMetadata;composition?:import('../../../packages/runtime-contracts/src/composition-profile.mjs').ImageCompositionProfile;controls?:import('../../../packages/runtime-contracts/src/parameters.mjs').ControlSchema;controlSchemaHash?:string}>;import<T>(importer:(code:string)=>Promise<T>):ReturnType<typeof loadAuthoredModule<T>>}>;

import type {SharedVisualCapsule} from '../../build-worker/src/shared-link-identity.mjs';
import type {StoryGenerationManifest,StoryInitialVisualState} from './story/story-generation-manifest.mjs';
import type {PreparedStoryAssetLeaseFactory,StoryAssetBroker,StoryAssetDecoder,StoryAssetGenerationIdentity,StoryAssetLeaseStatus} from './assets/story-asset-leases.mjs';
export type PreparedWorkerVisualControls=Readonly<{sdkVersion:string;controlSchema:import('../../../packages/runtime-contracts/src/parameters.mjs').ControlSchema;controlSchemaHash:string;createSlot(snapshot?:unknown):unknown}>;
export type PreparedAuthoredGenerationVisual=Readonly<{visualId:string;admission:Readonly<{kind:'visual'|'story';sdkVersion:'0.2.0';controls:import('../../../packages/runtime-contracts/src/parameters.mjs').ControlSchema;controlSchemaHash:string;storyCapability?:import('../../../packages/runtime-contracts/src/story.mjs').StoryCapabilityV1;storyCapabilityHash?:string}>;controls:PreparedWorkerVisualControls}>;
export function prepareAuthoredGenerationFactories(message:Readonly<{identity:StoryAssetGenerationIdentity;capsule:SharedVisualCapsule;manifest:StoryGenerationManifest;initialVisualStates:readonly StoryInitialVisualState[]}>,ports:Readonly<{broker:StoryAssetBroker;decoder:StoryAssetDecoder;requestId?:()=>string}>):Promise<Readonly<{
 preparation:Readonly<{manifest:StoryGenerationManifest;initialVisualStates:readonly StoryInitialVisualState[]}>;visual(id:string):PreparedAuthoredGenerationVisual;assets:PreparedStoryAssetLeaseFactory;
 status():Readonly<{identity:StoryAssetGenerationIdentity;assetResources:StoryAssetLeaseStatus}>;dispose():Promise<void>;
}>>;
