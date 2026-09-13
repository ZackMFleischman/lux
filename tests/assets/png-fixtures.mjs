// Independent fixture writer: Node zlib, literal scanlines, no production codec.
import { deflateSync } from 'node:zlib';
export function u32(value) { const b = Buffer.alloc(4); b.writeUInt32BE(value); return b; }
export function chunk(type, data = []) {
  const payload = Buffer.from(data), body = Buffer.concat([Buffer.from(type), payload]);
  let crc = 0xffffffff;
  for (const byte of body) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return Buffer.concat([u32(payload.length), body, u32((crc ^ 0xffffffff) >>> 0)]);
}
export const signature = Buffer.from([137,80,78,71,13,10,26,10]);
export function png({ width = 1, height = 1, depth = 8, type = 6, interlace = 0, rows = [0,255,0,0,128], before = [], after = [], compressed, split = false } = {}) {
  const header = Buffer.concat([u32(width),u32(height),Buffer.from([depth,type,0,0,interlace])]);
  const idat = compressed ?? deflateSync(Buffer.from(rows));
  const data = split ? [chunk('IDAT',idat.subarray(0,3)),chunk('IDAT',idat.subarray(3))] : [chunk('IDAT',idat)];
  return Buffer.concat([signature,chunk('IHDR',header),...before,...data,...after,chunk('IEND')]);
}
