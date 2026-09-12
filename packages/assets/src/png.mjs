// Opt-in PNG codec adapter, deliberately separate from BMP-only admission.
import { decode as decodeFastPng } from 'fast-png';
import zlib from 'pako/lib/zlib/inflate.js';
import ZStream from 'pako/lib/zlib/zstream.js';
import { assetLimits } from './index.mjs';

const signature = [137, 80, 78, 71, 13, 10, 26, 10];
const allowedChunks = new Set(['IHDR','PLTE','tRNS','IDAT','IEND','sRGB','gAMA','cHRM','pHYs','tEXt','tIME']);
const srgbChromaticity = [31270,32900,64000,33000,30000,60000,15000,6000];
const typedArrayByteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get;
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let n = i;
  for (let bit = 0; bit < 8; bit++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0);
  crcTable[i] = n;
}
function fail(message, quota = false) {
  throw Object.assign(new Error(`PNG: ${message}`), {code:quota ? 'QUOTA_EXCEEDED' : 'ASSET_BOUNDARY_VIOLATION'});
}
function crc(bytes, start, end) {
  let n = 0xffffffff;
  for (let i = start; i < end; i++) n = (n >>> 8) ^ crcTable[(n ^ bytes[i]) & 255];
  return (n ^ 0xffffffff) >>> 0;
}

// The inflater retains only its bounded window plus this fixed output scratch.
// Count output before processing it; never concatenate inflated chunks. Exact
// termination rejects dictionary, Adler errors, second streams and unused tails.
function checkInflated(idat, rowBytes, height) {
  const expected = (rowBytes + 1) * height, stream = new ZStream();
  if (zlib.inflateInit2(stream, 15) !== 0) fail('cannot initialize zlib');
  const scratch = new Uint8Array(16384);
  let assigned = 0, produced = 0;
  try {
    for (;;) {
      if (stream.avail_in === 0 && assigned < idat.length) {
        const end = Math.min(assigned + 4096, idat.length);
        stream.input = idat.subarray(assigned,end); stream.next_in = 0;
        stream.avail_in = end - assigned; assigned = end;
      }
      stream.output = scratch; stream.next_out = 0;
      stream.avail_out = Math.min(scratch.length, expected + 1 - produced);
      const before = stream.total_in, status = zlib.inflate(stream, 0), count = stream.next_out;
      if (produced + count > expected) fail('inflated image exceeds expected size');
      for (let i = 0; i < count; i++) if ((produced + i) % (rowBytes + 1) === 0 && scratch[i] > 4) fail('invalid row filter');
      produced += count;
      if (status === 1) {
        if (produced !== expected || stream.avail_in !== 0 || assigned !== idat.length) fail('zlib output size or trailing data mismatch');
        return;
      }
      if (status !== 0 || (stream.total_in === before && count === 0)) fail('invalid, truncated or non-progressing zlib stream');
    }
  } finally { zlib.inflateEnd(stream); }
}

function inspect(bytes, maxRgbaBytes) {
  if (signature.some((n,i) => bytes[i] !== n)) fail('invalid signature');
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const seen = new Set(), idats = [];
  let at = 8, count = 0, ancillary = 0, idatLength = 0, phase = 0;
  let width, height, depth, type, channels, rowBytes, palette, transparency;
  while (at < bytes.length) {
    if (++count > 256) fail('too many chunks');
    if (bytes.length - at < 12) fail('truncated chunk');
    const length = view.getUint32(at), start = at + 8, end = start + length;
    if (length > bytes.length - at - 12) fail('chunk length exceeds file');
    const name = String.fromCharCode(...bytes.subarray(at+4,start));
    if (!allowedChunks.has(name)) fail(`unsupported chunk ${name}`);
    if (crc(bytes,at+4,end) !== view.getUint32(end)) fail(`invalid ${name} CRC`);
    if (count === 1 && name !== 'IHDR') fail('IHDR must be first');
    if (seen.has(name) && name !== 'IDAT' && name !== 'tEXt') fail(`duplicate ${name}`);
    if (name !== 'IDAT' && phase === 1) phase = 2;
    if ((bytes[at+4] & 32) !== 0) {
      ancillary += length;
      if (ancillary > 65536) fail('ancillary data exceeds 64 KiB');
    }
    const preData = () => { if (phase !== 0) fail(`${name} must precede IDAT`); };
    const exact = n => { if (length !== n) fail(`invalid ${name} length`); };
    switch (name) {
      case 'IHDR':
        exact(13);
        width = view.getUint32(start); height = view.getUint32(start+4);
        depth = bytes[start+8]; type = bytes[start+9];
        if (width < 1 || height < 1 || width > assetLimits.dimension || height > assetLimits.dimension) fail('dimensions must be 1..512');
        channels = ({0:1,2:3,3:1,4:2,6:4})[type];
        if (!channels || !(type === 3 ? [1,2,4,8].includes(depth) : depth === 8)) fail('unsupported color type or bit depth');
        if (bytes[start+10] || bytes[start+11] || bytes[start+12]) fail('unsupported compression, filter or interlace mode');
        if (width * height * 4 > maxRgbaBytes) fail('RGBA allocation budget exceeded',true);
        rowBytes = Math.ceil(width * channels * depth / 8);
        break;
      case 'PLTE':
        preData();
        if (seen.has('tRNS') || type === 0 || type === 4 || !length || length % 3 || length > 768 || (type === 3 && length / 3 > 2 ** depth)) fail('invalid palette');
        palette = bytes.subarray(start,end);
        break;
      case 'tRNS':
        preData();
        if (type === 3) {
          if (!palette || !length || length > palette.length / 3) fail('invalid palette transparency');
        } else if (type === 0 || type === 2) {
          exact(type === 0 ? 2 : 6);
          for (let i = start; i < end; i += 2) if (view.getUint16(i) > 255) fail('color-key transparency exceeds depth');
        } else fail('tRNS cannot accompany an alpha channel');
        transparency = bytes.subarray(start,end);
        break;
      case 'IDAT':
        if (phase === 2 || (type === 3 && !palette)) fail('invalid IDAT ordering or missing palette');
        phase = 1; idats.push([start,end]); idatLength += length;
        break;
      case 'IEND':
        exact(0);
        if (!seen.has('IDAT') || end + 4 !== bytes.length) fail('missing image data or trailing file data');
        break;
      case 'sRGB':
      case 'gAMA':
      case 'cHRM':
        preData();
        if (seen.has('PLTE')) fail(`${name} must precede PLTE`);
        exact(name === 'sRGB' ? 1 : name === 'gAMA' ? 4 : 32);
        if (name === 'sRGB' && bytes[start] > 3) fail('invalid sRGB intent');
        if (name === 'gAMA' && view.getUint32(start) !== 45455) fail('non-sRGB gamma unsupported');
        if (name === 'cHRM' && srgbChromaticity.some((n,i) => view.getUint32(start+i*4) !== n)) fail('non-sRGB chromaticity unsupported');
        break;
      case 'pHYs':
        preData(); exact(9);
        if (bytes[start+8] > 1) fail('invalid physical resolution unit');
        break;
      case 'tIME': {
        exact(7);
        const year = view.getUint16(start), month = bytes[start+2], day = bytes[start+3];
        const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        const days = [31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
        if (!month || month > 12 || !day || day > days[month-1] || bytes[start+4] > 23 || bytes[start+5] > 59 || bytes[start+6] > 60) fail('invalid timestamp');
        break;
      }
      case 'tEXt': {
        let separator = start;
        while (separator < end && bytes[separator] !== 0) separator++;
        if (separator === start || separator === end || separator - start > 79) fail('invalid text keyword');
        for (let i = start; i < separator; i++) {
          const n = bytes[i];
          if (n < 32 || (n > 126 && n < 161) || (n === 32 && (i === start || i === separator-1 || bytes[i-1] === 32))) fail('invalid text keyword');
        }
        for (let i = separator+1; i < end; i++) if (bytes[i] === 0) fail('NUL in text data');
        break;
      }
    }
    seen.add(name); at = end + 4;
  }
  if (!seen.has('IEND')) fail('missing IEND');
  const idat = new Uint8Array(idatLength);
  let offset = 0;
  for (const [start,end] of idats) { idat.set(bytes.subarray(start,end),offset); offset += end-start; }
  checkInflated(idat,rowBytes,height);
  return {width,height,depth,type,channels,rowBytes,palette,transparency};
}

function decode(bytes, options = {}) {
  if (!(bytes instanceof Uint8Array)) fail('expected Uint8Array');
  if (Reflect.apply(typedArrayByteLength,bytes,[]) > assetLimits.imageBytes) fail('file exceeds image byte limit',true);
  const maxRgbaBytes = options.maxRgbaBytes ?? assetLimits.rgbaBytes;
  if (!Number.isSafeInteger(maxRgbaBytes) || maxRgbaBytes < 0 || maxRgbaBytes > assetLimits.rgbaBytes) fail('invalid RGBA budget');
  // Both parsers see the same private immutable snapshot, including for SAB input.
  const original = new Uint8Array(bytes);
  const info = inspect(original,maxRgbaBytes);
  const {width,height,depth,type,channels,rowBytes,palette,transparency} = info;
  const raw = decodeFastPng(original,{checkCrc:true});
  if (raw.width !== width || raw.height !== height || raw.depth !== depth || raw.channels !== channels || !(raw.data instanceof Uint8Array) || raw.data.length !== rowBytes * height) fail('decoder metadata mismatch');
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const from = y * rowBytes + x * channels, to = (y * width + x) * 4;
    let r, g, b, a = 255;
    if (type === 3) {
      const index = (raw.data[y*rowBytes + Math.floor(x*depth/8)] >>> (8-depth-(x*depth%8))) & ((1<<depth)-1);
      if (index >= palette.length / 3) fail('palette index out of bounds');
      r = palette[index*3]; g = palette[index*3+1]; b = palette[index*3+2]; a = transparency?.[index] ?? 255;
    } else if (type === 0 || type === 4) {
      r = g = b = raw.data[from];
      if (type === 4) a = raw.data[from+1];
      else if (transparency && r === transparency[1]) a = 0;
    } else {
      r = raw.data[from]; g = raw.data[from+1]; b = raw.data[from+2];
      if (type === 6) a = raw.data[from+3];
      else if (transparency && r === transparency[1] && g === transparency[3] && b === transparency[5]) a = 0;
    }
    data[to] = r; data[to+1] = g; data[to+2] = b; data[to+3] = a;
  }
  return {image:{width,height,colorSpace:'srgb',alphaMode:'straight',data},info:{width,height,byteLength:original.length,rgbaByteLength:data.length}};
}

/** Full bounded decode; maxRgbaBytes can be the caller's remaining aggregate budget. */
export function decodePng(bytes, options) {
  try { return decode(bytes,options).image; }
  catch (error) { if (error?.code === 'QUOTA_EXCEEDED' || error?.code === 'ASSET_BOUNDARY_VIOLATION') throw error; fail(error?.message ?? 'decode failed'); }
}
/** Full validation, including decompression, pixels and palette indices. */
export function validatePng(bytes, options) {
  try { return decode(bytes,options).info; }
  catch (error) { if (error?.code === 'QUOTA_EXCEEDED' || error?.code === 'ASSET_BOUNDARY_VIOLATION') throw error; fail(error?.message ?? 'decode failed'); }
}
