import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { prepareCreativeCheckout, verifyCreativeDependencies } from '../../scripts/studio-creative.mjs';
import { installedElectron } from '../../scripts/studio-electron.mjs';

test('creative checkout keeps its original commit while development advances, and detects edits', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'lux-creative-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const source = join(temp, 'source'), appData = join(temp, 'data'); await mkdir(source);
  const git = (...args) => execFileSync('git', ['-c', 'core.excludesFile=', '-c', 'core.fsmonitor=false', '-c', `safe.directory=${source.replaceAll('\\', '/')}`,
    '-c', 'user.name=Lux test', '-c', 'user.email=test@example.invalid', ...args], { cwd: source, encoding: 'utf8', windowsHide: true }).trim();
  git('init', '-q');
  await writeFile(join(source, 'scene.txt'), 'original'); git('add', 'scene.txt'); git('commit', '-qm', 'Initial');
  const original = git('rev-parse', 'HEAD');
  const first = await prepareCreativeCheckout({ source, appData });
  assert.equal(first.commit, original);
  assert.equal(await readFile(join(first.checkout, 'scene.txt'), 'utf8'), 'original');
  await writeFile(join(source, 'scene.txt'), 'development'); git('commit', '-qam', 'Development');
  const second = await prepareCreativeCheckout({ source, appData });
  assert.deepEqual(second, first);
  assert.equal(await readFile(join(first.checkout, 'scene.txt'), 'utf8'), 'original');
  await writeFile(join(first.checkout, 'scene.txt'), 'unexpected edit');
  await assert.rejects(prepareCreativeCheckout({ source, appData }), /changed|modified/i);
});

test('creative dependency check rejects parent fallback without executing package code', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'lux-dependencies-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const checkout = join(temp, 'creative'); await mkdir(checkout);
  await writeFile(join(checkout, 'package.json'), JSON.stringify({ engines: { node: process.versions.node }, dependencies: { electron: '44.3.0' } }));
  await assert.rejects(verifyCreativeDependencies(checkout), /dependencies|node_modules/i);
  const electron = join(checkout, 'node_modules', 'electron'); await mkdir(electron, { recursive: true });
  await writeFile(join(electron, 'package.json'), JSON.stringify({ name: 'electron', version: '44.3.0', main: 'index.js' }));
  await writeFile(join(electron, 'index.js'), "throw Error('Package entry must not execute');");
  await verifyCreativeDependencies(checkout);
  assert.throws(() => installedElectron(checkout), /not installed/i);
  await mkdir(join(electron, 'dist'));
  await writeFile(join(electron, 'dist', 'version'), '44.3.0');
  await writeFile(join(electron, 'dist', 'fixture.exe'), 'inert fixture, never executed');
  await writeFile(join(electron, 'path.txt'), 'fixture.exe');
  assert.equal(installedElectron(checkout), join(electron, 'dist', 'fixture.exe'));
  await writeFile(join(electron, 'path.txt'), '../../index.js');
  assert.throws(() => installedElectron(checkout), /invalid/i);
  await writeFile(join(electron, 'package.json'), JSON.stringify({ name: 'electron', version: '45.0.0' }));
  await assert.rejects(verifyCreativeDependencies(checkout), /version/i);
});
