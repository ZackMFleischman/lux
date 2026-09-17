import { defineComponent } from '@lux/visual-sdk';
import {
  DataTexture, FloatType, Mesh, MeshBasicNodeMaterial, OrthographicCamera,
  PlaneGeometry, RGBAFormat, Scene, Vector4, type Texture,
} from 'three/webgpu';
import { texture, uniform, uv, wgslFn } from 'three/tsl';

// Bounded bent-ray integration: detailed disk shading only at surface crossings.
// This is a cinematic lensing approximation, not a relativistic simulation.
const quasar = wgslFn(`
fn feedingQuasar(st: vec2f, view: vec4f, disk: vec4f, jets: vec4f,
  optics: vec4f, stars: texture_2d<f32>) -> vec4f {
  let time = view.y;
  let roll = optics.w;
  let raw = (st - 0.5) * vec2f(view.x, 1.0) * 2.0;
  let p = vec2f(cos(roll)*raw.x - sin(roll)*raw.y, sin(roll)*raw.x + cos(roll)*raw.y);
  let inclination = view.w;
  let ro = vec3f(0.0, sin(inclination), cos(inclination)) * 18.0;
  let forward = -normalize(ro);
  let right = vec3f(1.0, 0.0, 0.0);
  let up = cross(right, forward);
  let focal = 2.15 * view.z;
  var rd = normalize(forward*focal + right*p.x + up*p.y);
  let initial = rd;
  var pos = ro;
  var emission = vec3f(0.0);
  var transmit = 1.0;
  var swallowed = false;
  var closest = 30.0;
  let h2 = dot(cross(ro,rd),cross(ro,rd));
  let entryB = dot(ro, rd);
  let discriminant = entryB*entryB - dot(ro,ro) + 121.0;
  if (discriminant > 0.0) {
    pos += rd * max(0.0, -entryB - sqrt(discriminant));
    for (var i = 0; i < 88; i++) {
      let r = length(pos);
      closest = min(closest, r);
      if (r < 1.02 * optics.x) { swallowed = true; break; }
      if (r > 11.2 && dot(pos,rd) > 0.0) { break; }
      let stepLength = clamp(r * 0.115, 0.075, 1.0);
      let force = -1.5 * h2 * pos / max(0.01, r*r*r*r*r) * optics.x;
      // Velocity Verlet preserves the critical orbit without normalization drift.
      let nextPosition = pos + rd * stepLength + force * (0.5*stepLength*stepLength);
      let nextRadius = max(0.2,length(nextPosition));
      let nextRadius2 = nextRadius*nextRadius;
      let nextForce = -1.5*h2*nextPosition / (nextRadius2*nextRadius2*nextRadius) * optics.x;
      let nextDirection = rd + (force+nextForce) * (0.5*stepLength);
      if (pos.y * nextPosition.y <= 0.0) {
        let crossing = clamp(pos.y / (pos.y - nextPosition.y + 0.000001), 0.0, 1.0);
        let hit = mix(pos, nextPosition, crossing);
        let radius = length(hit.xz);
        if (radius > 1.72 && radius < disk.w) {
          let angle = atan2(hit.z, hit.x);
          let flow = angle + time*disk.x*2.8 / pow(radius,1.35);
          // Periodic angular coordinates avoid an atan2 seam through the disk.
          let coord = vec2f(log(radius)*20.0, sin(flow*8.0)*3.0 + cos(flow*5.0)*2.0);
          let broad = qNoise(coord*0.43);
          let grain = qNoise(coord*vec2f(2.8,1.2) + broad*2.4);
          let fine = qNoise(coord*vec2f(8.0,2.0));
          let filaments = pow(0.5+0.5*sin(radius*31.0 + broad*7.0 + grain*3.0), 4.0);
          let lanes = 0.18 + pow(0.24 + 0.48*broad + 0.40*grain,2.2) + 0.12*filaments + 0.10*fine;
          let textureDetail = mix(0.82, lanes, disk.y);
          let innerEdge = smoothstep(1.72,2.04,radius);
          let outerEdge = 1.0-smoothstep(disk.w*0.65,disk.w,radius);
          let heat = pow(2.05 / max(radius,2.05), 1.55);
          let approaching = clamp(0.5 + 0.5*hit.x/radius,0.0,1.0);
          let beaming = mix(0.44,2.15,pow(approaching,1.7));
          let hot = vec3f(1.0,0.80,0.49);
          let cool = vec3f(0.58,0.105,0.027);
          var color = mix(cool,hot,pow(heat,0.6));
          color = mix(color,vec3f(0.73,0.87,1.0),pow(heat,4.0)*0.22);
          let power = innerEdge*outerEdge*heat*textureDetail*beaming*disk.z;
          emission += color * power * transmit * 2.8;
          transmit *= 1.0 - innerEdge*outerEdge*0.88;
        }
      }
      pos = nextPosition;
      rd = nextDirection;
    }
    if (length(pos) < 3.0) { swallowed = true; }
  }

  // Lensing samples the *input* sky: the shared stars bend with the same ray.
  let bend = normalize(rd) - initial;
  let warp = vec2f(dot(bend,right),dot(bend,up)) * 0.18 * optics.x;
  let unrolled = vec2f(cos(roll)*warp.x + sin(roll)*warp.y,-sin(roll)*warp.x+cos(roll)*warp.y);
  let skyUv = fract(st + unrolled / vec2f(view.x,1.0));
  let dims = vec2i(textureDimensions(stars));
  let skyPixel = vec2i(clamp(vec2f(skyUv.x,1.0-skyUv.y),vec2f(0.0),vec2f(0.99999))*vec2f(dims));
  let sky = textureLoad(stars,skyPixel,0).rgb;
  var color = emission + select(sky*transmit,vec3f(0.0),swallowed);

  // A narrow, softly bloomed critical curve strengthens the readable silhouette.
  let impact = sqrt(h2);
  let critical = 2.60 * optics.x;
  let ring = exp(-pow((impact-critical)/0.075,2.0));
  let ringHalo = exp(-abs(impact-critical)*8.0)*0.10;
  color += vec3f(1.0,0.56,0.22)*(ring+ringHalo)*optics.y*(0.70+0.3*p.x);

  // Polar plasma: a translucent envelope and three intertwined filaments.
  // Screen-space projection keeps this detail independent of ray step count.
  let axisDistance = abs(p.y);
  let start = critical*focal/18.0*1.08;
  let h = max(0.0,axisDistance-start);
  let jetFade = smoothstep(start,start+0.15,axisDistance) * exp(-h*1.1);
  let jetWidth = jets.y*(0.018 + h*0.075);
  let spiral = h*jets.z*17.0 - time*jets.w*2.2;
  let envelope = exp(-pow(p.x/(jetWidth*1.4+0.001),2.0))*0.19;
  var plasma = envelope;
  for(var strand=0; strand<3; strand++) {
    let phase = spiral + f32(strand)*2.094395;
    let center = sin(phase)*jetWidth*(0.76+0.15*sin(h*14.0-time));
    let width = max(0.0018,jetWidth*0.11);
    let filament = exp(-pow((p.x-center)/width,2.0));
    let glow = exp(-abs(p.x-center)/(width*4.0))*0.16;
    plasma += (filament*0.45+glow)*(0.55+0.45*cos(phase));
  }
  let shocks = pow(0.5+0.5*sin(h*31.0-time*jets.w*3.0),8.0);
  let jetColor = mix(vec3f(0.19,0.62,1.0),vec3f(0.58,0.20,1.0),clamp(h*0.65,0.0,1.0));
  let nearJet = select(0.63,1.0,p.y>0.0);
  let vapor = qNoise(vec2f(p.x*130.0,h*35.0-time*jets.w*2.0));
  plasma += envelope*vapor*2.0;
  color += jetColor*plasma*jetFade*jets.x*nearJet*(0.8+shocks*0.45);
  // Tiny near-pole launch glow, outside the dark shadow.
  color += vec3f(0.23,0.52,1.0)*exp(-pow(p.x/0.055,2.0)-pow((axisDistance-start-0.10)/0.12,2.0))*jets.x*0.25;
  let vignette = 1.0 - 0.20*smoothstep(0.8,2.2,length(raw));
  // Component image targets are rgba8; compress radiance before that boundary.
  let mapped = vec3f(1.0)-exp(-max(color,vec3f(0.0))*0.82);
  return vec4f(mapped*vignette,1.0);
}

fn qHash(p: vec2f) -> f32 {
  return fract(sin(dot(p,vec2f(127.1,311.7)))*43758.5453);
}
fn qNoise(p: vec2f) -> f32 {
  let i=floor(p); let f=fract(p); let u=f*f*(3.0-2.0*f);
  return mix(mix(qHash(i),qHash(i+vec2f(1.0,0.0)),u.x),
    mix(qHash(i+vec2f(0.0,1.0)),qHash(i+vec2f(1.0,1.0)),u.x),u.y);
}
`);

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'creative/feeding-quasar',
    label: 'Feeding Quasar',
    description: 'Bent-light accretion disk, dark shadow, photon ring and intertwined polar plasma jets.',
    tags: ['space','black-hole','quasar'],
    inputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Starfield', description: 'Background stars to gravitationally distort.' } },
    outputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Quasar', description: 'Linear quasar radiance over the lensed sky.' } },
    controls: {
      zoom: { type:'number',label:'Framing',group:'Camera',default:1,min:0.6,max:1.5,step:0.01 },
      inclination: { type:'number',label:'Disk viewing angle',group:'Camera',default:12,min:3,max:65,step:0.1 },
      roll: { type:'number',label:'Composition tilt',group:'Camera',default:-10,min:-45,max:45,step:0.1 },
      drift: { type:'number',label:'Slow camera drift',group:'Camera',default:0.3,min:0,max:1,step:0.01 },
      spin: { type:'number',label:'Disk spin',group:'Accretion disk',default:1,min:0,max:4,step:0.01 },
      turbulence: { type:'number',label:'Turbulence detail',group:'Accretion disk',default:1,min:0,max:1.5,step:0.01 },
      heat: { type:'number',label:'Disk radiance',group:'Accretion disk',default:1.5,min:0.1,max:4,step:0.01 },
      radius: { type:'number',label:'Outer disk radius',group:'Accretion disk',default:8,min:4,max:10,step:0.1 },
      jetPower: { type:'number',label:'Jet radiance',group:'Polar jets',default:1.4,min:0,max:4,step:0.01 },
      jetWidth: { type:'number',label:'Jet width',group:'Polar jets',default:1,min:0.3,max:2.5,step:0.01 },
      jetTwist: { type:'number',label:'Helix turns',group:'Polar jets',default:1,min:0.2,max:2,step:0.01 },
      jetSpeed: { type:'number',label:'Outflow speed',group:'Polar jets',default:1,min:0,max:4,step:0.01 },
      lensing: { type:'number',label:'Light bending',group:'Lensing',default:1,min:0.4,max:1.4,step:0.01 },
      photon: { type:'number',label:'Photon ring',group:'Lensing',default:0.8,min:0,max:3,step:0.01 },
    },
    controlDescriptions: {
      zoom:'Overall framing; higher values bring the quasar closer.',
      inclination:'Degrees above the disk plane. Low angles reveal the lensed arch.',
      roll:'Tilts the entire composition, including both polar jets.',
      drift:'Slow breathing of the viewing angle, with no camera cuts.',
      spin:'Differential disk rotation: the inner material revolves faster.',
      turbulence:'Strength of fine turbulent filaments in the disk.',
      heat:'Emission before exposure and highlight bloom.',
      radius:'Outer reach of the feeding disk.',
      jetPower:'Emission of the cool polar plasma.',
      jetWidth:'Width of the expanding jet envelope and its filaments.',
      jetTwist:'Number of turns in the intertwined polar helices.',
      jetSpeed:'Outward travel speed of jet filaments and knots.',
      lensing:'Artistic strength of the approximate gravitational bending.',
      photon:'Brightness of the thin ring tracing the shadow.',
    },
    lifecycle: { state:'stateless',reset:'seed' },
  },
  async create(context) {
    const scene = new Scene();
    const camera = new OrthographicCamera(-1,1,1,-1,0,1);
    const geometry = new PlaneGeometry(2,2);
    const fallback = new DataTexture(new Float32Array([0,0,0,1]),1,1,RGBAFormat,FloatType);
    fallback.needsUpdate = true;
    const background = texture(fallback);
    const view = uniform(new Vector4(context.settings.width/context.settings.height,0,1,0.2));
    const disk = uniform(new Vector4(1,1,1.5,8));
    const jets = uniform(new Vector4(1.4,1,1,1));
    const optics = uniform(new Vector4(1,0.8,0,0));
    const material = new MeshBasicNodeMaterial({ depthTest:false,depthWrite:false,toneMapped:false });
    material.fragmentNode = quasar(uv(),view,disk,jets,optics,background);
    const mesh = new Mesh(geometry,material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return {
      update(frame) {
        const c=frame.controls;
        view.value.set(context.settings.width/context.settings.height,frame.timeSeconds,c.zoom,
          (c.inclination+Math.sin(frame.timeSeconds*0.065)*c.drift*5)*Math.PI/180);
        disk.value.set(c.spin,c.turbulence,c.heat,c.radius);
        jets.value.set(c.jetPower,c.jetWidth,c.jetTwist,c.jetSpeed);
        optics.value.set(c.lensing,c.photon,0,(c.roll+Math.sin(frame.timeSeconds*0.041)*c.drift*6)*Math.PI/180);
      },
      async evaluate(inputs,evaluation) {
        background.value = inputs.image.texture as Texture;
        return { image: await evaluation.render(scene,camera) };
      },
      reset() {},
      dispose() { geometry.dispose(); material.dispose(); fallback.dispose(); },
    };
  },
});
