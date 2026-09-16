import { defineComponent } from '@lux/visual-sdk';
import { ornamentWatercolorFragments } from './ornament-watercolor.ts';

// ABI lux/watercolor/v1 supplies the exact animated wash block. The painting
// consumer inserts it immediately after region geometry and keeps the source
// immutable for the lifetime of that consumer instance.
const watercolorFragments = Object.freeze({
  wash: `
  // Broad translucent washes cross region boundaries; local tints add identity.
  // Pigment has its own gentle movement, so a changing boundary cannot drag
  // the wash into ribbons. The color phrase answers the shape phrase later.
  let colorPhrase = lpPhrase(p, t - 7.0);
  let cloud = lpFbm(p * 1.31 + seed * 0.1 + vec2f(t * 0.008, -t * 0.006));
  let broad = lpFbm(p * 0.46 + vec2f(3.7 + t * 0.006, 8.2 - t * 0.007));
  let wash = clamp(broad * 0.4 + cloud * 0.6 + pigment.x * 0.2, 0.0, 1.0);
  let palettePhase = 0.5 + 0.5 * sin(t * 0.065 + broad * 2.0);
  let deepPigment = mix(vec3f(0.075, 0.17, 0.31), vec3f(0.065, 0.25, 0.25), palettePhase);
  let lightPigment = mix(vec3f(0.29, 0.49, 0.68), vec3f(0.30, 0.61, 0.54), palettePhase);
  var color = mix(deepPigment, lightPigment, smoothstep(0.27, 0.66, wash));
  let green = smoothstep(0.50, 0.79, lpNoise(p * 0.62 + vec2f(8.0, 2.0) + t * 0.014));
  color = mix(color, vec3f(0.31, 0.49, 0.31), green * 0.83);
  let lightCenter = vec2f(sin(t * 0.043 - 0.65) * form.x * view.y * 0.32,
    cos(t * 0.057 + 0.6) * form.x * 0.26);
  let secondCenter = vec2f(cos(t * 0.037 + 0.6) * form.x * view.y * 0.34,
    sin(t * 0.051 - 0.6) * form.x * 0.29);
  let paleCenter = vec2f(sin(t * 0.029 + 0.1) * form.x * 0.30,
    cos(t * 0.041 + 1.4) * form.x * 0.23);
  let lightPool = exp(-dot(p - lightCenter, p - lightCenter) * (0.72 + colorPhrase * 0.30));
  let secondLight = exp(-dot(p - secondCenter, p - secondCenter) * 0.90);
  let palePool = exp(-dot(p - paleCenter, p - paleCenter) * 0.62);
  color = mix(color, vec3f(0.67, 0.74, 0.73), palePool * 0.68);
  let warmPigment = mix(vec3f(0.90, 0.79, 0.43), vec3f(0.82, 0.63, 0.49), 0.5 + 0.5 * sin(t * 0.033));
  color = mix(color, warmPigment, clamp((lightPool * 0.85 + secondLight * 0.62) * pigment.y
    * (1.0 + music.y * 0.13 * (colorPhrase - 0.5)), 0.0, 0.93));
  let regionTone = lpHash(owner + seed + 61.0);
  color *= 1.0 + (regionTone - 0.5) * pigment.z * 0.50;
  color = mix(color, vec3f(0.12, 0.145, 0.30), smoothstep(0.76, 0.98, regionTone) * min(0.82, pigment.z * 0.64));
  color += (cloud - 0.5) * 0.23;
  let wet = lpFbm(p * 3.8 + seed * 0.13);
  let bloomRim = exp(-abs(wet - 0.51) * 82.0);
  color += character.z * ((wet - 0.5) * 0.18 - bloomRim * 0.023);
  let pooling = exp(-edge * 23.0) * (0.35 + 0.65 * lpNoise(q * 3.0 + seed));
  color *= 1.0 - pooling * pigment.w * 0.18;
`,
});

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/animated-watercolor',
    label: 'Animated Watercolor',
    description: 'Reusable animated watercolor washes, warm pools, blooms, and pigment pooling.',
    tags: ['painting', 'watercolor', 'color'],
    inputs: {},
    outputs: {
      field: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/watercolor/v1' },
        label: 'Watercolor',
        description: 'Animated watercolor shader block with its current numeric values.',
      },
      ornament: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-watercolor/v1' },
        label: 'Ornament watercolor',
        description: 'Shape-aware ornament color shader helper with its current material values.',
      },
    },
    controls: {
      palette: { type: 'number', group: 'Color & watercolor', label: 'Wash lightness', default: 0.07, min: -1, max: 1, step: 0.01 },
      warmth: { type: 'number', group: 'Color & watercolor', label: 'Warm pools', default: 1.3, min: 0, max: 2, step: 0.01 },
      contrast: { type: 'number', group: 'Color & watercolor', label: 'Region contrast', default: 1.05, min: 0, max: 2, step: 0.01 },
      pooling: { type: 'number', group: 'Color & watercolor', label: 'Pigment pooling', default: 0.74, min: 0, max: 2, step: 0.01 },
      blooms: { type: 'number', group: 'Color & watercolor', label: 'Watercolor blooms', default: 0.94, min: 0, max: 2, step: 0.01 },
      ornamentSaturation: { type: 'number', group: 'Ornament Color', label: 'Saturation', default: 1, min: 0, max: 1.5, step: 0.01 },
    },
    controlDescriptions: {
      palette: 'palette setting for the painting.',
      warmth: 'warmth setting for the painting.',
      contrast: 'contrast setting for the painting.',
      pooling: 'pooling setting for the painting.',
      blooms: 'blooms setting for the painting.',
      ornamentSaturation: 'Saturation for Living Ornament watercolor anchors and supporting shapes.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create() {
    let palette = 0.07;
    let warmth = 1.3;
    let contrast = 1.05;
    let pooling = 0.74;
    let blooms = 0.94;
    let ornamentSaturation = 1;
    return {
      update(frame) {
        palette = frame.controls.palette;
        warmth = frame.controls.warmth;
        contrast = frame.controls.contrast;
        pooling = frame.controls.pooling;
        blooms = frame.controls.blooms;
        ornamentSaturation = frame.controls.ornamentSaturation;
      },
      async evaluate(_inputs, evaluation) {
        return {
          field: evaluation.shaderField('field', {
            version: 1,
            abi: 'lux/watercolor/v1',
            fragments: watercolorFragments,
            values: { palette, warmth, contrast, pooling, blooms },
          }),
          ornament: evaluation.shaderField('ornament', {
            version: 1,
            abi: 'lux/ornament-watercolor/v1',
            fragments: ornamentWatercolorFragments,
            values: { palette, warmth, contrast, pooling, blooms, saturation: ornamentSaturation },
          }),
        };
      },
      reset() {},
      dispose() {},
    };
  },
});
