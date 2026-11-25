import fs from 'node:fs';
import path from 'node:path';
const root=import.meta.dirname;
const controls={
  disk:['zoom','inclination','roll','drift','spin','turbulence','flowClarity','heat','radius'],
  lensing:['lensing','photon'],
  jets:['jetPower','jetWidth','jetTwist','jetSpeed'],
  bloom:['bloom','softness','exposure'],
};
const camera={cameraYaw:'yaw',cameraPitch:'pitch',cameraPanX:'panX',cameraPanY:'panY',cameraDolly:'dolly',cameraRoll:'roll'};
const exposure=(id,nodeId,controlId=id)=>`    { id: '${id}', nodeId: '${nodeId}', controlId: '${controlId}' },`;
const childExposures=Object.entries(controls).flatMap(([node,ids])=>ids.map(id=>exposure(id,node)));
childExposures.push(...Object.entries(camera).map(([alias,id])=>exposure(alias,'camera',id)));
const quasar=`import { defineComponent } from '@lux/visual-sdk';
import disk from './accretion-disk.ts';
import lensing from './lensing/gravitational-lensing.ts';
import jets from './jets/polar-jets.ts';
import bloom from './bloom/quasar-bloom.ts';
import camera from './camera-controller/camera-controller.ts';

// Reusable quasar: shared 3D fields converge in one disk renderer, then bloom.
export default defineComponent({
  label: 'Quasar',
  definitions: { disk, lensing, jets, bloom, camera },
  nodes: [
    { id: 'camera', definition: 'camera' },
    { id: 'lensing', definition: 'lensing' },
    { id: 'jets', definition: 'jets' },
    { id: 'disk', definition: 'disk' },
    { id: 'bloom', definition: 'bloom' },
  ],
  inputs: {
    image: { nodeId: 'disk', portId: 'image' },
    bodies: { nodeId: 'disk', portId: 'bodies' },
  },
  edges: [
    { id: 'camera-to-disk', from: { nodeId: 'camera', portId: 'camera' }, to: { nodeId: 'disk', portId: 'camera' }, delay: 'none' },
    { id: 'lensing-to-disk', from: { nodeId: 'lensing', portId: 'field' }, to: { nodeId: 'disk', portId: 'lensing' }, delay: 'none' },
    { id: 'jets-to-disk', from: { nodeId: 'jets', portId: 'field' }, to: { nodeId: 'disk', portId: 'jets' }, delay: 'none' },
    { id: 'disk-to-bloom', from: { nodeId: 'disk', portId: 'image' }, to: { nodeId: 'bloom', portId: 'image' }, delay: 'none' },
  ],
  output: { nodeId: 'bloom', portId: 'image' },
  expose: [
${childExposures.join('\n')}
  ],
});
`;
fs.writeFileSync(path.join(root,'components/quasar/quasar.ts'),quasar);
const sky=['starlight','featureStarDensity','featureStarScale','featureStarVariance','featureStarOpacity','twinkle'];
const planets=['orbiters','orbitSpeed','beltDensity'];
const rootExposures=[...sky.map(id=>exposure(id,'starfield')),
  ...Object.values(controls).flat().map(id=>exposure(id,'quasar')),
  ...Object.keys(camera).map(id=>exposure(id,'quasar')),
  ...planets.map(id=>exposure(id,'planets'))];
const scene=`import { defineVisual } from '@lux/visual-sdk';
import starfield from './starfield/starfield.ts';
import quasar from './quasar/quasar.ts';
import planets from './planets/orbiting-worlds.ts';

export default defineVisual({
  label: 'Feeding Quasar',
  definitions: { starfield, quasar, planets },
  nodes: [
    { id: 'starfield', definition: 'starfield' },
    { id: 'planets', definition: 'planets' },
    { id: 'quasar', definition: 'quasar' },
  ],
  edges: [
    { id: 'starfield-to-quasar', from: { nodeId: 'starfield', portId: 'image' }, to: { nodeId: 'quasar', portId: 'image' }, delay: 'none' },
    { id: 'planets-to-quasar', from: { nodeId: 'planets', portId: 'field' }, to: { nodeId: 'quasar', portId: 'bodies' }, delay: 'none' },
  ],
  output: { nodeId: 'quasar', portId: 'image' },
  expose: [
${rootExposures.join('\n')}
  ],
});
`;
fs.writeFileSync(path.join(root,'scene.ts'),scene);
console.log('Wrote readable scene and nested Quasar composition');
