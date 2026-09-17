export const ordinarySource=Object.freeze({sdkVersion:'0.2.0',entry:'visual.ts',files:Object.freeze({'visual.ts':`import {defineVisual} from '@lux/visual-sdk';
import {Scene,Mesh,PlaneGeometry,MeshLambertMaterial,OrthographicCamera,AmbientLight} from 'three/webgpu';
export default defineVisual({controls:{},async create(context){
 const material=new MeshLambertMaterial({color:0xff0000,transparent:true,opacity:0.5,depthTest:false,depthWrite:false});material.toneMapped=false;
 const geometry=new PlaneGeometry(2,2),scene=new Scene();scene.add(new AmbientLight(0xffffff,Math.PI));scene.add(new Mesh(geometry,material));
 const camera=new OrthographicCamera(-1,1,1,-1,0,1);
 return {update(){},render(target){return context.renderer.render(scene,camera,target);},reset(){},dispose(){geometry.dispose();material.dispose();}};
}});`})});

export const tslSource=Object.freeze({sdkVersion:'0.2.0',entry:'visual.ts',files:Object.freeze({'visual.ts':`import {defineVisual} from '@lux/visual-sdk';
import {Scene,Mesh,PlaneGeometry,MeshLambertNodeMaterial,OrthographicCamera,AmbientLight} from 'three/webgpu';
import {Fn,If,float,vec3} from 'three/tsl';
export default defineVisual({controls:{},async create(context){
 const color=Fn(()=>{const selected=vec3(0,0,0).toVar();If(float(1).greaterThan(0),()=>{selected.assign(vec3(0,0,1));});return selected;})();
 const material=new MeshLambertNodeMaterial();material.colorNode=color;material.transparent=true;material.opacity=0.25;material.depthTest=false;material.depthWrite=false;material.toneMapped=false;
 const geometry=new PlaneGeometry(2,2),scene=new Scene();scene.add(new AmbientLight(0xffffff,Math.PI));scene.add(new Mesh(geometry,material));const camera=new OrthographicCamera(-1,1,1,-1,0,1);
 return {update(){},render(target){return context.renderer.render(scene,camera,target);},reset(){},dispose(){geometry.dispose();material.dispose();}};
}});`})});
