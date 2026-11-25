import fs from 'node:fs';
import path from 'node:path';
const dir=import.meta.dirname;
const read=JSON.parse(fs.readFileSync(path.join(dir,'quasar-read.json'),'utf8'));
const star='6d0bd349-bbeb-4988-b49b-443315397b16';
const hole='fa981b60-a121-45e0-9a97-ccedfa2e05cc';
const glow='d831c483-9f01-4a63-80e2-a43d0a373aee';
const declarations={
  starlight:star,featureStarDensity:star,featureStarScale:star,featureStarVariance:star,featureStarOpacity:star,twinkle:star,
  zoom:hole,inclination:hole,roll:hole,drift:hole,spin:hole,turbulence:hole,heat:hole,radius:hole,
  jetPower:hole,jetWidth:hole,jetTwist:hole,jetSpeed:hole,lensing:hole,photon:hole,
  flowClarity:hole,orbiters:hole,orbitSpeed:hole,beltDensity:hole,
  bloom:glow,softness:glow,exposure:glow,
};
const exposures=Object.entries(declarations).map(([id,nodeId])=>`    { id: '${id}', nodeId: '${nodeId}', controlId: '${id}' },`).join('\n');
const main=`import { defineVisual } from '@lux/visual-sdk';
import starfield from './starfield/starfield.ts';
import quasar from './quasar.ts';
import bloom from './bloom.ts';

export default defineVisual({
  label: 'Feeding Quasar',
  definitions: { starfield, quasar, bloom },
  nodes: [
    { id: '${star}', definition: 'starfield' },
    { id: '${hole}', definition: 'quasar' },
    { id: '${glow}', definition: 'bloom' },
  ],
  edges: [
    { id: '1e4b6cde-eaea-4aa7-9178-aa676053fbae', from: { nodeId: '${star}', portId: 'image' }, to: { nodeId: '${hole}', portId: 'image' }, delay: 'none' },
    { id: 'b53bf4e4-bd7e-43f3-a993-051746df89ac', from: { nodeId: '${hole}', portId: 'image' }, to: { nodeId: '${glow}', portId: 'image' }, delay: 'none' },
  ],
  output: { nodeId: '${glow}', portId: 'image' },
  expose: [
${exposures}
  ],
});
`;
fs.writeFileSync(path.join(dir,'visual.ts'),main);
// Fresh read keeps the exact linked fallback from the running app.
const source=read.source;
source.entry='visual.ts';
delete source.files['scene-setup.ts'];
source.files['visual.ts']=main;
source.files['quasar.ts']=fs.readFileSync(path.join(dir,'quasar.ts'),'utf8');
source.files['bloom.ts']=fs.readFileSync(path.join(dir,'bloom.ts'),'utf8');
let libraryLinks=read.libraryLinks?.map(({componentId,mountPath})=>({componentId,mountPath}));
if(fs.existsSync(path.join(dir,'tuned-starfield.ts'))) {
  source.files['starfield/starfield.ts']=fs.readFileSync(path.join(dir,'tuned-starfield.ts'),'utf8');
  libraryLinks=[];
}
fs.writeFileSync(path.join(dir,'quasar-build.json'),JSON.stringify({expectedDraftVersion:read.draftVersion,source,libraryLinks}));
console.log('Assembled Quasar at draft '+read.draftVersion);
