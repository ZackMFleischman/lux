import { encode } from 'fast-png';

const maxCaptureBytes = 40 * 1024 * 1024;

// The pinned WebGPU rgba8unorm-srgb attachment blends in linear light, storing
// E(P), where P is premultiplied linear RGB. This is NOT premultiplied sRGB.
// PNG requires E(P / alpha). Compute a bounded lookup before submitted code runs;
// a capture then needs only three lookups per translucent pixel.
const straight = new Uint8Array(256 * 256);
for (let alpha = 1; alpha < 256; alpha++) for (let byte = 0; byte < 256; byte++) {
  const encoded = byte / 255;
  const premultiplied = encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
  const linear = Math.min(1, premultiplied * 255 / alpha);
  straight[alpha * 256 + byte] = Math.round(255 * (linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055));
}

export function encodeCapturedTarget(pixels, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 3840 || height > 2160 || !(pixels instanceof Uint8Array)) throw Error('Invalid capture target readback');
  const rowBytes = width * 4, tightLength = rowBytes * height, paddedRowBytes = Math.ceil(rowBytes / 256) * 256;
  // Three maps the minimum WebGPU copy buffer: every preceding row includes
  // bytesPerRow padding, while the final row ends at its actual texel bytes.
  const mappedLength = (height - 1) * paddedRowBytes + rowBytes;
  if (pixels.byteLength !== tightLength && pixels.byteLength !== mappedLength) throw Error('Invalid capture target readback');
  const source = pixels.byteLength === tightLength ? pixels : (() => { const tight = new Uint8Array(tightLength); for (let row = 0; row < height; row++) tight.set(pixels.subarray(row * paddedRowBytes, row * paddedRowBytes + rowBytes), row * rowBytes); return tight; })();
  const data = new Uint8Array(source.length);
  for (let at = 0; at < source.length; at += 4) {
    const alpha = source[at + 3], row = alpha * 256;
    data[at] = straight[row + source[at]];
    data[at + 1] = straight[row + source[at + 1]];
    data[at + 2] = straight[row + source[at + 2]];
    data[at + 3] = alpha;
  }
  // Encode straight bytes directly. A 2D canvas would quantize through another
  // premultiplied store and can lose color precision at low coverage.
  const png = encode({ width, height, channels: 4, depth: 8, data });
  if (png.byteLength > maxCaptureBytes) throw Error('Capture exceeds 40 MiB');
  return png;
}
