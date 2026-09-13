import type {ControlSchema} from './parameters.mjs';
import type {NestedDefinitions,NestedGraph,PublicControlTarget} from './nested-graph.ts';
import type {NodePath,DefinitionHash} from './graph.ts';
export type ImageCompositionProfile=Readonly<{version:1;declaration:Readonly<{definitions:Readonly<Record<string,unknown>>;nodes:readonly unknown[];edges:readonly unknown[];output:unknown;expose:readonly unknown[]}>;definitionNames:Readonly<Record<string,DefinitionHash>>;graph:NestedGraph;definitions:NestedDefinitions;publicControls:ControlSchema;publicControlBindings:Readonly<Record<string,readonly PublicControlTarget[]>>;nodes:readonly Readonly<{nodePath:NodePath;definitionHash:DefinitionHash;schema:ControlSchema;schemaHash:string}>[]}>;
export function normalizeImageCompositionProfile(input:unknown):ImageCompositionProfile;
export function validateImageChainComponentProfile(input:unknown):import('./components.mjs').ComponentMetadata;
export function canonicalImageCompositionJson(input:unknown):string;
