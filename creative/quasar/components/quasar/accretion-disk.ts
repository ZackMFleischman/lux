import { defineComponent } from '@lux/visual-sdk';
import {
  DataTexture, FloatType, Mesh, MeshBasicNodeMaterial, OrthographicCamera,
  PlaneGeometry, RGBAFormat, Scene, Vector3, Vector4, type Texture,
} from 'three/webgpu';
import { texture, uniform, uv, wgslFn } from 'three/tsl';
import { readCameraController, resolveCameraPose } from './camera-controller/camera-pose.ts';

// Bounded bent-ray integration: detailed disk shading only at surface crossings.
// This is a cinematic lensing approximation, not a relativistic simulation.
const diskShader = `
fn feedingQuasar(st: vec2f, view: vec4f, disk: vec4f, jets: vec4f,
  optics: vec4f, bodies: vec4f, origin:vec3f, cameraForward:vec3f,
  cameraRight:vec3f, cameraUp:vec3f, stars: texture_2d<f32>) -> vec4f {
  let time = view.y;
  let raw = (st - 0.5) * vec2f(view.x, 1.0) * 2.0;
  let p = raw;
  let ro = origin;
  let forward = cameraForward;
  let right = cameraRight;
  let up = cameraUp;
  let focal = 2.15 * view.z;
  var rd = normalize(forward*focal + right*p.x + up*p.y);
  let initial = rd;
  var pos = ro;
  var emission = vec3f(0.0);
  var transmit = 1.0;
  var swallowed = false;
  var closest = 30.0;
  var bodyHit = false;
  var foregroundBody = 0.0;
  let h2 = dot(cross(ro,rd),cross(ro,rd));
  let entryB = dot(ro, rd);
  let discriminant = entryB*entryB - dot(ro,ro) + 225.0;
  let entryDistance = select(80.0,max(0.0,-entryB-sqrt(max(0.0,discriminant))),discriminant>0.0);
  let entryBody = qSceneBodies(ro,rd,entryDistance,time,bodies);
  if(entryBody.a>=0.0) {
    pos=ro+rd*entryBody.a;
    emission+=entryBody.rgb*bodies.x;
    transmit*=1.0-bodies.x;
    bodyHit=true; foregroundBody=bodies.x;
  }
  if (discriminant > 0.0 && !bodyHit) {
    pos += rd * entryDistance;
    for (var i = 0; i < 96; i++) {
      let r = length(pos);
      closest = min(closest, r);
      if (r < 1.02 * optics.x) { swallowed = true; break; }
      if (r > 15.2 && dot(pos,rd) > 0.0) { break; }
      let stepLength = clamp(r * 0.115, 0.075, 1.0);
      let force = qGravity(pos,h2,optics.x);
      // Velocity Verlet preserves the critical orbit without normalization drift.
      var nextPosition = pos + rd * stepLength + force * (0.5*stepLength*stepLength);
      let segmentLength=length(nextPosition-pos);
      let segmentDirection=(nextPosition-pos)/max(0.00001,segmentLength);
      let body=qSceneBodies(pos,segmentDirection,segmentLength,time,bodies);
      if(body.a>=0.0) { nextPosition=pos+segmentDirection*body.a; }
      let actualLength=length(nextPosition-pos);
      // Bounded volume integration makes the helices remain 3D when orbiting.
      let plasma=(qJetVolume(mix(pos,nextPosition,0.2113),time,jets,2.60*optics.x*1.08)
        +qJetVolume(mix(pos,nextPosition,0.7887),time,jets,2.60*optics.x*1.08))*0.5;
      emission+=plasma*actualLength*transmit;
      let nextRadius = max(0.2,length(nextPosition));
      let nextRadius2 = nextRadius*nextRadius;
      let nextForce = qGravity(nextPosition,h2,optics.x);
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
          // Two broad advecting arms and hot patches make rotation legible.
          // A persistent density-wave pattern stays broad through long playback;
          // differential material motion still supplies the finer filaments.
          let macroAngle = angle + time*disk.x*0.34;
          let spiralPhase = macroAngle*2.0 - log(radius)*4.6;
          let arm = pow(0.5+0.5*cos(spiralPhase),4.0);
          let knot = pow(0.5+0.5*cos((angle+time*disk.x*0.51)*3.0 + radius*0.75),10.0);
          let largeFlow = 0.22 + 1.65*arm + 0.65*knot;
          let textureDetail = mix(0.82, lanes, disk.y) * mix(1.0,largeFlow,bodies.w);
          let innerEdge = smoothstep(1.72,2.04,radius);
          let outerEdge = 1.0-smoothstep(disk.w*0.65,disk.w,radius);
          let heat = pow(2.05 / max(radius,2.05), 1.55);
          let approaching = clamp(0.5 + 0.5*dot(normalize(vec3f(-hit.z,0.0,hit.x)),normalize(ro-hit)),0.0,1.0);
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
      if(body.a>=0.0) {
        emission+=body.rgb*transmit*bodies.x;
        transmit*=1.0-bodies.x;
        bodyHit=true;
        foregroundBody=select(0.0,bodies.x,dot(pos,ro)>0.0);
        break;
      }
    }
    if (!bodyHit && length(pos) < 3.0) { swallowed = true; }
  }
  if(!bodyHit && !swallowed && discriminant>0.0) {
    let escapingBody=qSceneBodies(pos,normalize(rd),80.0,time,bodies);
    if(escapingBody.a>=0.0) {
      emission+=escapingBody.rgb*transmit*bodies.x;
      transmit*=1.0-bodies.x;
      bodyHit=true;
    }
  }

  // Lensing samples the *input* sky: the shared stars bend with the same ray.
  let skyDirection=normalize(rd);
  let skyUv=fract(vec2f(atan2(skyDirection.x,-skyDirection.z)/6.283185+0.5,
    asin(clamp(skyDirection.y,-1.0,1.0))/3.141593+0.5)*vec2f(3.2,2.0));
  let dims = vec2i(textureDimensions(stars));
  let skyPixel = vec2i(clamp(vec2f(skyUv.x,1.0-skyUv.y),vec2f(0.0),vec2f(0.99999))*vec2f(dims));
  let sky = textureLoad(stars,skyPixel,0).rgb;
  var color = emission + select(sky*transmit,vec3f(0.0),swallowed);

  // A narrow, softly bloomed critical curve strengthens the readable silhouette.
  let impact = sqrt(h2);
  color += qPhotonRing(impact,optics.x,optics.y)*(0.70+0.3*p.x)*(1.0-foregroundBody);

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



`;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'space/accretion-disk',
    label: 'Accretion Disk',
    description: 'Bent-light accretion disk, dark shadow, photon ring and intertwined polar plasma jets.',
    tags: ['space','black-hole','quasar'],
    inputs: {
      image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Starfield', description: 'Background stars to gravitationally distort.' },
      lensing: { type: { kind:'shader-field',version:1,abi:'lux/gravitational-lensing/v1' },label:'Lensing',description:'Shared ray gravity and photon ring.' },
      jets: { type: { kind:'shader-field',version:1,abi:'lux/polar-jets/v1' },label:'Jets',description:'Shared world-space polar plasma.' },
      bodies: { type: { kind:'shader-field',version:1,abi:'lux/orbiting-worlds/v1' },label:'Worlds',description:'World-space orbiting bodies and rocks.' },
      camera: { type: { kind: 'shader-field', version: 1, abi: 'lux/camera-controller/v1' }, label: 'Camera', description: 'Additive manual camera offsets over the authored view.' },
    },
    outputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Quasar', description: 'Linear quasar radiance over the lensed sky.' } },
    controls: {
      zoom: { type:'number',label:'Framing',group:'Camera',default:1,min:0.6,max:1.5,step:0.01 },
      inclination: { type:'number',label:'Disk viewing angle',group:'Camera',default:11.1,min:3,max:65,step:0.1 },
      roll: { type:'number',label:'Composition tilt',group:'Camera',default:-7.5,min:-45,max:45,step:0.1 },
      drift: { type:'number',label:'Slow camera drift',group:'Camera',default:0.2,min:0,max:1,step:0.01 },
      spin: { type:'number',label:'Disk spin',group:'Accretion disk',default:0.44,min:0,max:4,step:0.01 },
      turbulence: { type:'number',label:'Turbulence detail',group:'Accretion disk',default:1,min:0,max:1.5,step:0.01 },
      flowClarity: { type:'number',label:'Large flow structures',group:'Accretion disk',default:0.9,min:0,max:1,step:0.01 },
      heat: { type:'number',label:'Disk radiance',group:'Accretion disk',default:2.55,min:0.1,max:4,step:0.01 },
      radius: { type:'number',label:'Outer disk radius',group:'Accretion disk',default:5.2,min:4,max:10,step:0.1 },
    },
    controlDescriptions: {
      zoom:'Overall framing; higher values bring the quasar closer.',
      inclination:'Degrees above the disk plane. Low angles reveal the lensed arch.',
      roll:'Tilts the entire composition, including both polar jets.',
      drift:'Slow breathing of the viewing angle, with no camera cuts.',
      spin:'Differential disk rotation: the inner material revolves faster.',
      turbulence:'Strength of fine turbulent filaments in the disk.',
      flowClarity:'Broad spiral lanes and hot patches riding with the fine disk texture. Zero restores the fine-only look.',
      heat:'Emission before exposure and highlight bloom.',
      radius:'Outer reach of the feeding disk.',
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
    const bodies = uniform(new Vector4(1,0.35,0.8,0.9));
    const rayOrigin = uniform(new Vector3(0,3,18));
    const rayForward = uniform(new Vector3(0,0,-1));
    const rayRight = uniform(new Vector3(1,0,0));
    const rayUp = uniform(new Vector3(0,1,0));
    const material = new MeshBasicNodeMaterial({ depthTest:false,depthWrite:false,toneMapped:false });
    let acceptedFragments: readonly string[] = [];
    let flowClarity=0.9;
    const mesh = new Mesh(geometry,material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return {
      update(frame) {
        const c=frame.controls;
        view.value.set(context.settings.width/context.settings.height,frame.timeSeconds,c.zoom,
          (c.inclination+Math.sin(frame.timeSeconds*0.065)*c.drift*5)*Math.PI/180);
        disk.value.set(c.spin,c.turbulence,c.heat,c.radius);
        optics.value.w=(c.roll+Math.sin(frame.timeSeconds*0.041)*c.drift*6)*Math.PI/180;
        flowClarity=c.flowClarity;
      },
      async evaluate(inputs,evaluation) {
        background.value = inputs.image.texture as Texture;
        const lens=inputs.lensing.data, plasma=inputs.jets.data, worlds=inputs.bodies.data;
        const fragments=[lens.fragments.shader,plasma.fragments.shader,worlds.fragments.shader];
        if(fragments.some((source,index)=>source!==acceptedFragments[index])) {
          const combined=diskShader+'\n'+fragments.join('\n');
          const quasar=wgslFn(combined);
          material.fragmentNode=quasar(uv(),view,disk,jets,optics,bodies,rayOrigin,rayForward,rayRight,rayUp,background);
          material.needsUpdate=true;
          acceptedFragments=fragments;
        }
        optics.value.x=lens.values.lensing;
        optics.value.y=lens.values.photon;
        jets.value.set(plasma.values.jetPower,plasma.values.jetWidth,plasma.values.jetTwist,plasma.values.jetSpeed);
        bodies.value.set(worlds.values.orbiters,worlds.values.orbitSpeed,worlds.values.beltDensity,flowClarity);
        const inclination=view.value.w, roll=optics.value.w;
        const pose=resolveCameraPose({
          position:[0,Math.sin(inclination)*18,Math.cos(inclination)*18],
          target:[0,0,0],
          up:[-Math.sin(roll),Math.cos(inclination)*Math.cos(roll),-Math.sin(inclination)*Math.cos(roll)],
        },readCameraController(inputs.camera.data),{focusDistance:18,minDistance:3});
        rayOrigin.value.set(...pose.position);
        rayForward.value.set(...pose.forward);
        rayRight.value.set(...pose.right);
        rayUp.value.set(...pose.up);
        return { image: await evaluation.render(scene,camera) };
      },
      reset() {},
      dispose() { geometry.dispose(); material.dispose(); fallback.dispose(); },
    };
  },
});
