export interface JpegImage {
  width: number;
  height: number;
  colorSpace: 'srgb';
  alphaMode: 'straight';
  data: Uint8Array;
}
export interface JpegInfo {
  width: number;
  height: number;
  byteLength: number;
  rgbaByteLength: number;
}
export interface JpegDecodeOptions {
  /** Remaining aggregate RGBA allocation budget, from 0 to 2097152. */
  maxRgbaBytes?: number;
}
/** Full synchronous decode; dimensions and pixels include EXIF orientation. */
export function decodeJpeg(bytes: Uint8Array, options?: JpegDecodeOptions): JpegImage;
/** Full decode validation; returns oriented metadata and discards pixels. */
export function validateJpeg(bytes: Uint8Array, options?: JpegDecodeOptions): JpegInfo;
