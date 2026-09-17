// New scene-local ABI. Reuses LoRegion's local frame to consume existing paint fields.
export const BAND_ABI = 'examples/folded-pigment-bands/v1';
export const BAND_VALUE_KEYS = ['scale', 'fold', 'flow', 'seed'] as const;

export function readField(
  data: { version: number; abi: string; fragments: Readonly<Record<string, string>>; values: Readonly<Record<string, number>> },
  abi: string,
  keys: readonly string[],
) {
  if (data.version !== 1 || data.abi !== abi || Object.keys(data.fragments).length !== 1 || typeof data.fragments.helpers !== 'string') {
    throw Error(`Pigment Rivers requires ${abi} with one helpers fragment`);
  }
  if (Object.keys(data.values).length !== keys.length || keys.some(key => !Number.isFinite(data.values[key]))) {
    throw Error(`Pigment Rivers ${abi} values do not match its declared contract`);
  }
  return data;
}
