export type StorySustainedCapability=Readonly<{id:string;kind:'sustained';seek:'none'}>;
export type StoryTimedCapability=Readonly<{id:string;kind:'timed';seek:'direct'}>;
export type StoryBeatCapability=StorySustainedCapability|StoryTimedCapability;
export type StoryCapabilityV1=Readonly<{version:1;beats:readonly StoryBeatCapability[]}>;
export type StoryCapabilityBeatDeclaration=Readonly<{kind:'sustained';seek:'none'}>|Readonly<{kind:'timed';seek:'direct'}>;
export type StoryCapabilityDeclaration=Readonly<{version:1;beats:Readonly<Record<string,StoryCapabilityBeatDeclaration>>}>;
export type StoryBeatIdsOf<S extends StoryCapabilityDeclaration|undefined=StoryCapabilityDeclaration>=S extends StoryCapabilityDeclaration?keyof S['beats']&string:never;

export type BeatTiming=Readonly<{kind:'sustained'}>|Readonly<{kind:'timed';durationSeconds:number}>;
export type StoryBeat=Readonly<{id:string;label:string;timing:BeatTiming}>;
export type StoryFollow=Readonly<{kind:'manual'}>|Readonly<{kind:'after';seconds:number}>;
export type StoryOccurrence=Readonly<{id:string;beatId:string;follow:StoryFollow}>;
export type SceneStoryV1=Readonly<{version:1;beats:readonly StoryBeat[];sequence:readonly StoryOccurrence[]}>;
export type StoryBeatV2=Readonly<StoryBeat&{visualId:string}>;
export type StoryOccurrenceV2=Readonly<StoryOccurrence&{visualId:string}>;
export type SceneStoryV2=Readonly<{version:2;normalVisualId:string;crossfadeSeconds:number;beats:readonly StoryBeatV2[];sequence:readonly StoryOccurrenceV2[]}>;
export type StoryVisualCapability=Readonly<{visualId:string;storyCapability:StoryCapabilityV1|null}>;

export type StoryNormalFrame=Readonly<{state:'normal';storyEpoch:number}>;
export type StoryActiveFrame<BeatId extends string=string>=Readonly<{
 state:'active';storyEpoch:number;beatId:BeatId;activationId:number;occurrenceId:string|null;
 elapsedSeconds:number;localTimeSeconds:number|null;progress:number|null;
}>;
export type StoryFrame<BeatId extends string=string>=StoryNormalFrame|StoryActiveFrame<BeatId>;

export const storyLimits:Readonly<{beats:128;occurrences:1024;id:128;label:160}>;
export const storyLifecycleLimits:Readonly<{
 sceneBytes:number;aggregateSourceTextBytes:number;linkedEnvelopeBytes:number;aggregateLinkedEnvelopeBytes:number;scheduleMetadataBytes:1048576;
 visuals:8;slotsPerGeneration:2;generationsPerClient:2;pendingCreatesPerGeneration:1;readyInactiveSlotsPerGeneration:1;
 lookaheadSeconds:5;preparationMs:5000;commandReceiptMs:8000;cleanupMs:5000;
 assetBackingPerGeneration:number;assetBackingPerClient:number;assetStagingPerClient:number;
 storyTargetBytesPerGeneration:201326592;storyTargetBytesPerClient:402653184;readbackBytesPerClient:33554432;pngBytes:41943040;
}>;
export function normalizeStoryCapabilityDeclaration(input:unknown):StoryCapabilityV1;
export function normalizeStoryCapability(input:unknown):StoryCapabilityV1;
export function canonicalStoryCapabilityJson(input:unknown):string;
export function normalizeSceneStory(input:unknown):SceneStoryV1;
export function canonicalSceneStoryJson(input:unknown):string;
export function validateStoryAgainstCapability(story:unknown,capability:unknown):SceneStoryV1;
export function normalizeSceneStoryV2(input:unknown):SceneStoryV2;
export function canonicalSceneStoryV2Json(input:unknown):string;
export function validateStoryV2Capabilities(story:unknown,rows:unknown):readonly StoryVisualCapability[];
