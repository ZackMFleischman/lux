import type {SceneStoryV2,StoryCapabilityV1} from '../../../../packages/runtime-contracts/src/story.mjs';
import type {StoryScheduleIdentity,StoryScheduleStatus} from '../controls/story-schedule.mjs';
export type StoryScheduleStatusAdmissionTrusted=Readonly<{manifest:Readonly<{story:SceneStoryV2;storyHash:string}>;identity:StoryScheduleIdentity;visualCapabilities:readonly Readonly<{visualId:string;storyCapability:StoryCapabilityV1|null}>[];priorStatus?:StoryScheduleStatus|null}>;
export declare function validateStoryScheduleStatus(candidate:unknown,trusted:StoryScheduleStatusAdmissionTrusted):StoryScheduleStatus;
export type StoryScheduleReceiptAdmissionTrusted=Readonly<{definition:SceneStoryV2;commandId:string;action:string;previous?:Readonly<{storyRevision:number}>|null}>;
export declare function validateStoryScheduleReceipt(receipt:unknown,trusted:StoryScheduleReceiptAdmissionTrusted):Readonly<{result:'applied';commandId:string;action:string;storyRevision:number;frameId:string;timeSeconds:number;story:unknown}>;
