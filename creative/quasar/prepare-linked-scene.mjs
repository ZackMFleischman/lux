import fs from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
const read = file => fs.readFileSync(path.join(here, file), 'utf8');
const current = JSON.parse(read('quasar-read.json'));
const quasar = JSON.parse(read('published-quasar.json'));
const planets = JSON.parse(read('published-planets.json'));
const request = {
  expectedDraftVersion: current.draftVersion,
  source: {
    sdkVersion: '0.4.0',
    entry: 'scene.ts',
    files: {
      'scene.ts': read('scene.ts'),
      // Preserve this scene's tuned defaults without changing the shared sky.
      'starfield/starfield.ts': read('tuned-starfield.ts'),
      'starfield/starfield-flare-rig.ts': read('starfield-flare-rig.ts'),
    },
  },
  libraryLinks: [
    { componentId: quasar.id, mountPath: 'quasar' },
    { componentId: planets.id, mountPath: 'planets' },
  ],
};
fs.writeFileSync(path.join(here, 'linked-build.json'), JSON.stringify(request, null, 2));
