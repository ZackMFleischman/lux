import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { declareComponent } from '../../packages/visual-sdk/src/component-metadata.ts';

test('internal typed helper normalizes a declaration without runtime side effects', () => {
  const metadata = declareComponent({
    declarationVersion: 1, key: 'lux/glow', label: 'Glow', description: 'Glow effect', tags: [],
    inputs: {}, outputs: {}, controls: {}, controlDescriptions: {}, lifecycle: { state: 'stateless', reset: 'seed' },
  });
  assert.deepEqual(metadata.controls, []);
  assert.equal(Object.isFrozen(metadata), true);
});

const source = (helper, mutate = '') => `
import { declareComponent } from ${JSON.stringify(helper)};
const metadata = declareComponent({
  declarationVersion: 1, key: 'lux/glow', label: 'Glow', description: 'Glow effect', tags: ['effect'],
  inputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Input image' } },
  outputs: {}, controls: { radius: { type: 'number', label: 'Radius', default: 2, min: 0, max: 8 } },
  controlDescriptions: { radius: 'Width' }, lifecycle: { state: 'stateless', reset: 'seed' },
});
const value: number = metadata.controls[0]!.default;
${mutate}
`;

test('pinned TypeScript checks inferred control descriptions, closed port literals and deeply readonly metadata', async () => {
  const dependencies = process.env.LUX_COMPILER_DEPENDENCIES || resolve('node_modules');
  assert.equal(JSON.parse(await readFile(join(dependencies, 'typescript/package.json'), 'utf8')).version, '7.0.2');
  const { default: getExePath } = await import(pathToFileURL(join(dependencies, 'typescript/lib/getExePath.js')).href);
  const directory = await mkdtemp(join(tmpdir(), 'lux-component-metadata-'));
  try {
    const helper = relative(directory, fileURLToPath(new URL('../../packages/visual-sdk/src/component-metadata.ts', import.meta.url))).replaceAll('\\', '/');
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
      target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noUncheckedIndexedAccess: true,
      types: [], lib: ['ES2023', 'DOM'], skipLibCheck: true, noEmit: true, allowImportingTsExtensions: true,
    }, files: ['./component.ts'] }));
    const cases = [
      ['correct declaration', source(helper), null],
      ['missing description', source(helper).replace("controlDescriptions: { radius: 'Width' }", 'controlDescriptions: {}'), /radius.*missing/],
      ['extra description', source(helper).replace("radius: 'Width'", "radius: 'Width', intensity: 'Extra'"), /intensity.*does not exist/],
      ['wrong control value type', source(helper).replace('default: 2', "default: '2'"), /string.*not assignable.*number/],
      ['unsupported port literal', source(helper).replace("alphaMode: 'premultiplied'", "alphaMode: 'straight'"), /straight.*not assignable/],
      ['signal with null unit', source(helper).replace("kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied'", "kind: 'signal', value: 'number', unit: null, clock: 'frame'"), null],
      ['empty controls', source(helper).replace(/controls: \{ radius: \{[^\n]+\} \}/, 'controls: {}').replace("controlDescriptions: { radius: 'Width' }", 'controlDescriptions: {}'), null],
      ...[
        "metadata.label = 'Changed';", "metadata.inputs.image!.label = 'Changed';",
        "if (metadata.inputs.image!.type.kind === 'image') metadata.inputs.image!.type.alphaMode = 'premultiplied';",
        "metadata.lifecycle.state = 'stateful';", 'metadata.controls[0]!.default = 3;',
        "metadata.controlDescriptions.radius = 'Changed';", "metadata.tags.push('new');",
        'metadata.inputs = {};', 'metadata.inputs.image = metadata.inputs.image!;',
        'metadata.lifecycle = { state: \'stateful\', reset: \'seed\' };',
      ].map(mutation => [mutation, source(helper, mutation), /read-only|readonly|only permits reading|does not exist/]),
    ];
    for (const [name, text, expected] of cases) {
      await writeFile(join(directory, 'component.ts'), text);
      const result = spawnSync(getExePath(), ['-p', join(directory, 'tsconfig.json'), '--pretty', 'false'], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
      assert.ifError(result.error);
      const diagnostics = result.stdout + result.stderr;
      if (expected) { assert.notEqual(result.status, 0, name); assert.match(diagnostics, expected, name); }
      else assert.equal(result.status, 0, `${name}: ${diagnostics}`);
    }
  } finally {
    if (dirname(resolve(directory)) !== resolve(tmpdir())) throw Error('Refusing cleanup outside temporary root');
    await rm(directory, { recursive: true, force: true });
  }
});
