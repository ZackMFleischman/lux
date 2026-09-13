import type { NodeId } from './identities.ts';
import type { ComponentMetadata } from './components.mjs';
import type { ControlSchema, ControlValues } from './parameters.mjs';
import type { DefinitionHash, NodePath, PortRef, GraphEdge, PlannedInput, ResolvedDefinitions } from './graph.ts';
export type { DefinitionHash, NodePath } from './graph.ts';

// Internal admission/planning DTOs, not persisted identities or execution authority.
export const nestedGraphLimits = Object.freeze({definitions:128, nodesPerBody:128, edgesPerBody:512,
  bindingTargetsPerBody:2048, graphLevels:8, expandedPlacements:2048, expandedLeaves:512,
  expandedEdges:4096, expandedControlTargets:16384, resolutionSteps:65536, overrides:512,
  rawBytes:2097152, rawValues:100000, rawDepth:16, metadataBytes:1048576, bodyBytes:262144,
  allBodyBytes:1048576, overrideBytes:262144, outputBytes:4194304} as const);
export type NestedNode = Readonly<{id:NodeId; definitionHash:DefinitionHash; controlDefaults:ControlValues}>;
export type LocalControlRef = Readonly<{nodeId:NodeId; controlId:string}>;
export type GraphBody = Readonly<{nodes:readonly NestedNode[]; edges:readonly GraphEdge[];
  inputBindings:Readonly<Record<string,readonly PortRef[]>>; outputBindings:Readonly<Record<string,PortRef>>;
  controlBindings:Readonly<Record<string,readonly LocalControlRef[]>>}>;
export type NestedDefinition = Readonly<{kind:'code'; metadata:ComponentMetadata}> |
  Readonly<{kind:'graph'; metadata:ComponentMetadata; body:GraphBody}>;
export type NestedDefinitions = Readonly<Record<DefinitionHash,NestedDefinition>>;
export type NestedGraph = Readonly<{version:2; rootDefinitionHash:DefinitionHash; outputPort:string}>;
export type ValidatedNestedGraph = Readonly<{graph:NestedGraph; definitions:NestedDefinitions}>;
export type NodeControlOverride = Readonly<{nodePath:NodePath; values:ControlValues}>;
export type ExpandedControlRef = Readonly<{nodePath:NodePath; controlId:string}>;
export type PublicControlTarget = ExpandedControlRef & Readonly<{active:boolean}>;
export type NestedPlannedNode = Readonly<{nodePath:NodePath; definitionHash:DefinitionHash;
  inputs:readonly PlannedInput[]; initialControls:ControlValues}>;
export type NestedExecutionPlan = Readonly<{version:2; nodes:readonly NestedPlannedNode[];
  definitions:ResolvedDefinitions; finalOutput:Readonly<{nodePath:NodePath; portId:string}>;
  publicControls:ControlSchema; publicControlBindings:Readonly<Record<string,readonly PublicControlTarget[]>>;
  prunedNodePaths:readonly NodePath[]}>;
