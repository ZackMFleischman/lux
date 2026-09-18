import { defineComponent } from '@lux/visual-sdk';

const shader = `fn qGravity(point:vec3f,angularMomentumSquared:f32,strength:f32) -> vec3f {
  let radius=max(0.2,length(point));
  return -1.5*angularMomentumSquared*point/(radius*radius*radius*radius*radius)*strength;
}
fn qPhotonRing(impact:f32,strength:f32,brightness:f32) -> vec3f {
  let critical=2.60*strength;
  let ring=exp(-pow((impact-critical)/0.075,2.0));
  let halo=exp(-abs(impact-critical)*8.0)*0.10;
  return vec3f(1.0,0.56,0.22)*(ring+halo)*brightness;
}`;

export default defineComponent({
  metadata: {
    declarationVersion: 1, key: 'space/gravitational-lensing', label: 'Gravitational Lensing',
    description: 'Central gravity ray bending and a controllable photon ring for compatible 3D renderers.', tags: ['space','shader-field'],
    inputs: {},
    outputs: { field: { type: { kind: 'shader-field', version: 1, abi: 'lux/gravitational-lensing/v1' }, label: 'Gravitational Lensing', description: 'Central gravity ray bending and a controllable photon ring for compatible 3D renderers.' } },
    controls: {
      lensing: { type:'number',label:'Light bending',group:'Lensing',default:0.8,min:0.4,max:1.4,step:0.01 },
      photon: { type:'number',label:'Photon ring',group:'Lensing',default:1.24,min:0,max:3,step:0.01 },
    },
    controlDescriptions: {
      lensing:'Artistic strength of the approximate gravitational bending.',
      photon:'Brightness of the thin ring tracing the shadow.',
    },
    lifecycle: { state:'stateless',reset:'seed' },
  },
  async create() {
    let values={"lensing":0.79,"photon":1.24};
    return {
      update(frame) { values={...frame.controls}; },
      async evaluate(_inputs,context) {
        return { field:context.shaderField('field',{version:1,abi:'lux/gravitational-lensing/v1',fragments:{shader},values}) };
      },
      reset() {}, dispose() {},
    };
  },
});
