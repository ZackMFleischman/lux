import { Scene, Camera, Mesh, PlaneGeometry, MeshBasicNodeMaterial, OrthographicCamera } from 'three/webgpu';
import { pass, uniform, uv, vec2, vec4, float, atan, cos, sin, mix } from 'three/tsl';

// Reusable image effect: supply any underlying Three scene and its camera.
// It samples that scene's rendered image, including its alpha channel.
export function createKaleidoscope(inputScene: Scene, inputCamera: Camera, aspect: number) {
  const input = pass(inputScene, inputCamera);
  const image = input.getTextureNode();
  const segments = uniform(6), zoom = uniform(1.25), rotation = uniform(0);
  const twist = uniform(0.35), rings = uniform(1.2), blend = uniform(1);
  const prism = uniform(0.001), offsetX = uniform(0.015), offsetY = uniform(0.015);
  const sourceRadius = uniform(0.19);
  const sampleAngle = uniform(0);
  const screen = uv();
  const p = screen.sub(0.5).mul(vec2(aspect, 1));
  const radius = p.length().div(zoom);
  const sector = float(Math.PI * 2).div(segments);
  const angle = atan(p.y, p.x).add(rotation).add(radius.mul(twist));
  const folded = angle.div(sector).fract().sub(0.5).abs().mul(sector).add(sampleAngle);
  // Mirrored radial repetition keeps all samples within the source image.
  const distance = float(1).sub(radius.mul(rings).fract().mul(2).sub(1).abs()).mul(sourceRadius);
  const direction = vec2(cos(folded).div(aspect), sin(folded));
  const origin = vec2(offsetX.add(0.5), offsetY.add(0.5));
  const q = origin.add(direction.mul(distance));
  const center = image.sample(q);
  const red = image.sample(q.add(direction.mul(prism))).r;
  const blue = image.sample(q.sub(direction.mul(prism))).b;
  const processed = vec4(red, center.g, blue, center.a);
  const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
  material.fragmentNode = mix(image.sample(screen), processed, blend);
  const geometry = new PlaneGeometry(2, 2);
  const quad = new Mesh(geometry, material);
  quad.frustumCulled = false;
  const scene = new Scene();
  scene.add(quad);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    scene, camera,
    update(time: number, values: { segments: number; zoom: number; rotation: number; spin: number; twist: number; rings: number; blend: number; prism: number; offsetX: number; offsetY: number; drift: number; sourceRadius: number }) {
      segments.value = Math.round(values.segments);
      zoom.value = values.zoom;
      rotation.value = values.rotation + time * values.spin;
      twist.value = values.twist;
      rings.value = values.rings;
      blend.value = values.blend;
      prism.value = values.prism;
      sourceRadius.value = values.sourceRadius;
      offsetX.value = values.offsetX;
      offsetY.value = values.offsetY;
      sampleAngle.value = time * values.drift;
    },
    dispose() { geometry.dispose(); material.dispose(); input.dispose(); },
  };
}
