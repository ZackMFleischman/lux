import type { CompiledArtifact } from '../../../packages/runtime-contracts/src/index.ts';
import type { DerivedAssets, HashBytes } from '../../../packages/assets/src/index.mjs';
type LegacyArtifact = Exclude<CompiledArtifact, {artifactVersion:2}>;
type AssetArtifact = Extract<CompiledArtifact, {artifactVersion:2}>;
export type ArtifactBody = Omit<LegacyArtifact,'bundleHash'> | Omit<AssetArtifact,'bundleHash'>;
export interface LinkerIdentity {version:'0.28.2';implementationHash:string;apiHash:string;binaryHash:string}
export interface LegacyLinkedEnvelope {code:string;sourceMap:string;bundleHash:string;linker:LinkerIdentity;linkedHash:string}
export interface AssetLinkedEnvelope extends LegacyLinkedEnvelope {linkedVersion:2;assets:DerivedAssets;assetSetHash:string}
export type LinkedEnvelope = LegacyLinkedEnvelope | AssetLinkedEnvelope;
export type LinkedBody = Omit<LegacyLinkedEnvelope,'linkedHash'> | Omit<AssetLinkedEnvelope,'linkedHash'>;
/** Canonical body constructors; call verify functions for cryptographic admission. */
export function artifactBody(input:unknown): ArtifactBody;
export function linkedBody(input:unknown): LinkedBody;
export function verifyArtifact(input:unknown,hashBytes:HashBytes): Promise<CompiledArtifact>;
/** expectedArtifact, when supplied, must already be verified by the caller. */
export function verifyLinked(input:unknown,hashBytes:HashBytes,expectedArtifact?:CompiledArtifact): Promise<LinkedEnvelope>;
