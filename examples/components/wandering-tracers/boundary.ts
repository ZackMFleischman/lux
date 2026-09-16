import { defineComponent } from '@lux/visual-sdk';
import { ornamentBoundaryFragments } from './ornament-boundary.ts';

// ABI lux/boundary-ink/v1 supplies the original boundary and paper finish.
// The painting consumer places this block before the closing function brace.
const boundaryFragments = Object.freeze({
  finish: `  let edgePressure = 0.57 + 0.68 * lpNoise(q * 7.0 + seed)
    + character.y * 0.13 * sin(q.x * 37.0 + q.y * 21.0);
  let boundaryWidth = ink.x * 140.0 * pixelSize * edgePressure;
  let boundary = 1.0 - smoothstep(boundaryWidth - edgeAA * 0.55, boundaryWidth + edgeAA * 0.55, edge);
  color = mix(color, cream, boundary * (0.62 + 0.32 * lpNoise(q * 2.3 + seed)));
  // Stationary paper grain avoids animated video noise.
  let grain = lpHash(floor(st * vec2f(1920.0, 1080.0))) - 0.5;
  let fibers = lpNoise(p * 92.0) - 0.5;
  color += (grain * 0.026 + fibers * 0.037) * ink.w;
  color *= 0.96 + 0.04 * smoothstep(0.0, 0.25, min(min(st.x, 1.0 - st.x), min(st.y, 1.0 - st.y)));
  return vec4f(pow(clamp(color, vec3f(0.0), vec3f(1.0)), vec3f(2.2)), 1.0);
}


`,
});

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/organic-boundary-ink',
    label: 'Organic Boundary Ink',
    description: 'Uneven warm outlines, hand-drawn character, and stationary paper grain for compatible painting renderers.',
    tags: ['painting', 'ink', 'paper'],
    inputs: {},
    outputs: {
      field: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/boundary-ink/v1' },
        label: 'Boundary ink',
        description: 'Boundary and paper-finish shader fragment with its current numeric values.',
      },
      ornament: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-boundary-ink/v1' },
        label: 'Ornament boundary ink',
        description: 'Shared-boundary ornament ink helper with its current stroke values.',
      },
    },
    controls: {
      outline: { type: 'number', group: 'Ink & paper', label: 'Boundary width', default: 0.005, min: 0.002, max: 0.03, step: 0.001 },
      inkWarmth: { type: 'number', group: 'Ink & paper', label: 'Warmth', default: 0.15, min: 0, max: 1, step: 0.01 },
      handDrawn: { type: 'number', group: 'Ink & paper', label: 'Hand-drawn character', default: 1.34, min: 0, max: 1.5, step: 0.01 },
      grain: { type: 'number', group: 'Ink & paper', label: 'Grain', default: 1.48, min: 0, max: 2, step: 0.01 },
      ornamentWidth: { type: 'number', group: 'Ornament Ink', label: 'Boundary width', default: 0.008, min: 0.001, max: 0.025, step: 0.001 },
      ornamentAccent: { type: 'number', group: 'Ornament Ink', label: 'Secondary edge', default: 0.55, min: 0, max: 1, step: 0.01 },
    },
    controlDescriptions: {
      outline: 'outline setting for the painting.',
      inkWarmth: 'inkWarmth setting for the painting.',
      handDrawn: 'handDrawn setting for the painting.',
      grain: 'grain setting for the painting.',
      ornamentWidth: 'Boundary width for Living Ornament shared visible edges.',
      ornamentAccent: 'Teal and purple secondary-edge strength for Living Ornament.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create() {
    let outline = 0.005;
    let inkWarmth = 0.15;
    let handDrawn = 1.34;
    let grain = 1.48;
    let ornamentWidth = 0.008;
    let ornamentAccent = 0.55;
    return {
      update(frame) {
        outline = frame.controls.outline;
        inkWarmth = frame.controls.inkWarmth;
        handDrawn = frame.controls.handDrawn;
        grain = frame.controls.grain;
        ornamentWidth = frame.controls.ornamentWidth;
        ornamentAccent = frame.controls.ornamentAccent;
      },
      async evaluate(_inputs, evaluation) {
        return {
          field: evaluation.shaderField('field', {
            version: 1,
            abi: 'lux/boundary-ink/v1',
            fragments: boundaryFragments,
            values: { outline, inkWarmth, handDrawn, grain },
          }),
          ornament: evaluation.shaderField('ornament', {
            version: 1,
            abi: 'lux/ornament-boundary-ink/v1',
            fragments: ornamentBoundaryFragments,
            values: { width: ornamentWidth, accent: ornamentAccent, handDrawn, grain },
          }),
        };
      },
      reset() {},
      dispose() {},
    };
  },
});
