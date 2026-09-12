import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { defineVisual, sdkVersion } from '../../packages/visual-sdk/src/sdk-v2.ts';

test('SDK 0.2 freezes declared controls without invoking create or adding Intensity', () => {
  let called = false;
  const visual = defineVisual({
    controls: { roughness: { type: 'number', label: 'Roughness', min: 0, max: 1, default: 0.4 } },
    async create() { called = true; throw Error('not during declaration'); },
  });
  assert.equal(sdkVersion, '0.2.0');
  assert.equal(visual.sdkVersion, '0.2.0');
  assert.equal(called, false);
  assert.deepEqual(visual.controls.map(row => row.id), ['roughness']);
  assert.throws(() => { visual.controls[0].default = 0.9; }, TypeError);
  assert.throws(() => { visual.sdkVersion = '0.1.0'; }, TypeError);
  assert.deepEqual(defineVisual({ controls: {}, create: visual.create }).controls, []);
});

test('SDK 0.2 rejects missing controls, malformed definitions and getters without invoking them', () => {
  let called = false;
  const getter = { get controls() { called = true; return {}; }, async create() {} };
  for (const input of [{ async create() {} }, { controls: {}, create: 1 }, { controls: {}, async create() {}, extra: 1 }, getter]) {
    assert.throws(() => defineVisual(input));
  }
  assert.equal(called, false);
});

const source = (update = 'const height: number = frame.controls.spikeHeight; const roughness: number = frame.controls.roughness;') => `
import { defineVisual } from '@lux/visual-sdk';
export default defineVisual({
  controls: {
    spikeHeight: { type: 'number', label: 'Height', default: 1, min: 0, max: 4 },
    roughness: { type: 'number', label: 'Roughness', default: 0.4, min: 0, max: 1 },
  },
  async create(context) {
    const width: number = context.settings.width;
    return {
      update(frame) { ${update} },
      render(target) { const width: number = target.width; },
      reset(seed) { const value: number = seed; },
      dispose() {},
    };
  },
});`;

test('real pinned TypeScript infers declared numeric keys through async create and rejects absent/readonly/literal misuse', async () => {
  const dependencies = process.env.LUX_COMPILER_DEPENDENCIES || resolve('node_modules');
  assert.equal(JSON.parse(await readFile(join(dependencies, 'typescript/package.json'), 'utf8')).version, '7.0.2');
  const { default: getExePath } = await import(pathToFileURL(join(dependencies, 'typescript/lib/getExePath.js')).href);
  const zod = JSON.parse(await readFile(join(dependencies, 'zod/package.json'), 'utf8'));
  const directory = await mkdtemp(join(tmpdir(), 'lux-sdk-parameters-'));
  try {
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
      target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noUncheckedIndexedAccess: true,
      types: [], lib: ['ES2023', 'DOM'], skipLibCheck: true, noEmit: true, allowImportingTsExtensions: true,
      paths: {
        '@lux/visual-sdk': [fileURLToPath(new URL('../../packages/visual-sdk/src/sdk-v2.ts', import.meta.url))],
        zod: [join(dependencies, 'zod', zod.types)],
      },
    }, files: ['./visual.ts'] }));
    for (const [text, expected] of [
      [source(), null],
      [source('frame.controls.intensity;'), /Property 'intensity' does not exist/],
      [source('frame.controls.roughness = 0.9;'), /read-only/],
      [source('const value: 0.4 = frame.controls.roughness;'), /number.*not assignable.*0\.4/],
      [source('const value: string = frame.controls.roughness;'), /number.*not assignable.*string/],
      [source().replace(/controls: \{[\s\S]*?\n  \},/, 'controls: {},').replace('const height: number = frame.controls.spikeHeight; const roughness: number = frame.controls.roughness;', ''), null],
      [source('frame.controls.intensity;').replace(/controls: \{[\s\S]*?\n  \},/, 'controls: {},'), /Property 'intensity' does not exist/],
    ]) {
      await writeFile(join(directory, 'visual.ts'), text);
      const result = spawnSync(getExePath(), ['-p', join(directory, 'tsconfig.json'), '--pretty', 'false'], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
      assert.ifError(result.error);
      const diagnostics = result.stdout + result.stderr;
      if (expected) { assert.notEqual(result.status, 0, diagnostics); assert.match(diagnostics, expected); }
      else assert.equal(result.status, 0, diagnostics);
    }
  } finally {
    if (dirname(resolve(directory)) !== resolve(tmpdir())) throw Error('Refusing cleanup outside temporary root');
    await rm(directory, { recursive: true, force: true });
  }
});
