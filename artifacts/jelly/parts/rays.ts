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
import { uniform, uv, wgslFn, texture, float, vec2 } from 'three/tsl';

const BLOOM_TAPS = 10;

// Aquarium: volumetric god-rays fanning down from the surface, with dust glinting in the shafts.
// Space: a star lens flare (hot core, starburst, anamorphic streak, ghosts and a halo ring).
// st.y is up. `blur` is the average of several taps of the input pulled toward the bell centre.
// view: x = time, y = aspect, z = audio level, w = bloom amount
// rays: x = strength, y = angle (radians), z = speed, w = opacity
// tint: rgb = ray colour, w = theme (0 aquarium, 1 space)
// fx:   x = flare, y = dust, z, w = unused
// IMPORTANT: wgslFn uses the FIRST function as the entry point; helpers follow it.
const rayPass = `
fn jellyRays(st: vec2f, base: vec4f, blur: vec4f, view: vec4f, rays: vec4f, tint: vec4f, fx: vec4f) -> vec4f {
  let t = view.x;
  let aspect = view.y;
  let audio = 0.6 + view.z * 1.4;
  let th = tint.w;
  let p = vec2f(st.x * aspect, st.y);
  var add = vec3f(0.0);

  // ---------- Aquarium god-rays ----------
  if (th < 0.999) {
    // Bright patch of surface above the frame; shafts diverge from it.
    let src = vec2f(0.5 * aspect + sin(rays.y) * 1.6, 1.0 + cos(rays.y) * 1.6);
    let d = p - src;
    let dist = length(d);
    let ang = atan2(d.x, -d.y);
    let drift = t * rays.z * 0.06;
    let x = ang * 34.0;
    // Three octaves of 1D noise across the fan give irregular shafts of varied width.
    let beam = raysNoise(x + drift * 5.0) * 0.55
      + raysNoise(x * 2.3 - drift * 8.0 + 17.0) * 0.3
      + raysNoise(x * 5.3 + drift * 3.0 + 41.0) * 0.15;
    let depth = clamp(1.0 - st.y, 0.0, 1.0);
    // Shafts soften and spread as they travel deeper (forward scattering).
    let crisp = smoothstep(0.36, 0.82, beam);
    let shafts = mix(crisp, beam * 0.55, depth * 0.45);
    // Surface waves refocus each shaft: soft, uneven flicker over time.
    let w1 = raysNoise(x * 1.3 + t * rays.z * 1.9 + 5.0);
    let w2 = raysNoise(x * 0.7 - t * rays.z * 1.3 + 23.0);
    let flick = 0.62 + 0.55 * w1 * w2 + 0.12 * sin(t * 1.7 + x * 0.6);
    let vol = exp(-depth * 1.5);
    let edge = 1.0 - smoothstep(0.42, 0.62, abs(st.x - 0.5));
    let lit = shafts * flick * vol;
    // Soft scattered light right under the surface.
    let surf = exp(-depth * 6.0) * (0.22 + 0.08 * w1);
    let amount = (lit * (0.55 + 0.45 * edge) + surf) * rays.x * audio;
    let rayCol = mix(tint.rgb, vec3f(0.78, 0.96, 1.0), 0.55);

    // Dust motes: only visible where a shaft lights them.
    var dust = 0.0;
    for (var l = 0; l < 2; l++) {
      let fl = f32(l);
      let sc = 24.0 + fl * 14.0;
      let q = p * sc + vec2f(sin(t * 0.11 + fl) * 1.3 + fl * 7.3, t * (0.12 + 0.08 * fl));
      let cell = floor(q);
      let h = raysHash2(cell + vec2f(fl * 31.7, fl * 11.3));
      if (h.x < 0.5) {
        continue;
      }
      let c = vec2f(0.5) + (h - 0.5) * 0.55
        + 0.12 * vec2f(sin(t * (0.5 + h.y) + h.x * 6.28), cos(t * (0.4 + h.x) + h.y * 6.28));
      let dpx = length(fract(q) - c) * (1080.0 / sc);
      let rpx = 0.8 + fl * 0.5 + h.y * 0.6;
      let mote = exp(-(dpx * dpx) / (rpx * rpx));
      // Flat flakes catch the light as they tumble.
      let glint = 0.3 + 0.7 * pow(0.5 + 0.5 * sin(t * (0.8 + h.y * 2.5) + h.x * 37.0), 6.0);
      dust += mote * glint * (0.6 + 0.4 * fl);
    }
    let dustLit = dust * (lit * 1.6 + surf * 0.6 + 0.04) * fx.y;

    add += (rayCol * amount + vec3f(0.85, 0.97, 1.0) * dustLit * rays.x * audio) * (1.0 - th);
  }

  // ---------- Space lens flare ----------
  if (th > 0.001) {
    let sun = vec2f((0.13 + 0.025 * sin(t * 0.045)) * aspect, 0.86 + 0.02 * cos(t * 0.037));
    let ctr = vec2f(0.5 * aspect, 0.5);
    let d = p - sun;
    let r = length(d);
    let gain = fx.x * (0.4 + rays.x) * (0.75 + view.z * 0.6) * th;

    // Hot core and layered halo.
    let core = 0.00012 / (r * r + 0.00012);
    let halo = exp(-r * 10.0) * 0.22 + exp(-r * 2.4) * 0.045;
    var flare = vec3f(1.0, 0.98, 0.95) * core * 1.3 + vec3f(1.0, 0.86, 0.7) * halo;

    // Starburst: six main diffraction spikes plus six short thin ones, slowly turning.
    let rot = t * 0.015;
    var burst = 0.0;
    for (var k = 0; k < 6; k++) {
      let fk = f32(k);
      let isMain = 1.0 - step(2.5, fk);
      let a = rot + fk * 1.0471976 + (1.0 - isMain) * 0.5235988;
      let n = vec2f(-sin(a), cos(a));
      let across = abs(dot(d, n));
      let wdt = (0.0011 + r * 0.004) * mix(0.6, 1.0, isMain);
      let len = mix(5.5, 2.5, isMain);
      burst += exp(-(across * across) / (wdt * wdt)) * exp(-r * len) * mix(0.35, 1.0, isMain);
    }
    // Fine radial streaks (integer angular frequencies so there is no seam).
    let ang = atan2(d.y, d.x);
    let fine = pow(0.5 + 0.5 * cos(ang * 23.0 + sin(ang * 7.0 + rot) * 1.4), 14.0) * 0.5
      + pow(0.5 + 0.5 * cos(ang * 37.0 + 1.3 - rot * 2.0), 22.0) * 0.4;
    burst += fine * 0.012 / (r + 0.02) * exp(-r * 4.0);
    flare += vec3f(0.95, 0.97, 1.0) * burst * 0.55;

    // Anamorphic streak: thin blue line plus a softer wide sheen.
    let ana = exp(-abs(d.y) * 260.0) * (exp(-abs(d.x) * 1.3) * 0.45 + exp(-abs(d.x) * 7.0) * 0.6)
      + exp(-abs(d.y) * 45.0) * exp(-abs(d.x) * 3.0) * 0.07;
    flare += vec3f(0.42, 0.68, 1.0) * ana;

    // Ghosts: hexagonal aperture images along the line through the frame centre.
    let axis = ctr - sun;
    for (var i = 0; i < 5; i++) {
      let fi = f32(i);
      let f = 0.42 + fi * 0.41 + 0.12 * sin(fi * 2.3);
      let g = sun + axis * f;
      let rg = 0.02 + 0.055 * fract(fi * 0.618 + 0.35);
      let q = abs(p - g);
      let hx = max(q.x * 0.8660254 + q.y * 0.5, q.y);
      let disc = 1.0 - smoothstep(rg * 0.82, rg, hx);
      let rimv = exp(-pow((hx - rg * 0.94) / (rg * 0.08), 2.0));
      let gc = 0.55 + 0.45 * cos(6.2831853 * (fi * 0.19 + vec3f(0.0, 0.33, 0.67)));
      flare += mix(gc, tint.rgb, 0.3) * (disc * 0.5 + rimv * 0.5) * (0.03 + 0.02 * fract(fi * 0.37));
    }
    // Faint rainbow halo ring around the star.
    let ringD = (r - 0.36) / 0.035;
    let ring = exp(-ringD * ringD);
    flare += (0.5 + 0.5 * cos(6.2831853 * (ringD * 0.18 + vec3f(0.0, 0.33, 0.67)))) * ring * 0.022;

    add += flare * gain;
  }

  // Bloom from bright parts of the pulled-in blur.
  let lum = dot(blur.rgb, vec3f(0.299, 0.587, 0.114));
  let bright = max(blur.rgb - vec3f(0.25), vec3f(0.0)) * smoothstep(0.2, 0.7, lum);
  let bloom = bright * view.w * 1.5;

  return vec4f(base.rgb + (add + bloom) * rays.w, 1.0);
}

fn raysHash(x: f32) -> f32 {
  return fract(sin(x * 127.1 + 11.7) * 43758.5453);
}

fn raysNoise(x: f32) -> f32 {
  let i = floor(x);
  let f = fract(x);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(raysHash(i), raysHash(i + 1.0), u);
}

fn raysHash2(p: vec2f) -> vec2f {
  var q = vec3f(p.x, p.y, p.x) * vec3f(0.1031, 0.1030, 0.0973);
  q = fract(q);
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
`;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/rays',
    label: 'Starlight Rays',
    description: 'Aquarium: volumetric god-rays with dust in the shafts. Space: a star lens flare. Audio level brightens both.',
    tags: ['jellyfish', 'cosmic'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Scene image to light with rays and bloom.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image with starlight rays and bloom.',
      },
    },
    controls: {
      opacity: { type: 'number', group: 'Rays', label: 'Opacity', default: 1, min: 0, max: 4, step: 0.01 },
      rayStrength: { type: 'number', group: 'Rays', label: 'Ray strength', default: 0.35, min: 0, max: 1.5, step: 0.01 },
      angle: { type: 'number', group: 'Rays', label: 'Angle', default: 0.35, min: -1, max: 1, step: 0.01 },
      speed: { type: 'number', group: 'Rays', label: 'Speed', default: 0.6, min: 0, max: 3, step: 0.01 },
      dust: { type: 'number', group: 'Rays', label: 'Dust', default: 1, min: 0, max: 3, step: 0.01 },
      flare: { type: 'number', group: 'Flare', label: 'Lens flare', default: 1, min: 0, max: 3, step: 0.01 },
      bloom: { type: 'number', group: 'Bloom', label: 'Bloom', default: 0.5, min: 0, max: 1.5, step: 0.01 },
      hue: { type: 'number', group: 'Color', label: 'Hue', default: 0.55, min: 0, max: 1, step: 0.01 },
    },
    controlDescriptions: {
      opacity: 'Overall opacity of the rays, flare and bloom layer.',
      rayStrength: 'Brightness of the light shafts.',
      angle: 'Slant of the shafts in radians.',
      speed: 'How fast the shafts drift and flicker.',
      dust: 'Brightness of the dust motes caught in the shafts.',
      flare: 'Strength of the space-theme star lens flare.',
      bloom: 'Strength of the soft glow around bright areas.',
      hue: 'Ray base color.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const view = uniform(new Vector4(0, aspect, 0, 0.5));
    const rays = uniform(new Vector4(0.35, 0.35, 0.6, 1));
    const tint = uniform(new Vector4(0.5, 0.8, 1, 0));
    const fx = uniform(new Vector4(1, 1, 0, 0));
    const bloomRadius = uniform(0.5);

    // One texture node per tap, all pointing at the same input; values are set in evaluate().
    const baseTex = texture(new Texture(), vec2(uv().x, uv().y.oneMinus()));
    const tapNodes: any[] = [];
    let blurSum: any = null;
    const center = vec2(0.5, 0.58);
    const fuv = vec2(uv().x, uv().y.oneMinus());
    for (let i = 0; i < BLOOM_TAPS; i++) {
      const k = (i + 1) / BLOOM_TAPS;
      const tapUv = fuv.add(center.sub(fuv).mul(float(k).mul(bloomRadius)));
      const tap = texture(new Texture(), tapUv);
      tapNodes.push(tap);
      blurSum = blurSum === null ? tap : blurSum.add(tap);
    }
    const blur = blurSum.div(float(BLOOM_TAPS));

    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    // Order matches jellyRays(st, base, blur, view, rays, tint, fx).
    material.fragmentNode = (wgslFn(rayPass) as any)(uv(), baseTex, blur, view, rays, tint, fx);
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    let level = 0;

    let th = 0;

    return {
      update(frame) {
        th += ((jellyShared.theme ?? 0) - th) * 0.1;
        const spectrum = frame.audioSpectrum;
        let target = 0;
        if (spectrum?.available) {
          for (let i = 0; i < 128; i++) {
            target += spectrum.magnitudes[i] ?? 0;
          }
          target /= 128;
        }
        level += (target - level) * 0.12;

        const c = frame.controls as any;
        const h = c.hue * Math.PI * 2;
        tint.value.set(
          0.55 + 0.45 * Math.cos(h),
          0.55 + 0.45 * Math.cos(h - 2.1),
          0.55 + 0.45 * Math.cos(h + 2.1),
          th,
        );
        view.value.set(frame.timeSeconds % 1000, aspect, Math.min(level * 4, 1.5), c.bloom);
        rays.value.set(c.rayStrength, c.angle, c.speed, c.opacity);
        fx.value.set(c.flare ?? 1, c.dust ?? 1, 0, 0);
        bloomRadius.value = 0.25 * c.bloom + 0.05;
      },
      async evaluate(inputs, evaluation) {
        baseTex.value = inputs.image.texture as Texture;
        for (const tap of tapNodes) {
          tap.value = inputs.image.texture as Texture;
        }
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        level = 0;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
