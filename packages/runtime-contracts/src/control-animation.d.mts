import type {NodePath} from './graph.ts';
export type ControlAnimationShape='sine'|'triangle'|'saw'|'square';
/** Empty nodePath identifies a flat scene control. Non-empty paths identify canonical component leaves. */
export type ControlAnimationBinding=Readonly<{nodePath:NodePath;definitionHash:string;schemaHash:string;controlId:string;shape:ControlAnimationShape;periodSeconds:number;amount:number;phase:number;enabled:boolean}>;
export type ControlAnimationIssue=Readonly<{index:number;nodePath:NodePath;controlId:string;message:string}>;
export function validateControlAnimationBindings(input:unknown):readonly ControlAnimationBinding[];
