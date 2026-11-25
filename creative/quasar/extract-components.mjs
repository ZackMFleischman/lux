import fs from 'node:fs';
import path from 'node:path';
const root=import.meta.dirname;
const input=fs.readFileSync(path.join(root,'quasar.ts'),'utf8');
const write=(file,text)=>{const dest=path.join(root,'components',file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,text);};
function field({key,label,description,abi,shader,controls,descriptions,values}) {
  return `import { defineComponent } from '@lux/visual-sdk';

const shader = \`${shader}\`;

export default defineComponent({
  metadata: {
    declarationVersion: 1, key: '${key}', label: '${label}',
    description: '${description}', tags: ['space','shader-field'],
    inputs: {},
    outputs: { field: { type: { kind: 'shader-field', version: 1, abi: '${abi}' }, label: '${label}', description: '${description}' } },
    controls: {
${controls}
    },
    controlDescriptions: {
${descriptions}
    },
    lifecycle: { state:'stateless',reset:'seed' },
  },
  async create() {
    let values=${JSON.stringify(values)};
    return {
      update(frame) { values={...frame.controls}; },
      async evaluate(_inputs,context) {
        return { field:context.shaderField('field',{version:1,abi:'${abi}',fragments:{shader},values}) };
      },
      reset() {}, dispose() {},
    };
  },
});
`;
}
const controlLine=id=>input.match(new RegExp('^      '+id+': \\{.*$','m'))?.[0]??(()=>{throw Error(id)})();
const descriptionLine=id=>input.match(new RegExp('^      '+id+":'.*$",'m'))?.[0]??(()=>{throw Error(id)})();
const lines=ids=>({controls:ids.map(controlLine).join('\n'),descriptions:ids.map(descriptionLine).join('\n')});
const lensShader=`fn qGravity(point:vec3f,angularMomentumSquared:f32,strength:f32) -> vec3f {
  let radius=max(0.2,length(point));
  return -1.5*angularMomentumSquared*point/(radius*radius*radius*radius*radius)*strength;
}
fn qPhotonRing(impact:f32,strength:f32,brightness:f32) -> vec3f {
  let critical=2.60*strength;
  let ring=exp(-pow((impact-critical)/0.075,2.0));
  let halo=exp(-abs(impact-critical)*8.0)*0.10;
  return vec3f(1.0,0.56,0.22)*(ring+halo)*brightness;
}`;
write('lensing/gravitational-lensing.ts',field({key:'space/gravitational-lensing',label:'Gravitational Lensing',description:'Central gravity ray bending and a controllable photon ring for compatible 3D renderers.',abi:'lux/gravitational-lensing/v1',shader:lensShader,...lines(['lensing','photon']),values:{lensing:0.79,photon:1.24}}));
const jetStart=input.indexOf('fn qJetVolume('),bodyStart=input.indexOf('fn qSphereDistance('),shaderEnd=input.indexOf('\n`);',bodyStart);
if(jetStart<0||bodyStart<0||shaderEnd<0)throw Error('Missing shader sections');
const jetShader=input.slice(jetStart,bodyStart).replace('gravity:f32','launchRadius:f32').replace('axisDistance-2.60*gravity*1.08','axisDistance-launchRadius');
write('jets/polar-jets.ts',field({key:'space/polar-jets',label:'Polar Jets',description:'World-space helical plasma outflow, usable around a caller-selected local axis and launch radius.',abi:'lux/polar-jets/v1',shader:jetShader,...lines(['jetPower','jetWidth','jetTwist','jetSpeed']),values:{jetPower:3.25,jetWidth:0.58,jetTwist:1.11,jetSpeed:0.44}}));
let bodyShader=input.slice(bodyStart,shaderEnd);
const noiseStart=input.indexOf('fn qHash('),noiseEnd=input.indexOf('// All bodies',noiseStart);
bodyShader=input.slice(noiseStart,noiseEnd)+bodyShader;
bodyShader=bodyShader.replaceAll('qHash','orbitHash').replaceAll('qNoise','orbitNoise');
write('planets/orbiting-worlds.ts',field({key:'space/orbiting-worlds',label:'Orbiting Worlds',description:'Three shaded worlds, a planetary ring and a sparse rock belt intersected in world space.',abi:'lux/orbiting-worlds/v1',shader:bodyShader,...lines(['orbiters','orbitSpeed','beltDensity']),values:{orbiters:1,orbitSpeed:0.35,beltDensity:0.8}}));
let core=input.slice(0,jetStart)+input.slice(shaderEnd);
core=core.replace(/\/\/ All bodies occupy world space[^]*?\/\/ No foreground\/background copies or depth crossfade\.\n/,'');
core=core.replace('const quasar = wgslFn(`','const diskShader = `').replace('\n`);','\n`;');
core=core.replaceAll('time,jets,optics.x)','time,jets,2.60*optics.x*1.08)');
core=core.replace('const r = length(pos);','const r = length(pos);');
core=core.replace('let force = -1.5 * h2 * pos / max(0.01, r*r*r*r*r) * optics.x;','let force = qGravity(pos,h2,optics.x);');
core=core.replace('let nextForce = -1.5*h2*nextPosition / (nextRadius2*nextRadius2*nextRadius) * optics.x;','let nextForce = qGravity(nextPosition,h2,optics.x);');
core=core.replace(`  let critical = 2.60 * optics.x;
  let ring = exp(-pow((impact-critical)/0.075,2.0));
  let ringHalo = exp(-abs(impact-critical)*8.0)*0.10;
  color += vec3f(1.0,0.56,0.22)*(ring+ringHalo)*optics.y*(0.70+0.3*p.x)*(1.0-foregroundBody);`, `  color += qPhotonRing(impact,optics.x,optics.y)*(0.70+0.3*p.x)*(1.0-foregroundBody);`);
core=core.replace("key: 'creative/feeding-quasar'","key: 'space/accretion-disk'").replace("label: 'Feeding Quasar'","label: 'Accretion Disk'");
core=core.replace("      camera: { type:",`      lensing: { type: { kind:'shader-field',version:1,abi:'lux/gravitational-lensing/v1' },label:'Lensing',description:'Shared ray gravity and photon ring.' },
      jets: { type: { kind:'shader-field',version:1,abi:'lux/polar-jets/v1' },label:'Jets',description:'Shared world-space polar plasma.' },
      bodies: { type: { kind:'shader-field',version:1,abi:'lux/orbiting-worlds/v1' },label:'Worlds',description:'World-space orbiting bodies and rocks.' },
      camera: { type:`);
for(const id of ['lensing','photon','jetPower','jetWidth','jetTwist','jetSpeed','orbiters','orbitSpeed','beltDensity']) {
  core=core.replace(new RegExp('^      '+id+': \\{.*\\r?\\n','m'),'');
  core=core.replace(new RegExp('^      '+id+":'.*\\r?\\n",'m'),'');
}
core=core.replace('    material.fragmentNode = quasar(uv(),view,disk,jets,optics,bodies,rayOrigin,rayForward,rayRight,rayUp,background);','    let acceptedShader: string | undefined;\n    let flowClarity=0.9;');
core=core.replace('        jets.value.set(c.jetPower,c.jetWidth,c.jetTwist,c.jetSpeed);\n','');
core=core.replace('        optics.value.set(c.lensing,c.photon,0,(c.roll+Math.sin(frame.timeSeconds*0.041)*c.drift*6)*Math.PI/180);', '        optics.value.w=(c.roll+Math.sin(frame.timeSeconds*0.041)*c.drift*6)*Math.PI/180;');
core=core.replace('        bodies.value.set(c.orbiters,c.orbitSpeed,c.beltDensity,c.flowClarity);','        flowClarity=c.flowClarity;');
core=core.replace('        background.value = inputs.image.texture as Texture;',`        background.value = inputs.image.texture as Texture;
        const lens=inputs.lensing.data, plasma=inputs.jets.data, worlds=inputs.bodies.data;
        const combined=diskShader+'\\n'+lens.fragments.shader+'\\n'+plasma.fragments.shader+'\\n'+worlds.fragments.shader;
        if(combined!==acceptedShader) {
          const quasar=wgslFn(combined);
          material.fragmentNode=quasar(uv(),view,disk,jets,optics,bodies,rayOrigin,rayForward,rayRight,rayUp,background);
          material.needsUpdate=true;
          acceptedShader=combined;
        }
        optics.value.x=lens.values.lensing;
        optics.value.y=lens.values.photon;
        jets.value.set(plasma.values.jetPower,plasma.values.jetWidth,plasma.values.jetTwist,plasma.values.jetSpeed);
        bodies.value.set(worlds.values.orbiters,worlds.values.orbitSpeed,worlds.values.beltDensity,flowClarity);`);
write('quasar/accretion-disk.ts',core);
write('bloom/quasar-bloom.ts',fs.readFileSync(path.join(root,'bloom.ts'),'utf8'));
console.log('Extracted functional lensing, jets, worlds, accretion renderer and bloom');
