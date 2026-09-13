import type { ControlDeclarations, ControlSchema } from './parameters.mjs';

export type InitialPortType =
  | { readonly kind: 'signal'; readonly value: 'number'; readonly unit: string | null; readonly clock: 'frame' }
  | { readonly kind: 'image'; readonly colorSpace: 'linear-srgb'; readonly alphaMode: 'premultiplied' };
export type PortDeclaration = {
  readonly type: InitialPortType; readonly label: string; readonly description: string;
};
export type ComponentDeclaration = {
  readonly declarationVersion: 1;
  readonly key: string; readonly label: string; readonly description: string; readonly tags: readonly string[];
  readonly inputs: Readonly<Record<string, PortDeclaration>>;
  readonly outputs: Readonly<Record<string, PortDeclaration>>;
  readonly controls: ControlDeclarations;
  readonly controlDescriptions: Readonly<Record<string, string>>;
  readonly lifecycle: { readonly state: 'stateless' | 'stateful'; readonly reset: 'seed' };
};
export type ComponentMetadata = Omit<ComponentDeclaration, 'controls'> & { readonly controls: ControlSchema };
export const componentMetadataLimits: Readonly<{
  registryEntries: 128; inputs: 16; outputs: 16; controls: 32; tags: 16; tag: 32;
  key: 96; portId: 64; label: 80; description: 512; signalUnit: 24;
  metadataBytes: 65536; registryBytes: 1048576;
}>;
export function normalizeComponentDeclaration(input: unknown): ComponentMetadata;
export function normalizeComponentMetadata(input: unknown): ComponentMetadata;
/** Canonical UTF-8 JSON input for caller-owned hashing, not execution identity. */
export function canonicalComponentMetadataJson(input: unknown): string;
