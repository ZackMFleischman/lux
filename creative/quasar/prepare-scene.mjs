import fs from 'node:fs';
import path from 'node:path';
const here=import.meta.dirname;
const read=JSON.parse(fs.readFileSync(path.join(here,'quasar-read.json'),'utf8'));
const get=relative=>fs.readFileSync(path.join(here,relative),'utf8');
const cameraRoot=fs.existsSync(path.resolve(here,'../camera-controller/camera-pose.ts'))
  ? path.resolve(here,'../camera-controller')
  : path.resolve(here,'../../.worktrees/camera-controller/creative/camera-controller');
const files={
  'scene.ts':get('scene.ts'),
  'starfield/starfield.ts':get('tuned-starfield.ts'),
  'starfield/starfield-flare-rig.ts':get('starfield-flare-rig.ts'),
  'planets/orbiting-worlds.ts':get('components/planets/orbiting-worlds.ts'),
  'quasar/quasar.ts':get('components/quasar/quasar.ts'),
  'quasar/accretion-disk.ts':get('components/quasar/accretion-disk.ts'),
  'quasar/lensing/gravitational-lensing.ts':get('components/lensing/gravitational-lensing.ts'),
  'quasar/jets/polar-jets.ts':get('components/jets/polar-jets.ts'),
  'quasar/bloom/quasar-bloom.ts':get('components/bloom/quasar-bloom.ts'),
  'quasar/camera-controller/camera-controller.ts':fs.readFileSync(path.join(cameraRoot,'camera-controller.ts'),'utf8'),
  'quasar/camera-controller/camera-pose.ts':fs.readFileSync(path.join(cameraRoot,'camera-pose.ts'),'utf8'),
};
if(Object.values(files).some(value=>typeof value!=='string')) throw Error('A scene source file is missing');
const source={sdkVersion:'0.4.0',entry:'scene.ts',files};
fs.writeFileSync(path.join(here,'organized-build.json'),JSON.stringify({expectedDraftVersion:read.draftVersion,source,libraryLinks:[]}));
console.log(`Prepared ${Object.keys(files).length} files, ${Object.values(files).reduce((n,file)=>n+Buffer.byteLength(file),0)} bytes`);
