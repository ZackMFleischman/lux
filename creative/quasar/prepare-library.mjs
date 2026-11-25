import fs from 'node:fs';
import path from 'node:path';

// Prepare explicit, reviewable Library requests. Publication remains an MCP action.
const here = import.meta.dirname;
const read = relative => fs.readFileSync(path.join(here, relative), 'utf8');
const write = (name, request) => fs.writeFileSync(path.join(here, name), JSON.stringify(request, null, 2));
const source = (entry, files) => ({ sdkVersion: '0.4.0', entry, files });
const cameraRoot = path.resolve(here, '../camera-controller');
const leaves = [
  ['lensing', 'Gravitational Lensing', 'Gravity and photon-ring shader field for compatible 3D bent-ray renderers.', 'gravitational-lensing.ts'],
  ['jets', 'Polar Jets', 'World-space helical plasma volume for compatible ray renderers; independent power, width, twist and speed.', 'polar-jets.ts'],
  ['bloom', 'Quasar Bloom', 'Image highlight bloom and exposure with controllable radius; usable on any compatible image.', 'quasar-bloom.ts'],
  ['planets', 'Orbiting Worlds', 'Three world-space demonstration planets, a ring and a sparse asteroid belt for compatible bent-ray renderers.', 'orbiting-worlds.ts'],
];

if (process.argv[2] === 'parent') {
  const dependencies = ['camera-controller', 'lensing', 'jets', 'bloom'].map(name => {
    const published = JSON.parse(read(`published-${name}.json`));
    return { componentId: published.id, revision: published.revision, mountPath: name };
  });
  write('publish-quasar.json', {
    name: 'Quasar',
    description: 'Reusable feeding black hole: accretion disk, camera overrides, gravitational lensing, helical polar jets and bloom. Connect a sky image and a compatible world field; View inside to edit the parts.',
    source: source('quasar.ts', {
      'quasar.ts': read('components/quasar/quasar.ts'),
      'accretion-disk.ts': read('components/quasar/accretion-disk.ts'),
    }),
    dependencies,
  });
} else {
  for (const [folder, name, description, entry] of leaves) {
    write(`publish-${folder}.json`, {
      name, description,
      source: source(entry, { [entry]: read(`components/${folder}/${entry}`) }),
    });
  }
  if (process.argv[2] !== 'leaves') write('publish-camera-controller.json', {
    name: 'CameraController',
    description: 'Additive orbit, pan, dolly and roll for compatible 3D cameras. Includes pose helpers; Studio enables preview gestures when connected and exposed.',
    source: source('camera-controller.ts', Object.fromEntries(
      ['camera-controller.ts', 'camera-pose.ts'].map(file => [file, fs.readFileSync(path.join(cameraRoot, file), 'utf8')]),
    )),
  });
}
