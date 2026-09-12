import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import packageIO from '../../packages/export/src/package.cjs';
import registration from '../../packages/export/src/register.cjs';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-export-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtime = path.join(root, 'input'); fs.mkdirSync(runtime);
  for (const name of packageIO.requiredRuntimeFiles) {
    const target = path.join(runtime, name); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, name === 'electron/version' ? '44.3.0' : 'fixture:' + name);
  }
  for (const name of ['package.cjs', 'install.cjs', 'register.cjs']) fs.copyFileSync(new URL('../../packages/export/src/' + name, import.meta.url), path.join(runtime, name));
  fs.copyFileSync(new URL('../../tools/gpu-spike/transport-release.cjs', import.meta.url), path.join(runtime, 'transport-release.cjs'));
  const linked = { code: 'export default {};', sourceMap: '', bundleHash: 'b'.repeat(64), linker: { version: '0.28.2' } };
  linked.linkedHash = hash(JSON.stringify(linked));
  const visual = { format: 'lux-transport', version: 1, sourceHash: 'a'.repeat(64), settings: { width: 1920, height: 1080, fps: 60, seed: 1 }, linked };
  const bytes = JSON.stringify(visual), transportPath = path.join(root, hash(bytes) + '.json'); fs.writeFileSync(transportPath, bytes);
  const options = { name: 'Tunnel', transportPath, runtimeDirectory: runtime, electronVersion: '44.3.0', outputDirectory: path.join(root, 'exports'), intensity: 0.17 };
  return { root, runtime, options, build: overrides => packageIO.createPackage({ ...options, ...overrides }), installRoot: path.join(root, 'installed') };
}
test('release identity is repeatable and pins name, control default, visual and complete runtime bytes', t => {
  const f = fixture(t), first = f.build(), repeated = f.build();
  assert.equal(first.releaseId, repeated.releaseId);
  assert.notEqual(first.releaseId, f.build({ name: 'Particles' }).releaseId);
  assert.notEqual(first.releaseId, f.build({ intensity: 0.4 }).releaseId);
  fs.writeFileSync(path.join(f.runtime, 'electron/resources.pak'), 'different exact runtime');
  const changed = f.build(); assert.notEqual(first.runtimeId, changed.runtimeId); assert.notEqual(first.releaseId, changed.releaseId);
  assert.equal(packageIO.validatePackage(first.path).release.controls[0].default, 0.5);
  assert.equal(packageIO.validatePackage(first.path).release.savedControls.intensity, 0.17);
});
test('two releases share one installed runtime; retiring one retains other release and runtime', t => {
  const f = fixture(t), first = f.build(), second = f.build({ name: 'Particles' });
  const a = packageIO.installPackage(first.path, f.installRoot), b = packageIO.installPackage(second.path, f.installRoot);
  assert.equal(a.runtimePath, b.runtimePath);
  assert.equal(fs.readdirSync(path.join(f.installRoot, 'runtimes')).filter(x => !x.startsWith('.')).length, 1);
  assert.deepEqual(packageIO.installPackage(first.path, f.installRoot), a);
  const retired = packageIO.retireRelease(f.installRoot, a.releaseId);
  assert.ok(fs.existsSync(retired.retiredPath)); assert.ok(fs.existsSync(b.releasePath)); assert.ok(fs.existsSync(a.runtimePath));
  assert.equal(packageIO.installPackage(first.path, f.installRoot).releaseId, a.releaseId);
});
test('damaged package fails before installation and leaves previous source usable', t => {
  const f = fixture(t), a = f.build(), installed = packageIO.installPackage(a.path, f.installRoot), b = f.build({ name: 'Particles' });
  fs.appendFileSync(path.join(b.path, 'runtime/electron/electron.exe'), 'tamper');
  assert.throws(() => packageIO.installPackage(b.path, f.installRoot), /hash mismatch/);
  assert.equal(packageIO.validateRelease(installed.releasePath).releaseId, a.releaseId);
  assert.equal(fs.readdirSync(path.join(f.installRoot, 'releases')).length, 1);
});
test('manifest modification and unlisted runtime files are rejected', t => {
  const f = fixture(t), a = f.build();
  fs.writeFileSync(path.join(a.path, 'runtime/unlisted.dll'), 'extra');
  assert.throws(() => packageIO.validatePackage(a.path), /Unlisted/);
  const b = f.build({ name: 'Other' });
  const filename = path.join(b.path, 'release/release.json'), release = JSON.parse(fs.readFileSync(filename)); release.name = 'Tampered';
  fs.writeFileSync(filename, JSON.stringify(release));
  assert.throws(() => packageIO.validatePackage(b.path), /identity mismatch/);
});
test('unsafe paths and missing runtime dependencies fail closed', t => {
  for (const value of ['../outside', '/absolute', 'C:/escape', 'a\\b', 'CON.txt', 'dir/NUL', 'foo.', 'a//b', 'a/../b']) assert.throws(() => packageIO.safeRelative(value), /Unsafe/);
  const f = fixture(t); fs.unlinkSync(path.join(f.runtime, 'electron/electron.exe'));
  assert.throws(() => f.build(), /Missing runtime dependency/);
});
test('junction ancestors cannot redirect package or installed paths', t => {
  const f = fixture(t), a = f.build(), outside = path.join(f.root, 'outside'); fs.mkdirSync(outside);
  const link = path.join(f.root, 'redirect'); fs.symlinkSync(outside, link, 'junction');
  assert.throws(() => packageIO.installPackage(a.path, path.join(link, 'installed')), /links\/reparse/);
  assert.throws(() => f.build({ outputDirectory: path.join(link, 'exports') }), /links\/reparse/);
  assert.deepEqual(fs.readdirSync(outside), []);
});
test('installed helper imports only package-local modules after checkout inputs disappear', t => {
  const f = fixture(t), a = f.build();
  fs.renameSync(f.runtime, f.runtime + '-unavailable'); fs.renameSync(f.options.transportPath, f.options.transportPath + '-unavailable');
  const output = execFileSync(process.execPath, [path.join(a.path, 'runtime/install.cjs'), a.path, f.installRoot], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.match(output, /"playbackReady": false/);
  assert.equal(packageIO.validateRelease(path.join(f.installRoot, 'releases', a.releaseId)).releaseId, a.releaseId);
});
test('nested destinations cannot recursively copy or mutate their own package inputs', t => {
  const f = fixture(t), a = f.build();
  assert.throws(() => f.build({ outputDirectory: path.join(f.runtime, 'nested') }), /outside/);
  assert.throws(() => packageIO.installPackage(a.path, path.join(a.path, 'runtime/installed')), /outside/);
  assert.throws(() => packageIO.copyTree(f.runtime, path.join(f.runtime, 'nested')), /outside/);
  assert.equal(packageIO.validatePackage(a.path).release.releaseId, a.releaseId);
  assert.equal(fs.existsSync(path.join(f.runtime, 'nested')), false);
});
test('source registration publishes a stable per-release DLL binding and preserves prior sources', t => {
  const f = fixture(t), pluginDirectory = path.join(f.root, 'plugins');
  for (const name of registration.supervisorFiles) { const filename = path.join(f.runtime, name); fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, '// CPU fixture only'); }
  const a = f.build(), b = f.build({ name: 'Particles' });
  packageIO.installPackage(a.path, f.installRoot); packageIO.installPackage(b.path, f.installRoot);
  const first = registration.registerSource({ installRoot: f.installRoot, releaseId: a.releaseId, pluginDirectory });
  const second = registration.registerSource({ installRoot: f.installRoot, releaseId: b.releaseId, pluginDirectory });
  assert.notEqual(first.dllPath, second.dllPath); assert.notEqual(first.pluginId, second.pluginId);
  assert.equal(fs.readFileSync(first.sidecarPath, 'utf8'), ['lux-installed-source-v1', a.releaseId, a.runtimeId, first.pluginId, 'Tunnel', ''].join('\n'));
  assert.equal(registration.registerSource({ installRoot: f.installRoot, releaseId: a.releaseId, pluginDirectory }).alreadyRegistered, true);
  fs.appendFileSync(second.dllPath, 'tamper');
  assert.throws(() => registration.registerSource({ installRoot: f.installRoot, releaseId: b.releaseId, pluginDirectory }), /refusing replacement/);
  assert.equal(fs.readFileSync(first.sidecarPath, 'utf8'), first.sidecar);
});
test('registration refuses incomplete runtime and conflicting FFGL IDs', t => {
  const f = fixture(t), a = f.build(), pluginDirectory = path.join(f.root, 'plugins');
  packageIO.installPackage(a.path, f.installRoot);
  assert.throws(() => registration.registerSource({ installRoot: f.installRoot, releaseId: a.releaseId, pluginDirectory }), /supervisor is not packaged/);
  assert.equal(fs.existsSync(pluginDirectory), false);
  for (const name of registration.supervisorFiles) { const filename = path.join(f.runtime, name); fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, '// CPU fixture only'); }
  const b = f.build(); packageIO.installPackage(b.path, f.installRoot);
  const identity = registration.sourceIdentity(packageIO.validatePackage(b.path).release);
  fs.mkdirSync(pluginDirectory);
  fs.writeFileSync(path.join(pluginDirectory, 'Lux_' + 'f'.repeat(64) + '.dll.lux-source'), ['lux-installed-source-v1', 'f'.repeat(64), b.runtimeId, identity.pluginId, 'Existing', ''].join('\n'));
  assert.throws(() => registration.registerSource({ installRoot: f.installRoot, releaseId: b.releaseId, pluginDirectory }), /collision/);
  assert.equal(fs.readdirSync(pluginDirectory).length, 1);
});
