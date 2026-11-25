import fs from 'node:fs';
import path from 'node:path';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';
const here=import.meta.dirname;
const build=JSON.parse(fs.readFileSync(path.join(here,'organized-build.json'),'utf8'));
const definitions={starfield:'starfield/starfield.ts',camera:'quasar/camera-controller/camera-controller.ts',lensing:'quasar/lensing/gravitational-lensing.ts',jets:'quasar/jets/polar-jets.ts',disk:'quasar/accretion-disk.ts',bloom:'quasar/bloom/quasar-bloom.ts',planets:'planets/orbiting-worlds.ts'};
const names=Object.keys(definitions);
const nodeId=name=>`00000000-0000-4000-8000-${String(names.indexOf(name)+1).padStart(12,'0')}`;
const routes=[['starfield','image','disk','image'],['camera','camera','disk','camera'],['lensing','field','disk','lensing'],['jets','field','disk','jets'],['planets','field','disk','bodies'],['disk','image','bloom','image']];
const exposed={starfield:['starlight','featureStarDensity','featureStarScale','featureStarVariance','featureStarOpacity','twinkle'],disk:['zoom','inclination','roll','drift','spin','turbulence','flowClarity','heat','radius'],lensing:['lensing','photon'],jets:['jetPower','jetWidth','jetTwist','jetSpeed'],planets:['orbiters','orbitSpeed','beltDensity'],bloom:['bloom','softness','exposure'],camera:['yaw','pitch','panX','panY','dolly','roll']};
const expose=Object.entries(exposed).flatMap(([name,ids])=>ids.map(controlId=>({id:name==='camera'?'camera'+controlId[0].toUpperCase()+controlId.slice(1):controlId,nodeId:nodeId(name),controlId})));
const source={...build.source,entry:'ingredients.ts',files:{...build.source.files}};
// CPU validation of the same leaves on the current SDK; named nested inputs are
// separately exercised when that compatible authoring extension lands.
delete source.files['scene.ts']; delete source.files['quasar/quasar.ts'];
source.files['ingredients.ts']=`import {defineVisual} from '@lux/visual-sdk';\n`+
Object.entries(definitions).map(([id,file])=>`import ${id} from './${file}';`).join('\n')+
`\nexport default defineVisual({definitions:{${names.join(',')}},nodes:${JSON.stringify(names.map(name=>({id:nodeId(name),definition:name})))},edges:${JSON.stringify(routes.map(([from,output,to,input],i)=>({id:`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,from:{nodeId:nodeId(from),portId:output},to:{nodeId:nodeId(to),portId:input},delay:'none'})))},output:{nodeId:'${nodeId('bloom')}',portId:'image'},expose:${JSON.stringify(expose)}});`;
fs.writeFileSync(path.join(here,'ingredients-build.json'),JSON.stringify({...build,source}));
if(process.argv.includes('--prepare-only'))process.exit(0);
const result=await compileVisual({source});
fs.writeFileSync(path.join(here,'ingredients-compile.json'),JSON.stringify(result));
console.log(JSON.stringify({ok:result.ok,code:result.code,diagnostics:result.diagnostics}));
if(!result.ok)process.exitCode=1;
