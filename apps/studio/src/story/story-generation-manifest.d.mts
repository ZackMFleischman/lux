import type {SharedVisualCapsule} from '../../../build-worker/src/shared-link-identity.mjs';
import type {StorySceneDocumentV7} from '../../../../packages/core/src/story-scene-v2.ts';
import type {SceneStoryV2} from '../../../../packages/runtime-contracts/src/story.mjs';
import type {ControlAnimationBinding} from '../../../../packages/runtime-contracts/src/control-animation.mjs';
import type {ControlMigration,ControlSchema,ControlValues} from '../../../../packages/runtime-contracts/src/parameters.mjs';

export type StoryGenerationVisualIdentity=Readonly<{
 visualId:string;entry:string;entryCodeHash:string;sourceHash:string;bundleHash:string;
 controlSchemaHash:string;storyCapabilityHash:string|null;assetSetHash:string;
}>;
export type StoryGenerationManifest=Readonly<{
 version:1;story:SceneStoryV2;storyHash:string;capsuleHash:string;scheduleHash:string;
 visuals:readonly StoryGenerationVisualIdentity[];
}>;
export type StoryInitialVisualState=Readonly<{
 visualId:string;sdkVersion:'0.2.0';controlSchema:ControlSchema;controlSchemaHash:string;
 controls:ControlValues;controlSequence:number;controlAnimations:readonly ControlAnimationBinding[];animationSequence:number;
}>;
export type StoryVisualMigration=Readonly<{visualId:string}&ControlMigration>;
export type PreparedStoryGeneration=Readonly<{
 manifest:StoryGenerationManifest;initialVisualStates:readonly StoryInitialVisualState[];migrationIssues:readonly StoryVisualMigration[];
}>;
export function canonicalStoryScheduleJson(input:Pick<StoryGenerationManifest,'story'|'capsuleHash'|'visuals'>):string;
/** Capsule must be an immutable full or structural shared-capsule admission. */
export function prepareStoryGenerationManifest(document:StorySceneDocumentV7,capsule:SharedVisualCapsule):Promise<PreparedStoryGeneration>;
/** Strictly re-admits the host preparation after structured clone in a pristine worker. */
export function verifyStoryGenerationPreparation(input:{readonly manifest:unknown;readonly initialVisualStates:unknown},capsule:SharedVisualCapsule):Promise<Pick<PreparedStoryGeneration,'manifest'|'initialVisualStates'>>;
