export interface PngImage {
  width: number;
  height: number;
  colorSpace: 'srgb';
  alphaMode: 'straight';
  data: Uint8Array;
}
export interface PngInfo {
  width: number;
  height: number;
  byteLength: number;
  rgbaByteLength: number;
}
export interface PngDecodeOptions {
  /** Remaining aggregate RGBA allocation budget, from 0 to 2097152. */
  maxRgbaBytes?: number;
}
/** Full bounded synchronous decode of a private original-byte snapshot. */
export function decodePng(bytes: Uint8Array, options?: PngDecodeOptions): PngImage;
/** Full decode validation; returns metadata and discards derived pixels. */
export function validatePng(bytes: Uint8Array, options?: PngDecodeOptions): PngInfo;
