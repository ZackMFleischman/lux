import type {NodePath} from './graph.ts';
import type {AudioBandSource} from './audio-input.mjs';
export type ControlAnimationShape='sine'|'triangle'|'saw'|'square';
/** Empty nodePath identifies a flat scene control. Non-empty paths identify canonical component leaves. */
export type LfoControlAnimationBinding=Readonly<{kind?:never;nodePath:NodePath;definitionHash:string;schemaHash:string;controlId:string;shape:ControlAnimationShape;periodSeconds:number;amount:number;phase:number;enabled:boolean;source?:never;attackMs?:never;releaseMs?:never}>;
export type AudioControlAnimationBinding=Readonly<{kind:'audio';nodePath:NodePath;definitionHash:string;schemaHash:string;controlId:string;source:AudioBandSource;amount:number;attackMs:number;releaseMs:number;enabled:boolean;shape?:never;periodSeconds?:never;phase?:never}>;
export type ControlAnimationBinding=LfoControlAnimationBinding|AudioControlAnimationBinding;
export type ControlAnimationIssue=Readonly<{index:number;nodePath:NodePath;controlId:string;message:string}>;
export function validateControlAnimationBindings(input:unknown):readonly ControlAnimationBinding[];
