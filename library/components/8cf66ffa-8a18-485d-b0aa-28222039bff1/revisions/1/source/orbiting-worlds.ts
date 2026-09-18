import { defineComponent } from '@lux/visual-sdk';

const shader = `fn orbitHash(p: vec2f) -> f32 {
  return fract(sin(dot(p,vec2f(127.1,311.7)))*43758.5453);
}
fn orbitNoise(p: vec2f) -> f32 {
  let i=floor(p); let f=fract(p); let u=f*f*(3.0-2.0*f);
  return mix(mix(orbitHash(i),orbitHash(i+vec2f(1.0,0.0)),u.x),
    mix(orbitHash(i+vec2f(0.0,1.0)),orbitHash(i+vec2f(1.0,1.0)),u.x),u.y);
}


fn qSphereDistance(ro:vec3f,rd:vec3f,center:vec3f,radius:f32,limit:f32) -> f32 {
  let offset=ro-center;
  let b=dot(offset,rd);
  let discriminant=b*b-dot(offset,offset)+radius*radius;
  if(discriminant<0.0) { return -1.0; }
  let entry=-b-sqrt(discriminant);
  if(entry<0.0001 || entry>limit) { return -1.0; }
  return entry;
}
fn qSceneBodies(ro:vec3f,rd:vec3f,limit:f32,time:f32,settings:vec4f) -> vec4f {
  if(settings.x<0.001 || limit<0.0001) { return vec4f(0.0,0.0,0.0,-1.0); }
  let segmentEnd=ro+rd*limit;
  if(max(length(ro),length(segmentEnd))<7.4) { return vec4f(0.0,0.0,0.0,-1.0); }
  let nearestToOrigin=ro+rd*clamp(-dot(ro,rd),0.0,limit);
  if(length(nearestToOrigin)>14.0) { return vec4f(0.0,0.0,0.0,-1.0); }
  var nearest=limit;
  var color=vec3f(0.0);
  var found=false;
  for(var i=0;i<3;i++) {
    let id=f32(i);
    let orbit=8.5+id*2.0;
    let phase=time*settings.y*(0.34-id*0.045)+select(select(0.50,4.08,i==1),2.30,i==2);
    let center=vec3f(cos(phase)*orbit,sin(phase)*id*0.25,sin(phase)*orbit);
    let radius=select(select(0.55,0.48,i==1),0.38,i==2);
    let hit=qSphereDistance(ro,rd,center,radius,nearest);
    if(hit>=0.0) {
      let normal=normalize(ro+rd*hit-center);
      let light=max(0.0,dot(normal,normalize(-center)));
      let longitude=atan2(normal.z,normal.x)+time*0.12;
      let band=0.72+0.28*sin(normal.y*17.0+orbitNoise(vec2f(normal.y*4.0,sin(longitude)*2.0))*2.7);
      let pigment=select(select(vec3f(0.13,0.53,0.65),vec3f(0.71,0.28,0.095),i==1),vec3f(0.42,0.32,0.57),i==2);
      let rim=pow(1.0-max(0.0,dot(normal,-rd)),3.0)*light*0.35;
      color=pigment*(0.09+light*1.65)*band+vec3f(0.17,0.42,0.57)*rim;
      nearest=hit; found=true;
    }
    if(i==1) {
      let ringNormal=normalize(vec3f(0.12,1.0,0.28));
      let denominator=dot(rd,ringNormal);
      if(abs(denominator)>0.0001) {
        let distance=dot(center-ro,ringNormal)/denominator;
        let point=ro+rd*distance-center;
        let radiusInRing=length(point)/radius;
        if(distance>0.0001 && distance<nearest && radiusInRing>1.35 && radiusInRing<2.30) {
          let gap=smoothstep(1.78,1.81,radiusInRing)*(1.0-smoothstep(1.87,1.90,radiusInRing));
          let stripe=0.68+0.32*sin(radiusInRing*92.0);
          color=vec3f(0.62,0.36,0.16)*stripe*(1.0-gap*0.75);
          nearest=distance; found=true;
        }
      }
    }
  }
  // Belt tests run only for ray segments within one rock radius of its plane.
  if(min(ro.y,segmentEnd.y)<0.10 && max(ro.y,segmentEnd.y)>-0.10) {
    for(var i=0;i<64;i++) {
      let id=f32(i);
      if(id>=settings.z*64.0) { break; }
      let seed=orbitHash(vec2f(id,8.3));
      let phase=id*2.399963+time*settings.y*(0.17+seed*0.07);
      let orbit=8.1+seed*5.7;
      let center=vec3f(cos(phase)*orbit,0.0,sin(phase)*orbit);
      let radius=0.025+orbitHash(vec2f(id,3.2))*0.045;
      let hit=qSphereDistance(ro,rd,center,radius,nearest);
      if(hit>=0.0) {
        let normal=normalize(ro+rd*hit-center);
        let light=0.12+max(0.0,dot(normal,normalize(-center)))*1.1;
        color=mix(vec3f(0.20,0.24,0.29),vec3f(0.46,0.31,0.18),seed)*light;
        nearest=hit; found=true;
      }
    }
  }
  return vec4f(color,select(-1.0,nearest,found));
}
`;

export default defineComponent({
  metadata: {
    declarationVersion: 1, key: 'space/orbiting-worlds', label: 'Orbiting Worlds',
    description: 'Three shaded worlds, a planetary ring and a sparse rock belt intersected in world space.', tags: ['space','shader-field'],
    inputs: {},
    outputs: { field: { type: { kind: 'shader-field', version: 1, abi: 'lux/orbiting-worlds/v1' }, label: 'Orbiting Worlds', description: 'Three shaded worlds, a planetary ring and a sparse rock belt intersected in world space.' } },
    controls: {
      orbiters: { type:'number',label:'Orbiting worlds',group:'Lensing demo',default:1,min:0,max:1,step:0.01 },
      orbitSpeed: { type:'number',label:'Orbital speed',group:'Lensing demo',default:0.35,min:0,max:1.5,step:0.01 },
      beltDensity: { type:'number',label:'Asteroid belt density',group:'Lensing demo',default:0.8,min:0,max:1,step:0.01 },
    },
    controlDescriptions: {
      orbiters:'Visibility of the orbiting worlds and debris used to demonstrate lensing.',
      orbitSpeed:'Speed of the independent demonstration orbits.',
      beltDensity:'Number of small rocks in the surrounding belt.',
    },
    lifecycle: { state:'stateless',reset:'seed' },
  },
  async create() {
    let values={"orbiters":1,"orbitSpeed":0.35,"beltDensity":0.8};
    return {
      update(frame) { values={...frame.controls}; },
      async evaluate(_inputs,context) {
        return { field:context.shaderField('field',{version:1,abi:'lux/orbiting-worlds/v1',fragments:{shader},values}) };
      },
      reset() {}, dispose() {},
    };
  },
});
