import type { NodeId, EdgeId } from './identities.ts';
import type { ComponentMetadata } from './components.mjs';

// Internal resolved metadata only: these contracts convey no execution capability,
// persisted project identity, source-byte provenance or resource ownership.
export const graphLimits = Object.freeze({ nodes:128, edges:512, definitions:128,
  graphBytes:262144, definitionMetadataBytes:1048576, rawBytes:2097152,
  rawValues:100000, rawDepth:16 });
export type DefinitionHash = string;
export type NodePath = readonly NodeId[];
export type PortRef = Readonly<{ nodeId:NodeId; portId:string }>;
export type GraphNode = Readonly<{ id:NodeId; definitionHash:DefinitionHash }>;
export type GraphEdge = Readonly<{ id:EdgeId; from:PortRef; to:PortRef; delay:'none' }>;
export type FlatGraph = Readonly<{ version:1; nodes:readonly GraphNode[]; edges:readonly GraphEdge[]; finalOutput:PortRef }>;
export type ResolvedDefinition = Readonly<{ kind:'code'; metadata:ComponentMetadata }>;
export type ResolvedDefinitions = Readonly<Record<DefinitionHash,ResolvedDefinition>>;
export type ValidatedGraph = Readonly<{ graph:FlatGraph; definitions:ResolvedDefinitions }>;
export type PlannedInput = Readonly<{ portId:string; source:Readonly<{ nodePath:NodePath; portId:string }> }>;
export type PlannedNode = Readonly<{ nodePath:NodePath; definitionHash:DefinitionHash; inputs:readonly PlannedInput[] }>;
export type ExecutionPlan = Readonly<{ version:1; nodes:readonly PlannedNode[]; definitions:ResolvedDefinitions; finalOutput:Readonly<{ nodePath:NodePath; portId:string }> }>;
