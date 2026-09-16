import { tracerSplineWgsl } from './tracer-spline.ts';
import { defineComponent, type ImageResource } from '@lux/visual-sdk';
import {
  DataTexture,
  FloatType,
  Mesh,
  MeshBasicNodeMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  type Texture,
} from 'three/webgpu';
import { texture, uniform, uv, vec4, wgslFn } from 'three/tsl';

import { packTracerTexture, TRACER_TEXTURE_WIDTH } from './tracer-texture.ts';

// This is the saved painting's tracer treatment applied to a shared polyline.
// Geometry arrives through a float texture; all width, pigment, hatch, rim,
// tip, and watercolor behavior remains per-pixel in the fragment shader.
const tracerPainting = wgslFn(`
fn wanderingTracerRenderer(st: vec2f, baseSample: vec4f, view: vec4f,
  trailData: texture_2d<f32>) -> vec4f {
  let aspect = view.x;
  let tracerContrast = clamp(view.y, 0.0, 1.0);
  let hatchAmount = clamp(view.z, 0.0, 1.0);
  let bleedAmount = clamp(view.w, 0.0, 1.0);
  let scale = 6.2;
  let p = (st - 0.5) * vec2f(aspect, 1.0);
  let pixel = max(length(dpdx(p)), length(dpdy(p)));
  let gammaBase = pow(max(baseSample.rgb, vec3f(0.0)), vec3f(1.0 / 2.2));
  var color = gammaBase;
  let underpainting = gammaBase;
  let cream = mix(vec3f(0.89, 0.86, 0.70), vec3f(0.94, 0.79, 0.75), 0.23);


  for (var index = 0; index < 4; index++) {
    let metadata = textureLoad(trailData, vec2i(256 + index, 0), 0);
    let count = i32(metadata.x);
    if (count < 2) { continue; }
    let offset = index * 64;
    var nearest = 1000.0;
    var winningSegment = 0;
    var winningRatio = 0.0;
    for (var pointIndex = 0; pointIndex < 63; pointIndex++) {
      if (pointIndex + 1 >= count) { break; }
      let a = textureLoad(trailData, vec2i(offset + pointIndex, 0), 0);
      let b = textureLoad(trailData, vec2i(offset + pointIndex + 1, 0), 0);
      let direction = b.xy - a.xy;
      let denominator = max(dot(direction, direction), 0.0000001);
      let ratio = clamp(dot(p - a.xy, direction) / denominator, 0.0, 1.0);
      let delta = p - mix(a.xy, b.xy, ratio);
      let squaredDistance = dot(delta, delta);
      if (squaredDistance < nearest) {
        nearest = squaredDistance;
        winningSegment = pointIndex;
        winningRatio = ratio;
      }
    }

    // The linear pass above cheaply identifies the local curve span. Refine
    // only that span against a Catmull-Rom spline, preserving the 64-point
    // texture budget without exposing its polygonal joins in the thin ribbon.
    let control0 = textureLoad(trailData, vec2i(offset + max(winningSegment - 1, 0), 0), 0);
    let control1 = textureLoad(trailData, vec2i(offset + winningSegment, 0), 0);
    let control2 = textureLoad(trailData, vec2i(offset + min(winningSegment + 1, count - 1), 0), 0);
    let control3 = textureLoad(trailData, vec2i(offset + min(winningSegment + 2, count - 1), 0), 0);
    var curveRatio = winningRatio;
    for (var refinement = 0; refinement < 3; refinement++) {
      let curvePoint = wtCatmull(control0.xy, control1.xy, control2.xy, control3.xy, curveRatio);
      let curveTangent = wtCatmullDerivative(control0.xy, control1.xy, control2.xy, control3.xy, curveRatio);
      let curveAcceleration = wtCatmullSecondDerivative(
        control0.xy, control1.xy, control2.xy, control3.xy, curveRatio);
      let residual = curvePoint - p;
      let denominator = dot(curveTangent, curveTangent) + dot(residual, curveAcceleration);
      if (abs(denominator) > 0.0000001) {
        curveRatio = clamp(curveRatio - dot(residual, curveTangent) / denominator, 0.0, 1.0);
      }
    }
    let curvePoint = wtCatmull(control0.xy, control1.xy, control2.xy, control3.xy, curveRatio);
    var curveTangent = wtCatmullDerivative(
      control0.xy, control1.xy, control2.xy, control3.xy, curveRatio);
    if (dot(curveTangent, curveTangent) < 0.0000001) {
      curveTangent = control2.xy - control1.xy;
    }
    let curveDelta = p - curvePoint;
    nearest = dot(curveDelta, curveDelta);
    let sideSign = select(-1.0, 1.0,
      curveTangent.x * curveDelta.y - curveTangent.y * curveDelta.x >= 0.0);
    let along = clamp(
      wtCatmullScalar(control0.w, control1.w, control2.w, control3.w, curveRatio),
      min(control1.w, control2.w), max(control1.w, control2.w));
    let fullWidth = max(
      wtCatmullScalar(control0.z, control1.z, control2.z, control3.z, curveRatio), 0.001);

    let head = textureLoad(trailData, vec2i(offset + count - 1, 0), 0);
    let distanceToPath = sqrt(nearest);
    let side = distanceToPath * sideSign;
    let headDistance = length(p - head.xy);
    let wake = smoothstep(0.0, 0.80, (head.w - along) * scale);
    let halfWidth = max(fullWidth * 0.5, 0.0005);
    let distanceToBand = distanceToPath - halfWidth;
    let fill = 1.0 - smoothstep(-pixel * 0.65, pixel * 0.65, distanceToBand);
    let rim = 1.0 - smoothstep(pixel * 0.35, pixel * 1.25, abs(distanceToBand));
    let trailOpacity = metadata.y;

    // The saved analytic wet wash: uneven absorption, widening diffusion,
    // a soft head bloom, and a faint deposit at the wet edge.
    let wetAge = clamp((head.w - along) * scale / max(head.w * scale + 1.15, 0.1), 0.0, 1.0);
    let random = wtHash2(vec2f(metadata.z * 0.001 + 17.0, metadata.w * 23.1 + 71.0));
    let absorption = 0.70 + 0.65 * wtFbm(p * scale * 3.0 + random * 17.0);
    let spread = (0.15 + 0.66 * sqrt(wetAge)) * absorption;
    let spreadDistance = distanceToPath * scale / max(spread, 0.01);
    let diffusion = exp(-spreadDistance * spreadDistance * 1.45);
    let tipBloom = exp(-pow(headDistance * scale, 2.0) / 0.065);
    let wetness = max(diffusion * (0.82 - wetAge * 0.25), tipBloom * 0.75)
      * trailOpacity * bleedAmount;

    // Pigment remains stable for one lifetime. The six muted families and
    // contrast response match the original painting shader.
    let pigmentRandom = wtHash2(vec2f(metadata.z * 0.001 + 911.0, metadata.w * 41.3 + 29.0));
    let pigmentFamily = floor(pigmentRandom.x * 6.0);
    var tint = vec3f(0.21, 0.35, 0.49);
    if (pigmentFamily > 0.5) { tint = vec3f(0.19, 0.47, 0.43); }
    if (pigmentFamily > 1.5) { tint = vec3f(0.40, 0.48, 0.30); }
    if (pigmentFamily > 2.5) { tint = vec3f(0.64, 0.51, 0.30); }
    if (pigmentFamily > 3.5) { tint = vec3f(0.59, 0.38, 0.40); }
    if (pigmentFamily > 4.5) { tint = vec3f(0.40, 0.32, 0.48); }
    tint *= (0.88 + pigmentRandom.y * 0.22) * (1.0 + tracerContrast * 0.24);
    let tracerInk = mix(tint, cream,
      mix(0.23 + pigmentRandom.y * 0.22, 0.94, tracerContrast));
    let pigmentMix = mix(sqrt(max(color, vec3f(0.001)) * tint), tint, 0.38);
    let inkResist = 1.0 - smoothstep(0.72, 0.88, max(color.r, max(color.g, color.b)));
    let pigmentAlpha = wetness * 0.76 * inkResist;
    color = mix(color, pigmentMix, pigmentAlpha);
    let deposit = exp(-pow((spreadDistance - 0.88) * 6.0, 2.0))
      * 0.045 * trailOpacity * bleedAmount;
    color *= 1.0 - deposit * inkResist;

    var ribbon = mix(underpainting, tint, mix(0.60, 0.48, tracerContrast));
    // Dense, warped hatch families use the path's arc-distance coordinates.
    // Their angle, spacing, bend, jitter, and pressure reseed per lifetime.
    let hatchStyle = wtHash2(vec2f(metadata.z * 0.001 + 503.0, metadata.w * 29.1 + 89.0));
    let hatchDetail = wtHash2(vec2f(metadata.z * 0.001 + 701.0, metadata.w * 37.9 + 13.0));
    let lengthwise = step(0.78, hatchStyle.x);
    let hatchAngle = mix((hatchStyle.x - 0.39) * 2.9,
      1.570796 + (hatchDetail.x - 0.5) * 0.20, lengthwise);
    let bodyAcross = along * scale * cos(hatchAngle) + side * scale * sin(hatchAngle);
    let bodyAlong = -along * scale * sin(hatchAngle) + side * scale * cos(hatchAngle);
    let hatchSpacing = max(0.096 * mix(0.48, 1.45, hatchStyle.y)
      * mix(1.0, 0.46, lengthwise), 0.012);
    let hatchBend = (0.003 + hatchDetail.y * 0.025)
      * sin(bodyAlong * (1.9 + hatchDetail.x * 3.0) + hatchStyle.y * 9.0);
    let hatchPhase = (bodyAcross + hatchBend) / hatchSpacing;
    let tracerLine = floor(hatchPhase + 0.5);
    let tracerJitter = (wtHash(vec2f(tracerLine, hatchDetail.x * 127.0)) - 0.5) * 0.13;
    let hatchDistance = abs(fract(hatchPhase + tracerJitter + 0.5) - 0.5);
    let hatchAA = max(fwidth(hatchPhase), 0.001);
    let strokeWeight = 0.18 * mix(2.2, 4.0, hatchDetail.y)
      * (0.83 + 0.17 * sin(bodyAlong * 7.0 + tracerLine));
    let hatchWidth = min(0.25, strokeWeight * hatchAA);
    let hatchInk = (1.0 - smoothstep(hatchWidth - hatchAA * 0.5,
      hatchWidth + hatchAA * 0.5, hatchDistance)) * hatchAmount;
    ribbon = mix(ribbon, tracerInk,
      hatchInk * wake * mix(0.72, 0.88, tracerContrast));

    let fillAlpha = fill * trailOpacity;
    let rimAlpha = rim * trailOpacity * mix(0.76, 0.96, tracerContrast);
    let tip = 1.0 - smoothstep(pixel * 1.1, pixel * 2.5, headDistance);
    let tipAlpha = tip * trailOpacity * mix(0.80, 1.0, tracerContrast);
    color = mix(color, ribbon, fillAlpha);
    color = mix(color, tracerInk, rimAlpha);
    color = mix(color, tracerInk, tipAlpha);
  }

  return vec4f(pow(clamp(color, vec3f(0.0), vec3f(1.0)), vec3f(2.2)), 1.0);
}

${tracerSplineWgsl}
fn wtHash(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn wtHash2(p: vec2f) -> vec2f {
  return vec2f(wtHash(p), wtHash(p + vec2f(39.7, 17.2)));
}

fn wtNoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wtHash(i), wtHash(i + vec2f(1.0, 0.0)), u.x),
    mix(wtHash(i + vec2f(0.0, 1.0)), wtHash(i + vec2f(1.0, 1.0)), u.x), u.y);
}

fn wtFbm(p: vec2f) -> f32 {
  return wtNoise(p) * 0.56 + wtNoise(p * 2.03 + 7.1) * 0.27
    + wtNoise(p * 4.09 + 19.3) * 0.12 + wtNoise(p * 8.13 + 31.7) * 0.05;
}
`);

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'examples/wandering-tracer-renderer',
    label: 'Wandering Tracer Renderer',
    description: 'Paints shared tracer paths with the saved watercolor, hatch, rim, and rounded-tip treatment.',
    tags: ['tracers', 'effect'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Background image under the tracer pigment.',
      },
      paths: {
        type: { kind: 'paths2d', version: 1, coordinateSpace: 'canvas-height' },
        label: 'Paths',
        description: 'Tracer path snapshot to paint.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Background with tracer pigment composited over it.',
      },
    },
    controls: {
      contrast: { type: 'number', group: 'Tracer appearance', label: 'Contrast', default: 1, min: 0, max: 1, step: 0.01 },
      hatch: { type: 'number', group: 'Tracer appearance', label: 'Hatching', default: 1, min: 0, max: 1, step: 0.01 },
      bleed: { type: 'number', group: 'Tracer appearance', label: 'Bleed', default: 1, min: 0, max: 1, step: 0.01 },
    },
    controlDescriptions: {
      contrast: 'Matches the saved painting at one and softens pigment and rim contrast toward zero.',
      hatch: 'Scales the dense lifetime-seeded hatch ink without changing its spacing family.',
      bleed: 'Scales the original textured watercolor diffusion and edge deposit.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = uniform(context.settings.width / context.settings.height);
    const contrast = uniform(1);
    const hatch = uniform(1);
    const bleed = uniform(1);
    const pathData = new Float32Array(TRACER_TEXTURE_WIDTH * 4);
    const pathTexture = new DataTexture(pathData, TRACER_TEXTURE_WIDTH, 1, RGBAFormat, FloatType);
    pathTexture.minFilter = pathTexture.magFilter = NearestFilter;
    pathTexture.generateMipmaps = false;
    const fallbackTexture = new DataTexture(new Float32Array([0, 0, 0, 1]), 1, 1, RGBAFormat, FloatType);
    fallbackTexture.minFilter = fallbackTexture.magFilter = NearestFilter;
    fallbackTexture.generateMipmaps = false;
    // Component images are render-target textures. Explicitly align their
    // texture-space Y with this plane's canvas-space path coordinates.
    const baseImageNode = texture(fallbackTexture, uv().flipY());

    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const imageScene = new Scene();
    const imageMaterial = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    imageMaterial.fragmentNode = tracerPainting(
      uv(),
      baseImageNode,
      vec4(aspect, contrast, hatch, bleed),
      texture(pathTexture),
    );
    const imageMesh = new Mesh(geometry, imageMaterial);
    imageMesh.frustumCulled = false;
    imageScene.add(imageMesh);

    function bindImage(source: ImageResource): void {
      baseImageNode.value = source.texture as Texture;
    }

    return {
      update(frame) {
        contrast.value = frame.controls.contrast;
        hatch.value = frame.controls.hatch;
        bleed.value = frame.controls.bleed;
      },
      async evaluate(inputs, evaluation) {
        packTracerTexture(inputs.paths.data, pathData);
        pathTexture.needsUpdate = true;
        bindImage(inputs.image);
        const image = await evaluation.render(imageScene, camera, 'image');
        return { image };
      },
      reset() {
        pathData.fill(0);
        pathTexture.needsUpdate = true;
      },
      dispose() {
        geometry.dispose();
        imageMaterial.dispose();
        pathTexture.dispose();
        fallbackTexture.dispose();
      },
    };
  },
});
