import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, symlink, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../../scripts/install-visual-skill.mjs', import.meta.url));
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'lux-skill-install-'));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    await rm(root, { recursive: true, force: true });
  });
  const source = join(root, 'source'), destination = join(root, 'installed');
  await mkdir(join(source, 'references'), { recursive: true });
  await writeFile(join(source, 'SKILL.md'), '# Lux visual\n');
  await writeFile(join(source, 'references', 'sdk.md'), 'SDK reference\n');
  return { root, source, destination };
}
async function utility() {
  assert.ok(existsSync(script), 'Installer utility must exist');
  return import(pathToFileURL(script).href);
}

test('copies nested files and a repeated install leaves matching files untouched', async t => {
  const f = await fixture(t), { installVisualSkill } = await utility();
  assert.equal((await installVisualSkill({ ...f, check: true })).current, false);
  assert.equal(existsSync(f.destination), false, 'check must not create the destination');
  await installVisualSkill(f);
  assert.equal(await readFile(join(f.destination, 'references', 'sdk.md'), 'utf8'), 'SDK reference\n');
  const before = (await stat(join(f.destination, 'SKILL.md'))).mtimeMs;
  await installVisualSkill(f);
  assert.equal((await stat(join(f.destination, 'SKILL.md'))).mtimeMs, before);
  assert.equal((await installVisualSkill({ ...f, check: true })).current, true);
});

test('detects changed source without writing, then installs the updated bytes', async t => {
  const f = await fixture(t), { installVisualSkill } = await utility();
  await installVisualSkill(f);
  await writeFile(join(f.source, 'SKILL.md'), '# Revised Lux\n');
  assert.equal((await installVisualSkill({ ...f, check: true })).current, false);
  assert.equal(await readFile(join(f.destination, 'SKILL.md'), 'utf8'), '# Lux visual\n');
  await installVisualSkill(f);
  assert.equal(await readFile(join(f.destination, 'SKILL.md'), 'utf8'), '# Revised Lux\n');
});

test('reports obsolete or unrelated installed files and refuses mutation', async t => {
  const f = await fixture(t), { installVisualSkill } = await utility();
  await installVisualSkill(f);
  await writeFile(join(f.destination, 'personal.txt'), 'keep me');
  await writeFile(join(f.source, 'SKILL.md'), '# Revised Lux\n');
  const checked = await installVisualSkill({ ...f, check: true });
  assert.equal(checked.current, false);
  assert.deepEqual(checked.unexpected, ['personal.txt']);
  await assert.rejects(installVisualSkill(f), /unexpected|unmanaged|stale/i);
  assert.equal(await readFile(join(f.destination, 'personal.txt'), 'utf8'), 'keep me');
  assert.equal(await readFile(join(f.destination, 'SKILL.md'), 'utf8'), '# Lux visual\n');
});

test('rejects source and destination directory links without modifying their targets', async t => {
  const f = await fixture(t), { installVisualSkill } = await utility();
  const external = join(f.root, 'external');
  await mkdir(external);
  await writeFile(join(external, 'keep.txt'), 'untouched');
  const link = join(f.source, 'linked');
  await symlink(external, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(installVisualSkill(f), /link/i);
  await rm(link);
  await symlink(external, f.destination, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(installVisualSkill(f), /link/i);
  assert.equal(await readFile(join(external, 'keep.txt'), 'utf8'), 'untouched');
  assert.equal(existsSync(join(external, 'SKILL.md')), false);
});

test('rejects missing SKILL.md, overlapping paths, and links in destination ancestors', async t => {
  const f = await fixture(t), { installVisualSkill } = await utility();
  await assert.rejects(installVisualSkill({ source: f.source, destination: join(f.source, 'child') }), /overlap/i);
  await assert.rejects(installVisualSkill({ source: f.source, destination: f.source }), /overlap/i);
  const alias = join(f.root, 'alias');
  await symlink(f.source, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(installVisualSkill({ source: f.source, destination: join(alias, 'child') }), /link/i);
  await rm(join(f.source, 'SKILL.md'));
  await assert.rejects(installVisualSkill(f), /SKILL.md/);
});

test('refuses obsolete installed source files until they are reviewed and moved out', async t => {
  const f = await fixture(t), { installVisualSkill } = await utility();
  await installVisualSkill(f);
  await rm(join(f.source, 'references', 'sdk.md'));
  assert.deepEqual((await installVisualSkill({ ...f, check: true })).unexpected, ['references/sdk.md']);
  await assert.rejects(installVisualSkill(f), /Review and move/);
  assert.equal(await readFile(join(f.destination, 'references', 'sdk.md'), 'utf8'), 'SDK reference\n');
});

test('rejects hard linked destination files rather than overwriting shared content', async t => {
  const f = await fixture(t), { installVisualSkill } = await utility();
  const shared = join(f.root, 'shared.md');
  await writeFile(shared, 'shared content');
  await mkdir(f.destination);
  await link(shared, join(f.destination, 'SKILL.md'));
  await assert.rejects(installVisualSkill(f), /link/i);
  assert.equal(await readFile(shared, 'utf8'), 'shared content');
});

test('CLI check exits nonzero on drift and CODEX_HOME controls the default install root', async t => {
  const f = await fixture(t);
  await utility();
  const codexHome = join(f.root, 'codex-home');
  const neighbor = join(codexHome, 'skills', 'another-skill');
  await mkdir(neighbor, { recursive: true });
  await writeFile(join(neighbor, 'SKILL.md'), 'keep neighboring skill');
  const cli = (...args) => spawnSync(process.execPath, [script, '--source', f.source, ...args], {
    encoding: 'utf8', env: { ...process.env, CODEX_HOME: codexHome },
  });
  assert.equal(cli('--check').status, 1);
  assert.equal(cli().status, 0);
  assert.equal(await readFile(join(codexHome, 'skills', 'lux-visual-creation', 'SKILL.md'), 'utf8'), '# Lux visual\n');
  assert.equal(cli('--check').status, 0);
  assert.equal(cli('--skill', 'start-lux').status, 0);
  assert.equal(cli('--skill', 'start-lux', '--check').status, 0);
  assert.equal(await readFile(join(codexHome, 'skills', 'start-lux', 'SKILL.md'), 'utf8'), '# Lux visual\n');
  assert.notEqual(cli('--skill', '../unrelated').status, 0);
  assert.equal(await readFile(join(neighbor, 'SKILL.md'), 'utf8'), 'keep neighboring skill');
  assert.equal(cli('--destination', f.destination).status, 0);
  assert.equal(await readFile(join(f.destination, 'SKILL.md'), 'utf8'), '# Lux visual\n');
  assert.notEqual(cli('--unknown').status, 0);
});
