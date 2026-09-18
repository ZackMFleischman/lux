import { defineComponent } from '@lux/visual-sdk';
import { DataTexture, FloatType, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, RGBAFormat, Scene, Vector4, type Texture } from 'three/webgpu';
import { texture, uniform, uv, wgslFn } from 'three/tsl';

const glow = wgslFn(`
fn quasarBloom(st:vec2f, settings:vec4f, source:texture_2d<f32>) -> vec4f {
  let dims = vec2i(textureDimensions(source));
  let pixel = vec2i(vec2f(st.x,1.0-st.y)*vec2f(dims));
  let base = textureLoad(source,clamp(pixel,vec2i(0),dims-1),0).rgb;
  var bloom=vec3f(0.0);
  for(var i=0;i<12;i++) {
    let a=f32(i)*2.399963;
    let r=sqrt((f32(i)+0.5)/12.0)*settings.y;
    let offset=vec2i(vec2f(cos(a)*r,sin(a)*r));
    let sample=textureLoad(source,clamp(pixel+offset,vec2i(0),dims-1),0).rgb;
    bloom += max(sample-0.55,vec3f(0.0))/12.0;
  }
  let exposed=vec3f(1.0)-pow(max(vec3f(0.0),vec3f(1.0)-base),vec3f(settings.z));
  let color=exposed + bloom*settings.x*0.55;
  return vec4f(color,1.0);
}`);

export default defineComponent({
  metadata: {
    declarationVersion:1,key:'creative/quasar-bloom',label:'Quasar Bloom',
    description:'Restrained highlight bloom with photographic exposure.',tags:['bloom'],
    inputs:{image:{type:{kind:'image',colorSpace:'linear-srgb',alphaMode:'premultiplied'},label:'Radiance',description:'Quasar radiance before bloom and exposure.'}},
    outputs:{image:{type:{kind:'image',colorSpace:'linear-srgb',alphaMode:'premultiplied'},label:'Image',description:'Finished quasar image.'}},
    controls:{
      bloom:{type:'number',label:'Bloom strength',group:'Light',default:0.95,min:0,max:2,step:0.01},
      softness:{type:'number',label:'Bloom radius',group:'Light',default:21,min:2,max:50,step:1},
      exposure:{type:'number',label:'Exposure',group:'Light',default:1.14,min:0.3,max:2.5,step:0.01},
    },
    controlDescriptions:{
      bloom:'Amount of soft light spread from the hottest highlights.',
      softness:'Spread of highlight bloom in output pixels.',
      exposure:'Photographic exposure applied after bloom.',
    },
    lifecycle:{state:'stateless',reset:'seed'},
  },
  async create() {
    const scene=new Scene();
    const camera=new OrthographicCamera(-1,1,1,-1,0,1);
    const geometry=new PlaneGeometry(2,2);
    const fallback=new DataTexture(new Float32Array([0,0,0,1]),1,1,RGBAFormat,FloatType);
    fallback.needsUpdate=true;
    const source=texture(fallback);
    const settings=uniform(new Vector4(0.65,18,1.15,0));
    const material=new MeshBasicNodeMaterial({depthTest:false,depthWrite:false,toneMapped:false});
    material.fragmentNode=glow(uv(),settings,source);
    const mesh=new Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
    return {
      update(frame) { settings.value.set(frame.controls.bloom,frame.controls.softness,frame.controls.exposure,0); },
      async evaluate(inputs,evaluation) { source.value=inputs.image.texture as Texture;return {image:await evaluation.render(scene,camera)}; },
      reset() {},
      dispose() {geometry.dispose();material.dispose();fallback.dispose();},
    };
  },
});
