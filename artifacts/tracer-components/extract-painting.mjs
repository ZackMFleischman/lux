import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
const old=await readFile('C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac/living-painting.ts','utf8');
let s=old.replace("import { defineVisual }", "import { defineComponent, type Paths2DResource }")
  .replace('  Scene,','  Scene,\n  Vector4,').replace('import { uniform, uv, vec4, wgslFn }','import { uniform, uniformArray, uv, vec4, wgslFn }');
s=s.replace('tracers: vec4f) -> vec4f {','tracers: vec4f, trailPoints: array<vec4f, 256>, trailMeta: array<vec4f, 4>) -> vec4f {');
s=s.replace('if (f32(traceIndex) < tracers.x)', 'if (trailMeta[traceIndex].x > 1.0)');
s=s.replace('t, form.x, view.y, tracers, seed.x, f32(traceIndex));','t, form.x, view.y, tracers, seed.x, f32(traceIndex), trailPoints, trailMeta);');
const overlayStart=s.indexOf('  color = lpCarveTracers('), overlayEnd=s.indexOf('  // Stationary paper grain',overlayStart);
s=s.slice(0,overlayStart)+s.slice(overlayEnd);
const helperStart=s.indexOf('// Sample the whole perimeter'), helperEnd=s.indexOf('// A slow rise,',helperStart);
s=s.slice(0,helperStart)+`// Consume the exact geometry published by Tracer Paths. The region transition
// intentionally retains the uneven per-pixel wash behavior of the saved study.
fn lpTracerSplit(p: vec2f, q: vec2f, center: vec2f, owner: vec2f,
  planes: array<vec3f, 25>, planeCount: i32, time: f32, scale: f32,
  aspect: f32, settings: vec4f, seed: f32, index: f32,
  points: array<vec4f, 256>, metadata: array<vec4f, 4>) -> vec4f {
  let slot = i32(index);
  let count = i32(metadata[slot].x);
  let offset = slot * 64;
  let sheetOffset = q - p;
  var crossingEntry = 1000.0;
  var crossingExit = -1000.0;
  var nearest = 1000.0;
  var signedSide = 0.0;
  for (var j = 0; j < 63; j++) {
    if (j + 1 >= count) { break; }
    let a = points[offset + j];
    let b = points[offset + j + 1];
    let start = a.xy * scale;
    let direction = (b.xy - a.xy) * scale;
    let ratio = clamp(dot(p - start, direction) / max(dot(direction, direction), 0.000001), 0.0, 1.0);
    let delta = p - (start + direction * ratio);
    let distance = dot(delta, delta);
    if (distance < nearest) {
      nearest = distance;
      signedSide = direction.x * delta.y - direction.y * delta.x;
    }
    let origin = start + sheetOffset;
    // Skip distant segments before clipping against the cell half planes.
    if (length(origin + direction * 0.5 - center) < 3.5) {
      var low = 0.0;
      var high = 1.0;
      for (var k = 0; k < planeCount; k++) {
        let numerator = planes[k].z - dot(planes[k].xy, origin);
        let denominator = dot(planes[k].xy, direction);
        if (abs(denominator) < 0.00001) {
          if (numerator < 0.0) { high = -1.0; }
        } else if (denominator > 0.0) {
          high = min(high, numerator / denominator);
        } else {
          low = max(low, numerator / denominator);
        }
      }
      if (high > low) {
        crossingEntry = min(crossingEntry, mix(a.w, b.w, low) * scale);
        crossingExit = max(crossingExit, mix(a.w, b.w, high) * scale);
      }
    }
  }
  let headDistance = points[offset + max(count - 1, 0)].w * scale;
  let blend = smoothstep(0.08, 0.25, crossingExit - crossingEntry)
    * smoothstep(0.0, 0.48, headDistance - crossingExit) * metadata[slot].y;
  let side = step(0.0, signedSide);
  let childOwner = owner + vec2f(137.7 + side * 79.3 + index * 53.1,
    213.1 + metadata[slot].w * 31.7 + side * 43.9 + index * 117.3);
  return vec4f(blend, childOwner, side);
}

`+s.slice(helperEnd);
s=s.replace('export default defineVisual({\n  controls: {',`export default defineComponent({
  metadata: {
    declarationVersion: 1, key: 'lux/living-painting', label: 'Living Painting',
    description: 'Organic watercolor regions that adopt new colors and hatch styles when shared tracer paths cross them.',
    tags: ['painting', 'regions', 'watercolor'],
    inputs: { paths: { type: { kind: 'paths2d', version: 1, coordinateSpace: 'canvas-height' }, label: 'Paths', description: 'Shared tracer geometry used to carve the regions.' } },
    outputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'The painting before tracer ink is composited.' } },
  controls: {`);
s=s.replace(/^    tracer\w+: \{.*\},\r?\n/gm,'');
const controlsStart=s.indexOf('  controls: {'),controlsEnd=s.indexOf('  async create(context)',controlsStart);
const keys=[...s.slice(controlsStart,controlsEnd).matchAll(/^    (\w+): \{/gm)].map(m=>m[1]);
s=s.replace('  async create(context)',`    controlDescriptions: {${keys.map(k=>`${k}: '${k} setting for the painting.'`).join(',\n      ')}},
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context)`);
s=s.replace(/    const tracer\w+ = uniform\([^\n]+\);\n/g,'');
s=s.replace('    const material = new MeshBasicNodeMaterial',`    const points = Array.from({ length: 256 }, () => new Vector4());
    const meta = Array.from({ length: 4 }, () => new Vector4());
    const pathPoints = uniformArray(points, 'vec4');
    const pathMeta = uniformArray(meta, 'vec4');
    const material = new MeshBasicNodeMaterial`);
s=s.replace('      vec4(tracerAmount, tracerSpeed, tracerCurl, tracerContrast),','      vec4(4, 0, 0, 0),\n      pathPoints, pathMeta,');
s=s.replace(/^        tracer\w+\.value = c\.tracer\w+;\r?\n/gm,'');
s=s.replace(`      render(target) {
        return context.renderer.render(scene, camera, target);
      },`,`      async evaluate(inputs, evaluation) {
        const paths = (inputs.paths as Paths2DResource).data.paths;
        if (paths.length > 4 || paths.some(path => path.points.length > 64)) {
          throw Error('Living Painting supports at most four paths of 64 points.');
        }
        meta.forEach(value => value.set(0, 0, 0, 0));
        paths.forEach((path, index) => {
          meta[index].set(path.points.length, path.opacity, path.styleSeed, path.generation);
          path.points.forEach((point, j) => points[index * 64 + j].set(point.x, point.y, point.width, point.distance));
        });
        return { image: await evaluation.render(scene, camera) };
      },`);
await mkdir(new URL('examples/components/wandering-tracers/',root),{recursive:true});
await writeFile(new URL('examples/components/wandering-tracers/painting.ts',root),s);
console.log({keys,bytes:s.length});
