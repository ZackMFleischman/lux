import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as runtime from '../../scripts/studio-electron.mjs';

function fixture(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'lux-electron-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const root = join(workspace, 'node_modules/electron');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(workspace, 'package.json'), JSON.stringify({ devDependencies: { electron: '44.3.0' } }));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'electron', version: '44.3.0', main: 'index.js' }));
  writeFileSync(join(root, 'index.js'), "throw Error('Do not load Electron for inspection');");
  writeFileSync(join(root, 'install.js'), `
    const fs = require('node:fs'), path = require('node:path');
    fs.appendFileSync(path.join(__dirname, 'calls'), 'installed\\n');
    fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'dist/version'), '44.3.0');
    fs.writeFileSync(path.join(__dirname, 'dist/fixture.exe'), 'inert');
    fs.writeFileSync(path.join(__dirname, 'path.txt'), 'fixture.exe');
  `);
  return { workspace, root };
}

test('setup installs a missing pinned runtime once; checks remain inert', t => {
  const { workspace, root } = fixture(t);
  assert.throws(() => runtime.installedElectron(workspace), /not installed/);
  assert.equal(existsSync(join(root, 'calls')), false);
  const executable = runtime.ensureElectron(workspace);
  assert.equal(executable, join(root, 'dist/fixture.exe'));
  assert.equal(runtime.ensureElectron(workspace), executable);
  assert.equal(readFileSync(join(root, 'calls'), 'utf8'), 'installed\n');
});

test('setup repairs a deleted executable and wrong runtime version', t => {
  const { workspace, root } = fixture(t);
  runtime.ensureElectron(workspace);
  rmSync(join(root, 'dist/fixture.exe'));
  runtime.ensureElectron(workspace);
  writeFileSync(join(root, 'dist/version'), '43.0.0');
  assert.throws(() => runtime.installedElectron(workspace), /version/);
  runtime.ensureElectron(workspace);
  assert.equal(readFileSync(join(root, 'calls'), 'utf8'), 'installed\ninstalled\ninstalled\n');
});

test('setup refuses a mismatched package instead of downloading another version', t => {
  const { workspace, root } = fixture(t);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'electron', version: '45.0.0', main: 'index.js' }));
  assert.throws(() => runtime.ensureElectron(workspace), /version|pin/);
  assert.equal(existsSync(join(root, 'calls')), false);
});

test('failed and incomplete installs fail clearly and release their setup lock', t => {
  const { workspace, root } = fixture(t);
  writeFileSync(join(root, 'install.js'), 'process.exit(2);');
  assert.throws(() => runtime.ensureElectron(workspace), /setup failed/i);
  assert.equal(existsSync(join(root, '.lux-install.lock')), false);
  writeFileSync(join(root, 'install.js'), 'process.exit(0);');
  assert.throws(() => runtime.ensureElectron(workspace), /not installed/);
  assert.equal(existsSync(join(root, '.lux-install.lock')), false);
});

test('setup refuses concurrent mutation and parent dependency fallback', t => {
  const { workspace, root } = fixture(t);
  mkdirSync(join(root, '.lux-install.lock'));
  assert.throws(() => runtime.ensureElectron(workspace), /already|progress/i);
  assert.equal(existsSync(join(root, 'calls')), false);
  const child = join(workspace, 'child'); mkdirSync(child);
  writeFileSync(join(child, 'package.json'), readFileSync(join(workspace, 'package.json')));
  assert.throws(() => runtime.ensureElectron(child), /local|checkout/i);
});

test('installer uses official pinned sources despite inherited npm mirror/version overrides', t => {
  const { workspace, root } = fixture(t);
  const overrides = ['ELECTRON_CUSTOM_VERSION', 'npm_config_electron_mirror',
    'NPM_CONFIG_ELECTRON_CUSTOM_DIR', 'npm_config_electron_customfilename',
    'npm_package_config_electron_customVersion', 'npm_package_config_electron_nightly_mirror'];
  const keys = [...overrides, 'electron_config_cache'];
  const saved = keys.map(key => [key, process.env[key]]);
  t.after(() => { for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  for (const key of overrides) process.env[key] = 'must-not-reach-installer';
  process.env.electron_config_cache = join(workspace, 'shared-cache');
  writeFileSync(join(root, 'install.js'), `
    const fs = require('node:fs'), path = require('node:path');
    fs.writeFileSync(path.join(__dirname, 'env.json'), JSON.stringify(process.env));
    process.exit(0);
  `);
  assert.throws(() => runtime.ensureElectron(workspace), /not installed/);
  const env = JSON.parse(readFileSync(join(root, 'env.json'), 'utf8'));
  for (const key of overrides) assert.equal(env[key], undefined, key);
  assert.equal(env.electron_config_cache, process.env.electron_config_cache);
});
