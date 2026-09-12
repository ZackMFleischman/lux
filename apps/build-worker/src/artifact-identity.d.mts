import type { CompiledArtifact } from '../../../packages/runtime-contracts/src/index.ts';
import type { DerivedAssets, HashBytes } from '../../../packages/assets/src/index.mjs';
import type { ControlSchema } from '../../../packages/runtime-contracts/src/parameters.mjs';
type LegacyArtifact = Exclude<CompiledArtifact, {artifactVersion:2|3}>;
type AssetArtifact = Extract<CompiledArtifact, {artifactVersion:2}>;
type ParameterArtifact = Extract<CompiledArtifact, {artifactVersion:3}>;
export type ArtifactBody = Omit<LegacyArtifact,'bundleHash'> | Omit<AssetArtifact,'bundleHash'> | Omit<ParameterArtifact,'bundleHash'>;
export interface LinkerIdentity {version:'0.28.2';implementationHash:string;apiHash:string;binaryHash:string}
export interface LegacyLinkedEnvelope {code:string;sourceMap:string;bundleHash:string;linker:LinkerIdentity;linkedHash:string}
export interface AssetLinkedEnvelope extends LegacyLinkedEnvelope {linkedVersion:2;assets:DerivedAssets;assetSetHash:string}
export interface ParameterLinkedEnvelope extends LegacyLinkedEnvelope {linkedVersion:3;assets:DerivedAssets;assetSetHash:string;controls:ControlSchema;controlSchemaHash:string}
export type LinkedEnvelope = LegacyLinkedEnvelope | AssetLinkedEnvelope | ParameterLinkedEnvelope;
export type LinkedBody = Omit<LegacyLinkedEnvelope,'linkedHash'> | Omit<AssetLinkedEnvelope,'linkedHash'> | Omit<ParameterLinkedEnvelope,'linkedHash'>;
/** Canonical body constructors; call verify functions for cryptographic admission. */
export function artifactBody(input:unknown): ArtifactBody;
export function linkedBody(input:unknown): LinkedBody;
export function verifyArtifact(input:unknown,hashBytes:HashBytes): Promise<CompiledArtifact>;
/** expectedArtifact, when supplied, must already be verified by the caller. */
export function verifyLinked(input:unknown,hashBytes:HashBytes,expectedArtifact?:CompiledArtifact): Promise<LinkedEnvelope>;
