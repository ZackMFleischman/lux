import { encode } from 'fast-png';

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
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 1920 || height > 1080 ||
      !(pixels instanceof Uint8Array) || pixels.byteLength !== width * height * 4) throw Error('Invalid capture target readback');
  const data = new Uint8Array(pixels.length);
  for (let at = 0; at < pixels.length; at += 4) {
    const alpha = pixels[at + 3], row = alpha * 256;
    data[at] = straight[row + pixels[at]];
    data[at + 1] = straight[row + pixels[at + 1]];
    data[at + 2] = straight[row + pixels[at + 2]];
    data[at + 3] = alpha;
  }
  // Encode straight bytes directly. A 2D canvas would quantize through another
  // premultiplied store and can lose color precision at low coverage.
  const png = encode({ width, height, channels: 4, depth: 8, data });
  if (png.byteLength > 8388608) throw Error('Capture exceeds 8 MiB');
  return png;
}
