// File preparation only: does not import authored visuals, compile, contact
// Studio, publish Library entries or launch an application. Not run by author.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const [name, destination] = process.argv.slice(2);
const manifests = {
  'fiber-optic-heart': [
    'fiber-optic-heart/composition.ts',
    'fiber-optic-heart/core.ts',
    'fiber-optic-heart/dust.ts',
    'fiber-optic-heart/geometry.ts',
    'fiber-optic-heart/paths.ts',
    'fiber-optic-heart/renderer.ts',
    'fiber-optic-heart/strand-shader.ts',
  ],
  'pigment-rivers': [
    'pigment-rivers/composition.ts',
    'pigment-rivers/bands.ts',
    'pigment-rivers/field-contract.ts',
    'pigment-rivers/renderer.ts',
    'pigment-rivers/surface.ts',
    'wandering-tracers/phrasing.ts',
    'wandering-tracers/watercolor.ts',
    'wandering-tracers/ornament-watercolor.ts',
    'wandering-tracers/boundary.ts',
    'wandering-tracers/ornament-boundary.ts',
    'wandering-tracers/contours.ts',
  ],
};
if (!Object.hasOwn(manifests, name) || !destination) {
  throw Error('Usage: node scripts/prepare-reference-visual-bundle.mjs fiber-optic-heart|pigment-rivers OUTPUT.json');
}
const files = {};
for (const file of manifests[name]) {
  files[file] = await readFile(resolve(root, 'examples/components', file), 'utf8');
}
const output = resolve(destination);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ sdkVersion: '0.4.0', entry: `${name}/composition.ts`, files }, null, 2), { flag: 'wx' });
console.log(`Prepared ${output}; source only, not compiled or tested.`);
