import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';
import { prepareProjectResolution, resolveProject, mapProjectDiagnostic } from '../../packages/core/src/project/resolver.ts';
import { resolutionFixture, model, inputFor, packageFixture, ids, pinFor, bytes, hash, fixtureText } from '../project/resolver-fixtures.ts';
import { toolchain } from '../project/fixtures.ts';
import type { ResolvedProjectScene } from '../../packages/core/src/project/resolver.ts';

const dependencyRoot = realpathSync(process.env.LUX_COMPILER_DEPENDENCIES || resolve('node_modules'));
const evidence = resolve('.worktrees/_coordination/LUX-15/compiler'); mkdirSync(evidence, { recursive: true });
async function compile(label: string, scene: ResolvedProjectScene) {
  writeFileSync(resolve(evidence, `${label}-source.json`), JSON.stringify({ source: scene.source, origins: scene.origins, sourceJsonSha256: hash(JSON.stringify(scene.source)), dependencyRoot }, null, 2));
  const result = await compileVisual({ source: scene.source }, { dependencyRoot });
  writeFileSync(resolve(evidence, `${label}-result.json`), JSON.stringify(result, null, 2));
  return result;
}
test('actual contained compiler succeeds for both SDKs before exact local/package helper diagnostic checks', async () => {
  assert.equal(process.version, 'v24.12.0'); assert.equal(process.platform, 'win32');
  // Positive setup is a prerequisite, not a skipped negative-test condition.
  for (const sdk of ['0.1.0', '0.2.0'] as const) {
    const m = model(), pkg = packageFixture(sdk); m.packages.push(pkg);
    m.scenes[0]!.implementation = { kind: 'package', packageId: pkg.manifest.packageId, exportId: 'main' };
    const goodScene = resolveProject(await prepareProjectResolution(inputFor(m), toolchain), ids.a);
    const good = await compile(`positive-${sdk}`, goodScene);
    assert.equal(good.ok, true, JSON.stringify(good));
    if (!good.ok) throw Error('Positive compiler setup incomplete');
    const again = await compile(`repeat-${sdk}`, goodScene); assert.ok(again.ok, JSON.stringify(again));
    assert.equal(again.artifact.sourceHash, good.artifact.sourceHash);
    pkg.files['src/helper.ts'] = bytes(fixtureText('helper-valid').replace('0.25', '0.75')); pkg.manifest.files['src/helper.ts'] = hash(pkg.files['src/helper.ts']);
    const changed = await compile(`changed-${sdk}`, resolveProject(await prepareProjectResolution(inputFor(m), toolchain), ids.a));
    assert.ok(changed.ok, JSON.stringify(changed)); assert.notEqual(changed.artifact.sourceHash, good.artifact.sourceHash);
    pkg.files['src/helper.ts'] = bytes(fixtureText('helper-type-error')); pkg.manifest.files['src/helper.ts'] = hash(pkg.files['src/helper.ts']);
    const badScene = resolveProject(await prepareProjectResolution(inputFor(m), toolchain), ids.a);
    const result = await compile(`package-error-${sdk}`, badScene); assert.equal(result.ok, false, JSON.stringify(result));
    if (result.ok) throw Error('Expected exact helper type error');
    const path = `libraries/${pinFor(pkg.manifest).contentHash}/src/helper.ts`;
    const diagnostic = result.diagnostics.find(d => d.code === 'TS2322' && d.file === path);
    assert.ok(diagnostic, JSON.stringify(result)); assert.equal(diagnostic.line, 2); assert.equal(diagnostic.column, 14);
    const mapped = mapProjectDiagnostic(badScene, diagnostic); writeFileSync(resolve(evidence, `package-error-${sdk}-mapped.json`), JSON.stringify(mapped, null, 2));
    assert.equal(mapped.origin!.projectPath, path); assert.deepEqual(mapped.origin!.owners, [{ kind: 'package', packageId: pkg.manifest.packageId, exportId: 'main' }]);
  }
  const f = resolutionFixture();
  const goodScene = resolveProject(await prepareProjectResolution(f.input, f.supportedToolchain), ids.a);
  const good = await compile('local-positive', goodScene); assert.ok(good.ok, JSON.stringify(good));
  const badScene = resolveProject(await prepareProjectResolution(f.typeErrorInput(), f.supportedToolchain), ids.a);
  const result = await compile('local-error', badScene); assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw Error('Expected exact local helper error');
  const diagnostic = result.diagnostics.find(d => d.code === 'TS2322' && d.file === f.helperPath);
  assert.ok(diagnostic, JSON.stringify(result)); assert.equal(diagnostic.line, 2); assert.equal(diagnostic.column, 14);
  const mapped = mapProjectDiagnostic(badScene, diagnostic); writeFileSync(resolve(evidence, 'local-error-mapped.json'), JSON.stringify(mapped, null, 2));
  assert.equal(mapped.origin!.projectPath, f.helperPath); assert.equal(mapped.diagnostic.line, 2); assert.equal(mapped.diagnostic.column, 14);
});
