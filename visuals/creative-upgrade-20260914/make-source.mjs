import {writeFile} from 'node:fs/promises';
const image="{type:{kind:'image',colorSpace:'linear-srgb',alphaMode:'premultiplied'},label:'Image',description:'Linear light image'}";
const source=`import {defineComponent} from '@lux/visual-sdk';
import {Scene,PerspectiveCamera,Color} from 'three/webgpu';
import {makeInstrument} from './parts/instrument.ts';
export default defineComponent({metadata:{declarationVersion:1,key:'observatory/orbital-instrument',label:'Orbital instrument',description:'Nested armillary rings, orbiting satellites and a luminous crystalline heart.',tags:['space','generative'],inputs:{},outputs:{image:${image}},controls:{speed:{type:'number',label:'Orbit speed',default:0.35,min:0,max:2,step:0.01},spread:{type:'number',label:'Ring expansion',default:1,min:0.6,max:1.5,step:0.01},twist:{type:'number',label:'Gimbal tilt',default:0.65,min:0,max:1.5,step:0.01},hue:{type:'number',label:'Spectrum',default:0.53,min:0,max:1,step:0.01}},controlDescriptions:{speed:'Speed of the nested orbital assemblies. Zero freezes orbital rotation.',spread:'Radius of the orbital rings around the crystalline core.',twist:'Inclination of each nested gimbal assembly.',hue:'Base hue of the instrument, offset around each orbital assembly.'},lifecycle:{state:'stateful',reset:'seed'}},async create(context){
 const scene=new Scene();scene.background=new Color(0.001,0.002,0.009);
 const camera=new PerspectiveCamera(38,context.settings.width/context.settings.height,0.1,100);camera.position.set(0,0,8);
 const instrument=makeInstrument();scene.add(instrument.root);
 return {update(frame){instrument.update(frame.timeSeconds,frame.controls.speed,frame.controls.spread,frame.controls.twist,frame.controls.hue);},async evaluate(_inputs,evaluation){return {image:await evaluation.render(scene,camera)}},reset(){},dispose(){instrument.dispose()}};
}});`;
const helper=`import {Group,Mesh,TorusGeometry,IcosahedronGeometry,SphereGeometry,MeshBasicNodeMaterial,Color,BufferGeometry,Float32BufferAttribute,Points,PointsMaterial,AdditiveBlending} from 'three/webgpu';
export function makeInstrument(){
 const root=new Group();const assemblies:Group[]=[];const halos:Mesh[]=[];const mats:MeshBasicNodeMaterial[]=[];
 const ringGeo=new TorusGeometry(1,0.007,6,192);const beadGeo=new SphereGeometry(0.036,10,8);const coreGeo=new IcosahedronGeometry(0.48,1);
 const coreMat=new MeshBasicNodeMaterial({color:0xb2faff,wireframe:true});const core=new Mesh(coreGeo,coreMat);root.add(core);
 for(let i=0;i<9;i++){
  const assembly=new Group();const orbit=new Group();assembly.add(orbit);root.add(assembly);assemblies.push(assembly);
  const mat=new MeshBasicNodeMaterial({color:new Color().setHSL(0.52+i*0.043,0.85,0.6)});mats.push(mat);
  const ring=new Mesh(ringGeo,mat);const r=0.82+i*0.14;ring.scale.setScalar(r);orbit.add(ring);
  for(let j=0;j<3;j++){const bead=new Mesh(beadGeo,mat);const a=j*Math.PI*2/3;bead.position.set(Math.cos(a)*r,Math.sin(a)*r,0);orbit.add(bead);}
 }
 const haloMat=new MeshBasicNodeMaterial({color:0x245969,transparent:true,opacity:0.48});
 for(let i=0;i<4;i++){const halo=new Mesh(ringGeo,haloMat);halo.scale.setScalar(2.03+i*0.045);root.add(halo);halos.push(halo);}
 const stars:number[]=[];for(let i=0;i<650;i++){const a=i*2.39996323;const r=1.5+Math.sqrt(i/650)*7;stars.push(Math.cos(a)*r,Math.sin(a)*r,-2-(i%7)*0.1);}
 const starGeo=new BufferGeometry();starGeo.setAttribute('position',new Float32BufferAttribute(stars,3));const starMat=new PointsMaterial({color:0x5695ad,size:0.012,transparent:true,opacity:0.65,blending:AdditiveBlending});root.add(new Points(starGeo,starMat));
 return {root,update(t:number,speed:number,spread:number,twist:number,hue:number){root.rotation.z=0.05*Math.sin(t*0.12);core.rotation.set(t*speed*0.6,t*speed*0.4,t*0.1);core.scale.setScalar(1+0.08*Math.sin(t*1.6));assemblies.forEach((g,i)=>{g.rotation.set(twist*Math.sin(i*1.2+t*speed*0.31),twist*Math.cos(i*0.7+t*speed*0.27),i*0.43+t*speed*(i%2?1:-1)*0.3);g.children[0].rotation.z=t*speed*(1+i*0.07);g.scale.setScalar(spread);mats[i].color.setHSL((hue+i*0.044)%1,0.8,0.57);});halos.forEach((h,i)=>{h.rotation.x=0.07*Math.sin(t*0.2+i);});},dispose(){ringGeo.dispose();beadGeo.dispose();coreGeo.dispose();coreMat.dispose();mats.forEach(m=>m.dispose());haloMat.dispose();starGeo.dispose();starMat.dispose();}};
}`;
const effect=`import {defineComponent} from '@lux/visual-sdk';
import {Scene,Mesh,PlaneGeometry,MeshBasicNodeMaterial,OrthographicCamera,Texture} from 'three/webgpu';
import {texture,uv,vec2,vec4,uniform} from 'three/tsl';
export default defineComponent({metadata:{declarationVersion:1,key:'observatory/prism',label:'Prism lens',description:'Reusable image lens. Each instance has independent spectral split and halo controls.',tags:['effect'],inputs:{image:${image}},outputs:{image:${image}},controls:{split:{type:'number',label:'Spectral split',default:0.002,min:0,max:0.03,step:0.001},glow:{type:'number',label:'Halo strength',default:0.45,min:0,max:1.5,step:0.01},radius:{type:'number',label:'Halo radius',default:0.004,min:0.001,max:0.025,step:0.001}},controlDescriptions:{split:'Separates red and blue channels across the image. This instance is independent of the other lens.',glow:'Adds a soft four-direction light halo.',radius:'Distance used to spread the halo around bright lines.'},lifecycle:{state:'stateful',reset:'seed'}},async create(){
 const scene=new Scene();const camera=new OrthographicCamera(-1,1,1,-1,0,1);const geometry=new PlaneGeometry(2,2);const material=new MeshBasicNodeMaterial();const placeholder=new Texture();const map=texture(placeholder);const split=uniform(0.002),glow=uniform(0.45),radius=uniform(0.004);const p=uv();
 const rgb=vec4(map.sample(p.add(vec2(split,0))).r,map.sample(p).g,map.sample(p.sub(vec2(split,0))).b,1);
 const halo=map.sample(p.add(vec2(radius,0))).rgb.add(map.sample(p.sub(vec2(radius,0))).rgb).add(map.sample(p.add(vec2(0,radius))).rgb).add(map.sample(p.sub(vec2(0,radius))).rgb).mul(glow.mul(0.25));
 material.fragmentNode=vec4(rgb.rgb.add(halo),1);scene.add(new Mesh(geometry,material));
 return {update(frame){split.value=frame.controls.split;glow.value=frame.controls.glow;radius.value=frame.controls.radius;},async evaluate(inputs,evaluation){map.value=inputs.image.texture as Texture;return {image:await evaluation.render(scene,camera)}},reset(){},dispose(){geometry.dispose();material.dispose();placeholder.dispose();}};
}});`;
await writeFile(new URL('./library-create.json',import.meta.url),JSON.stringify({name:'Prismatic Observatory',description:'Reusable nested orbital instrument: nine gyroscopic rings, satellites, a crystal heart and a star field. Controls for motion, expansion, inclination and palette.',source:{sdkVersion:'0.4.0',entry:'instrument.ts',files:{'instrument.ts':source,'parts/instrument.ts':helper}}},null,2));
await writeFile(new URL('./prism.ts',import.meta.url),effect);

