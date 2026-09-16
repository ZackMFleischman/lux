import {Group,Mesh,TorusGeometry,IcosahedronGeometry,SphereGeometry,MeshBasicNodeMaterial,Color,BufferGeometry,Float32BufferAttribute,Points,PointsMaterial,AdditiveBlending} from 'three/webgpu';
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
}