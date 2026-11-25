import { Texture, Vector2 } from 'three/webgpu';
import { texture, uniform, uv, vec2, vec4 } from 'three/tsl';

// Gaussian-weighted RGBA blur. Accumulate premultiplied alpha to avoid dark fringes.
export function createGaussianBlur(image: Texture, straightAlpha = false, flipY = false) {
  const radius = uniform(new Vector2(0, 0));
  const coordinates = flipY ? uv().flipY() : uv();
  const weights = [1, 6, 15, 20, 15, 6, 1];
  const samples: ReturnType<typeof texture>[] = [];
  let result = texture(image, coordinates).mul(0);
  for (let y = -3; y <= 3; y++) {
    for (let x = -3; x <= 3; x++) {
      const sample = texture(image, coordinates.add(radius.mul(vec2(x / 3, y / 3))));
      samples.push(sample);
      const rgba = straightAlpha ? vec4(sample.rgb.mul(sample.a), sample.a) : sample;
      result = result.add(rgba.mul(weights[x + 3] * weights[y + 3] / 4096));
    }
  }
  return {
    node: result,
    radius,
    bind(image: Texture) { for (const sample of samples) sample.value = image; },
  };
}
