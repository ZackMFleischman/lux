import {defineVisual} from '@lux/visual-sdk';
import {Scene,Mesh,PlaneGeometry,MeshBasicNodeMaterial,OrthographicCamera} from 'three/webgpu';
import {uniform,vec4} from 'three/tsl';

export default defineVisual({
  controls:{
    brightness:{type:'number',label:'Brightness',default:0.7,min:0,max:1},
    turn:{type:'trigger',label:'Turn quarter',description:'Rotate the tile once, including while paused.'},
  },
  async create(context){
    const level=uniform(0.7),material=new MeshBasicNodeMaterial();
    material.fragmentNode=vec4(level,0.25,0.85,1);
    const geometry=new PlaneGeometry(1.2,0.7),shape=new Mesh(geometry,material);
    const scene=new Scene();scene.add(shape);
    const camera=new OrthographicCamera(-1,1,1,-1,0,1);
    return {
      update(frame){
        level.value=frame.controls.brightness;
        for(const event of frame.events)if(event.controlId==='turn')shape.rotation.z+=Math.PI/2;
      },
      render(target){return context.renderer.render(scene,camera,target);},
      reset(){shape.rotation.z=0;},
      dispose(){geometry.dispose();material.dispose();},
    };
  },
});
