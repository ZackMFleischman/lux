// Opt-in bounded JPEG adapter; existing asset admission remains BMP-only.
import decodeJpegJs from 'jpeg-js/lib/decoder.js';
import { assetLimits } from './index.mjs';

const typedArrayByteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get;
const typedArraySet = Uint8Array.prototype.set;
function fail(message, quota = false) {
  throw Object.assign(new Error(`JPEG: ${message}`),{code:quota ? 'QUOTA_EXCEEDED' : 'ASSET_BOUNDARY_VIOLATION'});
}
function starts(bytes, at, end, text) {
  if (at + text.length > end) return false;
  for (let i = 0; i < text.length; i++) if (bytes[at+i] !== text.charCodeAt(i)) return false;
  return true;
}
function orientationFromExif(bytes, start, end) {
  start += 6;
  if (end-start < 8) fail('truncated EXIF TIFF header');
  const view = new DataView(bytes.buffer,bytes.byteOffset+start,end-start);
  const little = view.getUint16(0) === 0x4949;
  if (!little && view.getUint16(0) !== 0x4d4d) fail('invalid EXIF byte order');
  if (view.getUint16(2,little) !== 42) fail('invalid EXIF TIFF magic');
  const ifd = view.getUint32(4,little);
  if (ifd < 8 || ifd > view.byteLength-2) fail('EXIF IFD0 outside metadata');
  const entries = view.getUint16(ifd,little);
  if (entries > 128 || ifd+2+entries*12+4 > view.byteLength) fail('invalid or oversized EXIF IFD0');
  let orientation = 1, seen = false;
  for (let i = 0; i < entries; i++) {
    const at = ifd+2+i*12;
    if (view.getUint16(at,little) !== 0x112) continue;
    if (seen || view.getUint16(at+2,little) !== 3 || view.getUint32(at+4,little) !== 1) fail('invalid or duplicate EXIF orientation');
    seen = true; orientation = view.getUint16(at+8,little);
    if (orientation < 1 || orientation > 8) fail('EXIF orientation must be 1..8');
  }
  const next = view.getUint32(ifd+2+entries*12,little);
  if (next !== 0 && (next < 8 || next > view.byteLength-2)) fail('EXIF next IFD pointer outside metadata');
  // Never follow IFD pointers or deserialize arbitrary metadata structures.
  return orientation;
}

function inspect(bytes, maxRgbaBytes) {
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 0xd8) fail('missing SOI');
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.length);
  const quant = new Map(), huffman = new Map();
  let at = 2, markers = 1, metadata = 0, scans = 0, huffmanDefinitions = 0;
  let frame, jfif = false, adobe, exifSeen = false, orientation = 1, restartInterval = 0, ended = false;
  const countMarker = () => { if (++markers > 1024) fail('too many markers'); };
  while (at < bytes.length) {
    if (bytes[at++] !== 255) fail('expected marker');
    while (bytes[at] === 255) at++;
    if (at >= bytes.length) fail('truncated marker');
    const marker = bytes[at++]; countMarker();
    if (marker === 0xd9) {
      if (!frame || !scans || at !== bytes.length) fail('empty image or trailing bytes');
      for (const component of frame.components.values()) if (component.approximation.some(n=>n < 0)) fail('incomplete component scans');
      ended = true; break;
    }
    if (marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || at+2 > bytes.length) fail('unexpected or truncated marker');
    const length = view.getUint16(at), start = at+2, end = at+length;
    if (length < 2 || end > bytes.length) fail('segment length exceeds file');
    const exact = n => { if (length-2 !== n) fail('invalid segment length'); };
    if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) {
      metadata += length-2;
      if (metadata > 65536) fail('metadata exceeds 64 KiB');
      if (marker === 0xe0) {
        if (jfif || !starts(bytes,start,end,'JFIF\0') || end-start < 14 || bytes[start+5] !== 1 || bytes[start+6] > 2 || bytes[start+7] > 2 || end-start !== 14+3*bytes[start+12]*bytes[start+13]) fail('unsupported or malformed JFIF');
        jfif = true;
      } else if (marker === 0xe1 && starts(bytes,start,end,'Exif')) {
        if (exifSeen || !starts(bytes,start,end,'Exif\0\0')) fail('duplicate or malformed EXIF');
        exifSeen = true; orientation = orientationFromExif(bytes,start,end);
      } else if (marker === 0xe2 && starts(bytes,start,end,'ICC_PROFILE')) {
        fail('ICC profiles unsupported; export sRGB without an embedded ICC profile');
      } else if (marker === 0xee) {
        exact(12);
        if (adobe !== undefined || !starts(bytes,start,end,'Adobe') || view.getUint16(start+5) !== 100 || bytes[start+11] > 1) fail('unsupported Adobe color transform');
        adobe = bytes[start+11];
      }
    } else if (marker === 0xc0 || marker === 0xc2) {
      if (frame || length < 8) fail('duplicate or truncated frame');
      const height = view.getUint16(start+1), width = view.getUint16(start+3), count = bytes[start+5];
      exact(6+count*3);
      if (bytes[start] !== 8 || ![1,3].includes(count)) fail('only 8-bit grayscale and three-component JPEG supported');
      if (width < 1 || height < 1 || width > 512 || height > 512) fail('dimensions must be 1..512');
      if (width*height*4 > maxRgbaBytes) fail('RGBA allocation budget exceeded',true);
      const components = new Map(); let maxH = 1, maxV = 1, blocks = 0;
      for (let i = 0; i < count; i++) {
        const offset = start+6+i*3, id = bytes[offset], h = bytes[offset+1] >>> 4, v = bytes[offset+1] & 15, q = bytes[offset+2];
        if (components.has(id) || h < 1 || h > 2 || v < 1 || v > 2 || q > 3) fail('invalid component sampling or selector');
        maxH = Math.max(maxH,h); maxV = Math.max(maxV,v); blocks += h*v;
        components.set(id,{id,h,v,q,approximation:new Int8Array(64).fill(-1)});
      }
      if (blocks > 10 || (count === 1 && (maxH !== 1 || maxV !== 1))) fail('unsupported MCU sampling mode');
      frame = {width,height,components,maxH,maxV,progressive:marker === 0xc2};
    } else if (marker === 0xdb) {
      if (scans) fail('quantization tables must precede scans');
      let p = start;
      while (p < end) {
        const selector = bytes[p++], precision = selector >>> 4, id = selector & 15, size = precision === 0 ? 64 : 128;
        if (precision > 1 || id > 3 || quant.has(id) || p+size > end) fail('invalid or duplicate quantization table');
        for (let i = 0; i < 64; i++) if ((precision === 0 ? bytes[p+i] : view.getUint16(p+i*2)) === 0) fail('zero quantization value');
        quant.set(id,precision); p += size;
      }
      if (start === end) fail('empty quantization segment');
    } else if (marker === 0xc4) {
      let p = start;
      while (p < end) {
        if (++huffmanDefinitions > 128 || end-p < 17) fail('invalid or excessive Huffman tables');
        const selector = bytes[p++], kind = selector >>> 4, id = selector & 15;
        if (kind > 1 || id > 3) fail('invalid Huffman selector');
        let symbols = 0, slots = 1;
        for (let i = 0; i < 16; i++) {
          const count = bytes[p++]; symbols += count; slots = slots*2-count;
          if (slots <= 0) fail('oversubscribed Huffman codes or forbidden all-ones code');
        }
        if (!symbols || symbols > 256 || p+symbols > end) fail('invalid Huffman table size');
        const values = new Set(); let baselineCompatible = true;
        for (let i = 0; i < symbols; i++) {
          const symbol = bytes[p++];
          if (values.has(symbol) || (kind === 0 ? symbol > 11 : (symbol & 15) > 10)) fail('invalid Huffman symbol');
          values.add(symbol);
          if (kind === 1 && (symbol & 15) === 0 && symbol !== 0 && symbol !== 0xf0) baselineCompatible = false;
        }
        huffman.set(selector,{baselineCompatible});
      }
      if (start === end) fail('empty Huffman segment');
    } else if (marker === 0xdd) {
      exact(2); restartInterval = view.getUint16(start);
    } else if (marker === 0xda) {
      if (!frame || ++scans > 16 || start === end) fail('missing frame or excessive scans');
      const count = bytes[start]; exact(1+count*2+3);
      if (count < 1 || count > frame.components.size) fail('invalid scan component count');
      const ss = bytes[end-3], se = bytes[end-2], ah = bytes[end-1] >>> 4, al = bytes[end-1] & 15;
      if (ss > se || se > 63 || ah > 13 || al > 13 || (ah !== 0 && ah !== al+1)) fail('invalid spectral or approximation range');
      if (!frame.progressive && (ss !== 0 || se !== 63 || ah || al)) fail('invalid baseline scan');
      if (frame.progressive && ((ss === 0 && se !== 0) || (ss > 0 && count !== 1))) fail('invalid progressive scan');
      const selected = [], ids = new Set();
      for (let i = 0; i < count; i++) {
        const id = bytes[start+1+i*2], selector = bytes[start+2+i*2], dc = selector >>> 4, ac = selector & 15;
        const component = frame.components.get(id);
        if (!component || ids.has(id) || dc > 3 || ac > 3 || !quant.has(component.q) || (!frame.progressive && quant.get(component.q) !== 0)) fail('invalid scan selector or missing quantization table');
        if ((ss === 0 && ah === 0 && !huffman.has(dc)) || (se > 0 && !huffman.has(0x10|ac))) fail('missing Huffman table');
        if (!frame.progressive && !huffman.get(0x10|ac).baselineCompatible) fail('invalid baseline Huffman symbol');
        if (ss > 0 && component.approximation[0] < 0) fail('AC scan before DC');
        for (let k = ss; k <= se; k++) {
          if (component.approximation[k] !== (ah === 0 ? -1 : ah)) fail('duplicate or out-of-order progressive band');
          component.approximation[k] = al;
        }
        ids.add(id); selected.push(component);
      }
      // Walk entropy bytes without decoding coefficients. Stuffed FF00 belongs
      // to entropy; RST markers require the declared cadence and sequence.
      let p = end, restarts = 0, entropyStart = end;
      while (p < bytes.length) {
        if (bytes[p++] !== 255) continue;
        const prefix = p-1;
        if (p >= bytes.length) fail('truncated entropy marker');
        if (bytes[p] === 0) { p++; continue; }
        while (bytes[p] === 255) p++;
        const next = bytes[p];
        if (next >= 0xd0 && next <= 0xd7) {
          countMarker();
          if (!restartInterval || next !== 0xd0+(restarts%8) || prefix === entropyStart) fail('invalid restart sequence');
          restarts++; p++; entropyStart = p; continue;
        }
        if (prefix === entropyStart || next === 0 || p >= bytes.length) fail('empty or malformed entropy segment');
        p = prefix; break;
      }
      if (p >= bytes.length) fail('unterminated entropy scan');
      const units = count === 1
        ? Math.ceil(Math.ceil(frame.width/8)*selected[0].h/frame.maxH)*Math.ceil(Math.ceil(frame.height/8)*selected[0].v/frame.maxV)
        : Math.ceil(frame.width/(8*frame.maxH))*Math.ceil(frame.height/(8*frame.maxV));
      if (restarts !== (restartInterval ? Math.floor((units-1)/restartInterval) : 0)) fail('restart count does not match MCU budget');
      at = p; continue;
    } else fail(`unsupported marker 0x${marker.toString(16)}`);
    at = end;
  }
  if (!ended) fail('missing EOI');
  if (adobe !== undefined && frame.components.size !== 3) fail('Adobe transform requires three components');
  if (jfif && adobe === 0) fail('conflicting JFIF and RGB color declarations');
  const ids = [...frame.components.keys()].join(',');
  if (frame.components.size === 3 && !jfif && adobe === undefined && ids !== '1,2,3') fail('ambiguous three-component color transform');
  return {...frame,orientation,colorTransform:adobe !== 0};
}

function decode(bytes, options = {}) {
  if (!(bytes instanceof Uint8Array)) fail('expected Uint8Array');
  const maxRgbaBytes = options.maxRgbaBytes ?? assetLimits.rgbaBytes;
  if (!Number.isSafeInteger(maxRgbaBytes) || maxRgbaBytes < 0 || maxRgbaBytes > assetLimits.rgbaBytes) fail('invalid RGBA budget');
  const byteLength = Reflect.apply(typedArrayByteLength,bytes,[]);
  if (byteLength > assetLimits.imageBytes) fail('file exceeds image byte limit',true);
  const original = new Uint8Array(byteLength); Reflect.apply(typedArraySet,original,[bytes]);
  const info = inspect(original,maxRgbaBytes);
  const raw = decodeJpegJs(original,{useTArray:true,formatAsRGBA:true,tolerantDecoding:false,maxResolutionInMP:0.262144,maxMemoryUsageInMB:32,colorTransform:info.colorTransform});
  if (raw.width !== info.width || raw.height !== info.height || !(raw.data instanceof Uint8Array) || raw.data.length !== info.width*info.height*4) fail('decoder output mismatch');
  for (let i = 3; i < raw.data.length; i += 4) if (raw.data[i] !== 255) fail('JPEG decoder returned nonopaque alpha');
  const swapped = info.orientation >= 5, width = swapped ? info.height : info.width, height = swapped ? info.width : info.height;
  let data = raw.data;
  if (info.orientation !== 1) {
    data = new Uint8Array(raw.data.length);
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      let ox, oy;
      switch (info.orientation) {
        case 2: ox = info.width-1-x; oy = y; break;
        case 3: ox = info.width-1-x; oy = info.height-1-y; break;
        case 4: ox = x; oy = info.height-1-y; break;
        case 5: ox = y; oy = x; break;
        case 6: ox = info.height-1-y; oy = x; break;
        case 7: ox = info.height-1-y; oy = info.width-1-x; break;
        case 8: ox = y; oy = info.width-1-x; break;
      }
      const from = (y*info.width+x)*4, to = (oy*width+ox)*4;
      for (let c = 0; c < 4; c++) data[to+c] = raw.data[from+c];
    }
  }
  return {image:{width,height,colorSpace:'srgb',alphaMode:'straight',data},info:{width,height,byteLength,rgbaByteLength:data.length}};
}

export function decodeJpeg(bytes, options) {
  try { return decode(bytes,options).image; }
  catch (error) { if (error?.code === 'QUOTA_EXCEEDED' || error?.code === 'ASSET_BOUNDARY_VIOLATION') throw error; fail(error?.message ?? 'decode failed'); }
}
export function validateJpeg(bytes, options) {
  try { return decode(bytes,options).info; }
  catch (error) { if (error?.code === 'QUOTA_EXCEEDED' || error?.code === 'ASSET_BOUNDARY_VIOLATION') throw error; fail(error?.message ?? 'decode failed'); }
}
