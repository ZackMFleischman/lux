import { defineComponent } from '@lux/visual-sdk';

const shader = `fn qJetVolume(point:vec3f,time:f32,jets:vec4f,launchRadius:f32) -> vec3f {
  let axisDistance=abs(point.y);
  let height=axisDistance-launchRadius;
  if(height<0.0 || axisDistance>14.5) { return vec3f(0.0); }
  let width=jets.y*(0.16+height*0.13);
  let radial=length(point.xz);
  if(radial>width*3.0) { return vec3f(0.0); }
  let envelope=exp(-pow(radial/(width*1.4+0.001),2.0))*0.19;
  var plasma=envelope;
  for(var strand=0;strand<3;strand++) {
    let phase=height*jets.z*2.7-time*jets.w*2.2+f32(strand)*2.094395;
    let center=vec2f(sin(phase),cos(phase))*width*0.76;
    let distance=length(point.xz-center);
    let thickness=max(0.04,width*0.17);
    plasma+=exp(-pow(distance/thickness,2.0))*2.3
      +exp(-distance/(thickness*3.0))*0.10;
  }
  let knots=pow(0.5+0.5*sin(height*4.5-time*jets.w*3.0),8.0);
  let fade=smoothstep(0.0,0.85,height)*exp(-height*0.22)*(1.0-smoothstep(12.0,14.5,axisDistance));
  let color=mix(vec3f(0.19,0.62,1.0),vec3f(0.58,0.20,1.0),clamp(height*0.075,0.0,1.0));
  return color*plasma*fade*jets.x*(0.8+knots*0.45);
}
`;

export default defineComponent({
  metadata: {
    declarationVersion: 1, key: 'space/polar-jets', label: 'Polar Jets',
    description: 'World-space helical plasma outflow, usable around a caller-selected local axis and launch radius.', tags: ['space','shader-field'],
    inputs: {},
    outputs: { field: { type: { kind: 'shader-field', version: 1, abi: 'lux/polar-jets/v1' }, label: 'Polar Jets', description: 'World-space helical plasma outflow, usable around a caller-selected local axis and launch radius.' } },
    controls: {
      jetPower: { type:'number',label:'Jet radiance',group:'Polar jets',default:3.63,min:0,max:4,step:0.01 },
      jetWidth: { type:'number',label:'Jet width',group:'Polar jets',default:0.39,min:0.3,max:2.5,step:0.01 },
      jetTwist: { type:'number',label:'Helix turns',group:'Polar jets',default:0.59,min:0.2,max:2,step:0.01 },
      jetSpeed: { type:'number',label:'Outflow speed',group:'Polar jets',default:0.28,min:0,max:4,step:0.01 },
    },
    controlDescriptions: {
      jetPower:'Emission of the cool polar plasma.',
      jetWidth:'Width of the expanding jet envelope and its filaments.',
      jetTwist:'Number of turns in the intertwined polar helices.',
      jetSpeed:'Outward travel speed of jet filaments and knots.',
    },
    lifecycle: { state:'stateless',reset:'seed' },
  },
  async create() {
    let values={"jetPower":3.25,"jetWidth":0.58,"jetTwist":1.11,"jetSpeed":0.44};
    return {
      update(frame) { values={...frame.controls}; },
      async evaluate(_inputs,context) {
        return { field:context.shaderField('field',{version:1,abi:'lux/polar-jets/v1',fragments:{shader},values}) };
      },
      reset() {}, dispose() {},
    };
  },
});
