import type {NodePath} from './graph.ts';
import type {AudioBandSource,AudioKickSource} from './audio-input.mjs';
export type ControlAnimationShape='sine'|'triangle'|'saw'|'square';
/** Empty nodePath identifies a flat scene control. Non-empty paths identify canonical component leaves. */
export type KickEnvelopeShape='linear'|'exponential';
export type LfoControlAnimationBinding=Readonly<{kind?:never;nodePath:NodePath;definitionHash:string;schemaHash:string;controlId:string;shape:ControlAnimationShape;periodSeconds:number;amount:number;phase:number;enabled:boolean;source?:never;attackMs?:never;releaseMs?:never;sensitivity?:never;retriggerMs?:never;envelope?:never}>;
export type AudioControlAnimationBinding=Readonly<{kind:'audio';nodePath:NodePath;definitionHash:string;schemaHash:string;controlId:string;source:AudioBandSource;amount:number;attackMs:number;releaseMs:number;enabled:boolean;shape?:never;periodSeconds?:never;phase?:never;sensitivity?:never;retriggerMs?:never;envelope?:never}>;
export type KickControlAnimationBinding=Readonly<{kind:'kick';nodePath:NodePath;definitionHash:string;schemaHash:string;controlId:string;source:AudioKickSource;amount:number;attackMs:number;releaseMs:number;sensitivity:number;retriggerMs:number;envelope:KickEnvelopeShape;enabled:boolean;shape?:never;periodSeconds?:never;phase?:never}>;
export type TempoControlAnimationBinding=Readonly<{kind:'tempo';nodePath:NodePath;definitionHash:string;schemaHash:string;controlId:string;shape:ControlAnimationShape;beatsPerCycle:number;amount:number;phase:number;enabled:boolean;source?:never;periodSeconds?:never;attackMs?:never;releaseMs?:never;sensitivity?:never;retriggerMs?:never;envelope?:never}>;
export type ControlAnimationBinding=LfoControlAnimationBinding|AudioControlAnimationBinding|KickControlAnimationBinding|TempoControlAnimationBinding;
export type ControlAnimationIssue=Readonly<{index:number;nodePath:NodePath;controlId:string;message:string}>;
export function validateControlAnimationBindings(input:unknown):readonly ControlAnimationBinding[];
