import fs from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
const snapshot = JSON.parse(fs.readFileSync(path.join(here, 'live-before-integration.json'), 'utf8'));
const controls = snapshot.status.authoring.controls;
const targets = {
  'tuned-starfield.ts': ['starlight', 'featureStarDensity', 'featureStarScale', 'featureStarVariance', 'featureStarOpacity', 'twinkle'],
  'components/quasar/accretion-disk.ts': ['zoom', 'inclination', 'roll', 'drift', 'spin', 'turbulence', 'flowClarity', 'heat', 'radius'],
  'components/lensing/gravitational-lensing.ts': ['lensing', 'photon'],
  'components/jets/polar-jets.ts': ['jetPower', 'jetWidth', 'jetTwist', 'jetSpeed'],
  'components/bloom/quasar-bloom.ts': ['bloom', 'softness', 'exposure'],
  'components/planets/orbiting-worlds.ts': ['orbiters', 'orbitSpeed', 'beltDensity'],
};
for (const [relative, ids] of Object.entries(targets)) {
  const file = path.join(here, relative);
  let text = fs.readFileSync(file, 'utf8');
  for (const id of ids) {
    if (!Number.isFinite(controls[id])) throw Error(`Missing live numeric control: ${id}`);
    const pattern = new RegExp(`(\\b${id}:\\s*\\{[^}]*?\\bdefault:\\s*)[-+0-9.eE]+`, 'g');
    const matches = [...text.matchAll(pattern)];
    if (matches.length !== 1) throw Error(`Expected one default for ${id}, found ${matches.length}`);
    text = text.replace(pattern, (_, prefix) => `${prefix}${controls[id]}`);
  }
  fs.writeFileSync(file, text);
}
console.log('Baked 27 live visual defaults; CameraController defaults remain zero.');
