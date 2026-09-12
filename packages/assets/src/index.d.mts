export interface SourceAsset {
  readonly mediaType: 'image/bmp';
  readonly encoding: 'base64';
  readonly data: string;
}
export interface DerivedAsset extends SourceAsset {
  readonly byteLength: number;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
}
export type SourceAssets = Readonly<Record<string, SourceAsset>>;
export type DerivedAssets = Readonly<Record<string, DerivedAsset>>;
export interface BmpInfo {
  width: number;
  height: number;
  stride: number;
  byteLength: number;
  rgbaByteLength: number;
}
export interface DerivedAssetSet {
  readonly assets: DerivedAssets;
  readonly assetSetHash: string;
}
/** Trusted boundary callback; returns SHA-256 of exact bytes as lowercase hex. */
export type HashBytes = (bytes: Uint8Array) => string | Promise<string>;
export const assetLimits: Readonly<{
  count: 4; imageBytes: 786486; totalBytes: 1048576;
  rgbaBytes: 2097152; dimension: 512; pathCharacters: 240;
}>;
export function validateAssetPath(path: unknown): string;
export function decodeCanonicalBase64(data: unknown): Uint8Array;
export function validateBmp(bytes: Uint8Array): BmpInfo;
export function decodeBmp(bytes: Uint8Array): { width: number; height: number; data: Uint8Array };
export function validateSourceAssets(input: unknown): SourceAssets;
/** Validates derived shape/size/dimensions, but does not verify the SHA-256 claims. */
export function canonicalAssetSet(assets: unknown): string;
export function deriveAssets(input: unknown, hashBytes: HashBytes): Promise<DerivedAssetSet>;
export function verifyDerivedAssets(input: unknown, expectedAssetSetHash: string, hashBytes: HashBytes): Promise<DerivedAssetSet & { readonly sourceAssets: SourceAssets }>;
/** Construct before importing submitted code; every returned byte array is a fresh copy. */
export function createReadonlyAssetMap(input: unknown): ReadonlyMap<string, Readonly<Uint8Array>>;
