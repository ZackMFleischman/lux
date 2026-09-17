import type {SceneStoryV2,StoryCapabilityV1,StoryFrame} from '../../../../packages/runtime-contracts/src/story.mjs';

export type StoryScheduleIdentity=Readonly<{instanceId:string;generation:number;scheduleHash:string;capsuleHash:string}>;
export type StoryScheduleSlotCounts=Readonly<{preparing:number;ready:number;active:number;retiring:number;unsettled:number}>;
export type StoryScheduleResources=Readonly<{
 slots:number;slotStates:StoryScheduleSlotCounts;pendingCreates:number;storyTargetBytes:number;
 assetLeases:number;assetLeaseBytes:number;assetStagingJobs:number;assetStagingBytes:number;
 pendingImports:number;ownedModuleURLs:number;pendingCallbacks:number;gpuSubmissions:number;readbackGrants:number;readbackBytes:number;
}>;
export type StoryScheduleActivation=Readonly<{
 slotId:string;visualId:string;beatId:string|null;occurrenceId:string|null;
 activationId:number;storyEpoch:number;frame:StoryFrame;
}>;
export type StorySchedulePendingPreparation=Readonly<{
 token:string;phase:'preparing'|'ready'|'cancelled';visualId:string;beatId:string|null;
 occurrenceId:string|null;commandId:string|null;cancelled:boolean;
}>;
export type StoryScheduleDueNext=Readonly<{occurrenceId:string;state:'waiting'}>;
export type StoryScheduleStatus=Readonly<StoryScheduleIdentity&{
 definition:SceneStoryV2;storyHash:string;
 visualCapabilities:readonly Readonly<{visualId:string;storyCapability:StoryCapabilityV1|null}>[];
 storyRevision:number;phase:'running'|'paused';autoAdvance:boolean;loop:boolean;effectiveAdvancing:boolean;
 committed:StoryScheduleActivation|null;outgoing:StoryScheduleActivation|null;incoming:StoryScheduleActivation|null;
 crossfadeProgress:number|null;pendingPreparation:StorySchedulePendingPreparation|null;dueNext:StoryScheduleDueNext|null;
 preparationFailure:Readonly<{visualId:string;beatId:string|null;occurrenceId:string|null;code:string;message:string}>|null;
 sequence:Readonly<{state:'detached'|'attached'|'ended';occurrenceId:string|null;index:number|null;nextOccurrenceId:string|null;dwellElapsedSeconds:number;dwellRemainingSeconds:number|null;awaitingCue:boolean}>;
 disabledReasons:Readonly<Record<string,Readonly<{code:string;message:string}>>>;
 resources:StoryScheduleResources;
}>;
export type StoryPreparation=Readonly<{token:string;slotKey:string;visualId:string;beatId:string|null;occurrenceId:string|null;commandId:string|null;requestedAt:number;storyFrame:StoryFrame}>;
export type StoryScheduleDecision=Readonly<{result:'preparing';preparation:StoryPreparation}>|Readonly<{result:'waiting'}>|Readonly<{result:'applied';commandId:string|null;storyRevision:number;status:StoryScheduleStatus;cancelledCommandId?:string}>;
export type StoryScheduleReceipt=Readonly<{result:'applied';commandId:string|null;storyRevision:number;frameId:string;timeSeconds:number;status:StoryScheduleStatus}>;
export function createStorySchedule(input:Readonly<{story:SceneStoryV2;storyHash:string;visualCapabilities:readonly Readonly<{visualId:string;storyCapability:StoryCapabilityV1|null}>[];identity:StoryScheduleIdentity}>):Readonly<{
 initialize(now:number):Extract<StoryScheduleDecision,{result:'preparing'}>;
 request(input:Readonly<Record<string,unknown>>,now:number):StoryScheduleDecision;
 prepared(token:string,input:Readonly<{slotId:string}>):Readonly<{accepted:boolean;reason?:string}>;
 stageCommit(token:string,now:number,frameId:string):Readonly<{token:string;rows:readonly Readonly<{role:'committed'|'outgoing'|'incoming';slotId:string;weight:number;story:StoryFrame}>[]}>;
 publishCommit(stage:Readonly<Record<string,unknown>>):StoryScheduleReceipt;
 cancel(token:string,reason?:string):Readonly<{cancelled:boolean;retiring?:boolean}>;
 preparationSettled(token:string):boolean;preparationFailed(token:string,error:unknown):boolean;settleRetirement(slotId:string):boolean;releaseSlot(slotId:string):boolean;
 beginFrame(now:number,previewPlaying?:boolean):StoryScheduleStatus;completePresentedFrame(now:number,previewPlaying?:boolean):void;restartPending():boolean;restartAfterEndpoint(now:number):boolean;completeFrame(now:number):void;takeDue(now:number):StoryScheduleDecision;
 frames(now:number):readonly Readonly<{role:'committed'|'outgoing'|'incoming';slotId:string;weight:number;story:StoryFrame}>[];
 status(now:number,previewPlaying?:boolean):StoryScheduleStatus;
}>;
