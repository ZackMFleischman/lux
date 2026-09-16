export type ShaderFieldPortDescriptor = Readonly<{ kind: 'shader-field'; version: 1; abi: string }>;
export type ShaderFieldSnapshot = Readonly<{
  version: 1;
  abi: string;
  fragments: Readonly<Record<string, string>>;
  values: Readonly<Record<string, number>>;
}>;
export const shaderFieldLimits: Readonly<{ abi: 96; key: 64; fragments: 32; values: 128; totalUTF8Bytes: 262144 }>;
export function normalizeShaderFieldSnapshot(input: unknown): ShaderFieldSnapshot;
