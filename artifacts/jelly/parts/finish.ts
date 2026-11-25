import { defineComponent } from '@lux/visual-sdk';
import {
  Scene,
  Mesh,
  PlaneGeometry,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  Vector4,
  Texture,
} from 'three/webgpu';
import { jellyShared } from './jelly-shared.ts';
import { uniform, uv, wgslFn, texture, vec2 } from 'three/tsl';

// IMPORTANT: wgslFn uses the FIRST function in the source as the entry point.
// The entry function must come first; helpers follow it. The three sources below
// land in one shader, so their helper names must not collide.
// st.y is up.
const finishPass = `
fn jellyFinish(
  st: vec2f,
  r: vec4f,
  g: vec4f,
  b: vec4f,
  glow: vec4f,
  exposure: f32,
  vignette: f32,
  grade: f32,
  grain: f32,
  time: f32,
  theme: f32,
  bloom: f32,
  aspect: f32
) -> vec4f {
  // Bloom: thresholded multi-tap blur of the highlights, added before the tone curve.
  var col = (vec3f(r.r, g.g, b.b) + glow.rgb * bloom) * exposure;
  let lw = vec3f(0.2126, 0.7152, 0.0722);
  let gAmt = clamp(grade * 1.6, 0.0, 1.0);
  let aqua = 1.0 - theme;

  // Aquarium: slow caustic shimmer near the surface and a blue-green depth grade.
  if (aqua > 0.001) {
    let cp = vec2f(st.x * aspect, st.y) * 4.2;
    let caus = finishCaustic(cp, time * 0.3);
    let topW = 0.3 + 0.7 * smoothstep(0.1, 1.0, st.y);
    let lit = col * (1.0 + caus * 0.1 * topW) + vec3f(0.15, 0.55, 0.6) * caus * 0.01 * topW;
    let depth = 1.0 - st.y;
    let lum0 = dot(lit, lw);
    let deepTint = mix(vec3f(1.0), vec3f(0.8, 0.96, 1.04), 0.4 + 0.6 * depth);
    let fog = vec3f(0.0, 0.01, 0.016) * (1.0 - smoothstep(0.0, 0.3, lum0));
    let graded = lit * deepTint * (1.0 - 0.12 * depth) + fog;
    col = mix(col, mix(lit, graded, gAmt), aqua);
  }

  // Space: deep blacks via a gentle toe, slightly lifted cyan shadows.
  if (theme > 0.001) {
    let c0 = max(col, vec3f(0.0));
    let toe = c0 * c0 / (c0 + vec3f(0.015));
    let lum1 = dot(toe, lw);
    let lift = vec3f(0.0, 0.007, 0.011) * (1.0 - smoothstep(0.0, 0.22, lum1)) * gAmt;
    let spaceC = (toe - vec3f(0.18)) * 1.06 + vec3f(0.18) + lift;
    col = mix(col, spaceC, theme);
  }

  // Subtle split tone: cool shadows, warm highlights.
  let lum = dot(col, lw);
  let shadowAmt = 1.0 - smoothstep(0.0, 0.35, lum);
  let highAmt = smoothstep(0.45, 1.0, lum);
  col = col + grade * (vec3f(-0.006, 0.0, 0.012) * shadowAmt + vec3f(0.015, 0.006, -0.008) * highAmt);

  // Filmic shoulder: identity below the knee, hue-preserving roll-off, never full white.
  col = finishTone(col);

  // Vignette.
  let pv = (st - vec2f(0.5)) * 2.0;
  let d = clamp(length(pv) / 1.41421356, 0.0, 1.0);
  col = col * (1.0 - vignette * d * d * (0.6 + 0.4 * d));

  // Grain: triangular noise, strongest in the mids, near zero in deep black and highlights.
  let cell = floor(st * vec2f(1920.0, 1080.0));
  let frameSeed = fract(floor(time * 24.0) * 0.618034) * 97.0;
  let n = finishHash(cell + vec2f(frameSeed, frameSeed * 1.37)) + finishHash(cell * 1.31 + vec2f(frameSeed * 0.71, 19.0)) - 1.0;
  let lg = clamp(dot(col, lw), 0.0, 1.0);
  col = col + vec3f(n * 0.014 * grain * (0.25 + 3.0 * lg * (1.0 - lg)));

  return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), 1.0);
}

fn finishTone(x: vec3f) -> vec3f {
  let c = max(x, vec3f(0.0));
  let knee = 0.6;
  let top = 0.95;
  let span = top - knee;
  // Hue-preserving: map the peak channel and scale all channels with it.
  let peak = max(c.r, max(c.g, c.b));
  let mapped = select(peak, knee + span * (1.0 - exp(-(peak - knee) / span)), peak > knee);
  let hp = c * (mapped / max(peak, 0.00001));
  // A little per-channel roll-off so very hot cores desaturate slightly, like film.
  let over = max(c - vec3f(knee), vec3f(0.0));
  let pc = select(vec3f(knee) + span * (vec3f(1.0) - exp(-over / span)), c, c < vec3f(knee));
  return mix(hp, pc, 0.2);
}

// Animated Voronoi edge network: bright filaments like light focused by surface waves.
fn finishCaustic(p: vec2f, t: f32) -> f32 {
  let w = p + 0.25 * vec2f(sin(p.y * 2.3 + t * 1.1), sin(p.x * 2.0 - t * 0.9));
  let cell = floor(w);
  let f = fract(w);
  var d1 = 8.0;
  var d2 = 8.0;
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let o = vec2f(f32(i), f32(j));
      let h = finishHash2(cell + o);
      let pt = o + vec2f(0.5) + 0.38 * sin(vec2f(t) * (vec2f(0.6) + 0.5 * h) + 6.2831853 * h);
      let dd = length(f - pt);
      if (dd < d1) {
        d2 = d1;
        d1 = dd;
      } else if (dd < d2) {
        d2 = dd;
      }
    }
  }
  let e = d2 - d1;
  return exp(-e * 14.0) * (0.7 + 0.3 * sin(t * 2.0 + w.x * 1.3));
}

fn finishHash(p: vec2f) -> f32 {
  let q = fract(p * vec2f(0.1031, 0.1030));
  let r = q + dot(q, q.yx + vec2f(33.33));
  return fract((r.x + r.y) * r.x);
}

fn finishHash2(p: vec2f) -> vec2f {
  var q = vec3f(p.x, p.y, p.x) * vec3f(0.1031, 0.1030, 0.0973);
  q = fract(q);
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
`;

// Bloom tap position: ring offset rotated per pixel (interleaved gradient noise) so the
// sparse ring turns into fine grain instead of ghost copies of small bright points.
// cfg = (radius in screen heights, aspect, frame index, threshold)
const tapUvSrc = `
fn finishTapUv(st: vec2f, off: vec2f, cfg: vec4f) -> vec2f {
  let px = floor(st * vec2f(1920.0, 1080.0)) + vec2f(cfg.z * 5.588238);
  let ign = fract(52.9829189 * fract(dot(px, vec2f(0.06711056, 0.00583715))));
  let a = ign * 6.2831853;
  let cs = cos(a);
  let sn = sin(a);
  let o = vec2f(off.x * cs - off.y * sn, off.x * sn + off.y * cs) * cfg.x;
  return vec2f(st.x + o.x / cfg.y, 1.0 - (st.y + o.y));
}
`;

// Soft-knee highlight extraction for one bloom tap.
const brightSrc = `
fn finishBright(c: vec4f, cfg: vec4f) -> vec4f {
  let v = min(max(c.rgb, vec3f(0.0)), vec3f(4.0));
  let pk = max(v.r, max(v.g, v.b));
  let kneeW = 0.25;
  let soft = clamp(pk - cfg.w + kneeW, 0.0, 2.0 * kneeW);
  let k = max(soft * soft / (4.0 * kneeW), pk - cfg.w) / max(pk, 0.0001);
  return vec4f(v * k, 0.0);
}
`;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/finish',
    label: 'Deep Space Finish',
    description: 'Final grade: highlight bloom, filmic shoulder that never clips to white, vignette, grain, edge chromatic aberration; aquarium depth grade with caustics, space deep blacks with cyan shadows.',
    tags: ['jellyfish', 'grade'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image to grade.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Graded image.',
      },
    },
    controls: {
      vignette: { type: 'number', group: 'Finish', label: 'Vignette', default: 0.25, min: 0, max: 1, step: 0.01 },
      exposure: { type: 'number', group: 'Finish', label: 'Exposure', default: 1, min: 0.3, max: 2.5, step: 0.01 },
      grain: { type: 'number', group: 'Finish', label: 'Film grain', default: 0.5, min: 0, max: 1, step: 0.01 },
      aberration: { type: 'number', group: 'Lens', label: 'Chromatic aberration', default: 0.3, min: 0, max: 1, step: 0.01 },
      grade: { type: 'number', group: 'Color', label: 'Color grade', default: 0.5, min: 0, max: 1.5, step: 0.01 },
      bloom: { type: 'number', group: 'Bloom', label: 'Bloom', default: 0.35, min: 0, max: 2, step: 0.01 },
      bloomRadius: { type: 'number', group: 'Bloom', label: 'Bloom radius', default: 1, min: 0.2, max: 3, step: 0.01 },
    },
    controlDescriptions: {
      vignette: 'Darkening at the frame corners. 0.25 darkens the corners by about 25%.',
      exposure: 'Brightness before the highlight roll-off. Highlights ease toward white instead of clipping.',
      grain: 'Strength of the faint animated film grain.',
      aberration: 'Tiny red and blue color fringing toward the edges.',
      grade: 'Strength of the theme grade: aquarium depth tint, space cyan shadows, and split toning.',
      bloom: 'Strength of the soft glow around highlights.',
      bloomRadius: 'Spread of the highlight glow.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const exposure = uniform(1.0);
    const vignette = uniform(0.25);
    const grade = uniform(0.5);
    const grain = uniform(0.5);
    const time = uniform(0.0);
    const theme = uniform(0.0);
    const bloom = uniform(0.35);
    const aspectU = uniform(aspect);
    const scaleR = uniform(1.0);
    const scaleB = uniform(1.0);
    const cfg = uniform(new Vector4(0.006, aspect, 0, 0.6));

    // Center-scaled, clamped, y-flipped uv taps for red and blue.
    const tap = (s: any): any =>
      (vec2 as any)(
        uv().x.sub(0.5).mul(s).add(0.5).clamp(0.0, 1.0),
        uv().y.sub(0.5).mul(s).add(0.5).clamp(0.0, 1.0).oneMinus(),
      );
    const texR = (texture as any)(new Texture(), tap(scaleR));
    const texG = texture(new Texture(), vec2(uv().x, uv().y.oneMinus()));
    const texB = (texture as any)(new Texture(), tap(scaleB));
    const texNodes: any[] = [texR, texG, texB];

    // Bloom: 16 taps in three rings (offsets in units of the bloom radius), weighted toward the centre.
    const tapUvFn = wgslFn(tapUvSrc) as any;
    const brightFn = wgslFn(brightSrc) as any;
    const rings: [number, number, number, number][] = [
      [6, 1.0, 0, 1.0],
      [6, 2.2, Math.PI / 6, 0.6],
      [4, 3.6, Math.PI / 4, 0.3],
    ];
    let glowSum: any = null;
    let wSum = 0;
    for (const [count, radius, phase, weight] of rings) {
      for (let i = 0; i < count; i++) {
        const a = phase + (i / count) * Math.PI * 2;
        const node = (texture as any)(new Texture(), tapUvFn(uv(), vec2(Math.cos(a) * radius, Math.sin(a) * radius), cfg));
        texNodes.push(node);
        const term = brightFn(node, cfg).mul(weight);
        glowSum = glowSum === null ? term : glowSum.add(term);
        wSum += weight;
      }
    }
    const glow = glowSum.mul(1 / wSum);

    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    // Order matches jellyFinish(st, r, g, b, glow, exposure, vignette, grade, grain, time, theme, bloom, aspect).
    material.fragmentNode = (wgslFn(finishPass) as any)(
      uv(), texR, texG, texB, glow, exposure, vignette, grade, grain, time, theme, bloom, aspectU,
    );
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    let th = 0;
    let frameIndex = 0;

    return {
      update(frame) {
        th += ((jellyShared.theme ?? 0) - th) * 0.1;
        theme.value = th;
        const c = frame.controls as any;
        const ab = c.aberration * 0.004;
        scaleR.value = 1 - ab;
        scaleB.value = 1 + ab;
        exposure.value = c.exposure;
        vignette.value = c.vignette;
        grade.value = c.grade;
        grain.value = c.grain;
        bloom.value = c.bloom ?? 0.35;
        time.value = frame.timeSeconds % 1000;
        frameIndex = (frameIndex + 1) % 64;
        cfg.value.set(0.006 * (c.bloomRadius ?? 1), aspect, frameIndex, 0.6);
      },
      async evaluate(inputs, evaluation) {
        const tex = inputs.image.texture as Texture;
        for (const node of texNodes) node.value = tex;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        frameIndex = 0;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
