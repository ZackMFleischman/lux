import * as THREE from '../../../node_modules/three/build/three.webgpu.js';
const { Fn, If, uniform, uv, vec3, vec4, float, floor, pow, screenCoordinate } = THREE.TSL;
let intensity=uniform(0.65);
self.onmessage=async({data})=>{
  if(data.intensity!==undefined){intensity.value=data.intensity;return;}
  try {
    const renderer=new THREE.WebGPURenderer({canvas:data.canvas,alpha:true,antialias:false,forceWebGL:false});
    renderer.setSize(1920,1080,false);
    await renderer.init();
    if(!renderer.backend.isWebGPUBackend)throw Error('WebGPU backend required');
    const frame=uniform(0);
    const material=new THREE.MeshBasicNodeMaterial({transparent:true,depthTest:false,depthWrite:false});
    material.fragmentNode=Fn(()=>{
      const p=uv();
      const color=vec3(p,intensity).toVar();
      const alpha=float(1).toVar();
      If(p.x.lessThan(.2).and(p.y.greaterThan(.8)),()=>color.assign(vec3(1,0,0)));
      If(p.x.greaterThan(.8).and(p.y.greaterThan(.8)),()=>color.assign(vec3(0,1,0)));
      If(p.x.lessThan(.2).and(p.y.lessThan(.2)),()=>color.assign(vec3(0,0,1)));
      If(p.x.greaterThan(.8).and(p.y.lessThan(.2)),()=>color.assign(vec3(1,1,0)));
      If(p.y.greaterThan(.4).and(p.y.lessThan(.6)),()=>{alpha.assign(floor(p.x.mul(4)).div(3));color.assign(vec3(intensity,.3,.6));});
      If(screenCoordinate.y.lessThan(16),()=>{color.assign(vec3(floor(frame.div(pow(2,floor(screenCoordinate.x.div(64))))).mod(2)));alpha.assign(1);});
      return vec4(color,alpha);
    })();
    const scene=new THREE.Scene();scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
    const camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    self.postMessage({kind:'webgpu',three:THREE.REVISION,backend:'WebGPU',width:1920,height:1080});
    renderer.setAnimationLoop(()=>{frame.value++;renderer.render(scene,camera);if(frame.value<=3)self.postMessage({kind:'submitted',frame:frame.value});});
  }catch(error){self.postMessage({kind:'failure',reason:String(error)});}
};

