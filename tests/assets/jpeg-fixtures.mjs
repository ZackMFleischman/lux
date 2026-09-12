import { readFileSync } from 'node:fs';
export const fixture = name => new Uint8Array(readFileSync(new URL(`./fixtures/jpeg/${name}.jpg`,import.meta.url)));
export function segment(marker, data = []) {
  const bytes = Buffer.from(data), header = Buffer.from([255,marker,0,0]);
  header.writeUInt16BE(bytes.length+2,2);
  return Buffer.concat([header,bytes]);
}
export const insert = (bytes,...segments) => Buffer.concat([bytes.subarray(0,2),...segments,bytes.subarray(2)]);
export function exif(orientation, little = true) {
  const tiff = Buffer.alloc(26); tiff.write(little ? 'II' : 'MM');
  const short = (value,at) => little ? tiff.writeUInt16LE(value,at) : tiff.writeUInt16BE(value,at);
  const long = (value,at) => little ? tiff.writeUInt32LE(value,at) : tiff.writeUInt32BE(value,at);
  short(42,2); long(8,4); short(1,8); short(0x112,10); short(3,12); long(1,14); short(orientation,18);
  return segment(0xe1,Buffer.concat([Buffer.from('Exif\0\0'),tiff]));
}
export function findSegment(bytes, marker) {
  for (let i = 2; i < bytes.length-1; i++) if (bytes[i] === 255 && bytes[i+1] === marker) return i;
  throw new Error('fixture marker missing');
}
// Hand-derived T.81 baseline grayscale: DC category 0 + EOB (one-bit codes),
// quantization all ones. Each block is uniformly 128. No encoder dependency.
export function restartGray({restart = 2, width = 24, entropy = [0x0f,255,0xd0,0x3f], ac = 0} = {}) {
  const codes = [1,...new Uint8Array(15),0];
  return Buffer.concat([Buffer.from([255,0xd8]),segment(0xdb,[0,...new Uint8Array(64).fill(1)]),
    segment(0xc0,[8,0,8,width>>>8,width&255,1,1,0x11,0]),segment(0xc4,[0,...codes,0x10,1,...new Uint8Array(15),ac]),
    segment(0xdd,[restart>>>8,restart&255]),segment(0xda,[1,1,0,0,63,0]),Buffer.from(entropy),Buffer.from([255,0xd9])]);
}
export function progressiveGray(scanCount, {ac = 0, acEntropy = [0x7f]} = {}) {
  const codes = [1,...new Uint8Array(15),0];
  const pieces = [Buffer.from([255,0xd8]),segment(0xdb,[0,...new Uint8Array(64).fill(1)]),segment(0xc2,[8,0,8,0,8,1,1,0x11,0]),segment(0xc4,[0,...codes,0x10,1,...new Uint8Array(15),ac]),segment(0xda,[1,1,0,0,0,0]),Buffer.from([0x7f])];
  for (let i = 0; i < scanCount-1; i++) {
    const ss = 1+i*4, se = i === scanCount-2 ? 63 : ss+3;
    pieces.push(segment(0xda,[1,1,0,ss,se,0]),Buffer.from(acEntropy));
  }
  return Buffer.concat([...pieces,Buffer.from([255,0xd9])]);
}
