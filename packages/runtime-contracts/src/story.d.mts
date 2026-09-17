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

export type StoryNormalFrame=Readonly<{state:'normal';storyEpoch:number}>;
export type StoryActiveFrame<BeatId extends string=string>=Readonly<{
 state:'active';storyEpoch:number;beatId:BeatId;activationId:number;occurrenceId:string|null;
 elapsedSeconds:number;localTimeSeconds:number|null;progress:number|null;
}>;
export type StoryFrame<BeatId extends string=string>=StoryNormalFrame|StoryActiveFrame<BeatId>;

export const storyLimits:Readonly<{beats:128;occurrences:1024;id:128;label:160}>;
export function normalizeStoryCapabilityDeclaration(input:unknown):StoryCapabilityV1;
export function normalizeStoryCapability(input:unknown):StoryCapabilityV1;
export function canonicalStoryCapabilityJson(input:unknown):string;
export function normalizeSceneStory(input:unknown):SceneStoryV1;
export function canonicalSceneStoryJson(input:unknown):string;
export function validateStoryAgainstCapability(story:unknown,capability:unknown):SceneStoryV1;
