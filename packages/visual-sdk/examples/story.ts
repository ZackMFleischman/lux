import {defineVisual} from '@lux/visual-sdk';
import {Scene,Mesh,PlaneGeometry,MeshBasicNodeMaterial,OrthographicCamera} from 'three/webgpu';
import {uniform,vec4} from 'three/tsl';

export default defineVisual({
  controls:{brightness:{type:'number',label:'Brightness',default:0.7,min:0,max:1}},
  story:{version:1,beats:{arrival:{kind:'timed',seek:'direct'},orbit:{kind:'sustained',seek:'none'}}},
  async create(context){
    const level=uniform(0.7),material=new MeshBasicNodeMaterial();
    material.fragmentNode=vec4(level,0.25,0.85,1);
    const geometry=new PlaneGeometry(0.7,0.7),shape=new Mesh(geometry,material);
    const scene=new Scene();scene.add(shape);
    const camera=new OrthographicCamera(-1,1,1,-1,0,1);
    return {
      update(frame){
        level.value=frame.controls.brightness;
        // Ambient spin remains live while Story is paused or manually held.
        shape.rotation.z=frame.timeSeconds*0.3;
        shape.position.set(0,0,0);
        shape.scale.setScalar(1);
        if(frame.story.state==='active'){
          if(frame.story.beatId==='arrival'){
            // Direct pose: seeking never depends on an earlier frame.
            shape.position.x=1.6*(1-(frame.story.progress??0));
          }else if(frame.story.beatId==='orbit'){
            shape.position.x=Math.cos(frame.timeSeconds)*0.45;
            shape.position.y=Math.sin(frame.timeSeconds)*0.45;
          }
        }
      },
      render(target){return context.renderer.render(scene,camera,target);},
      reset(){shape.position.set(0,0,0);shape.rotation.z=0;},
      dispose(){geometry.dispose();material.dispose();},
    };
  },
});
