import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('source-only preparation cannot erase an existing final package report', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-sphere-qa-'));
  try {
    const report = JSON.stringify({ package: { releaseId: 'preserve-final-identity' } });
    fs.writeFileSync(path.join(out, 'preparation.json'), report);
    fs.writeFileSync(path.join(out, 'QA.md'), 'preserve final QA');
    const result = spawnSync(process.execPath, ['scripts/prepare-sphere-host-qa.mjs', path.join(out, 'missing-scene.lux-scene'), out],
      { cwd: path.resolve(import.meta.dirname, '../..'), encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing source-only preparation over a completed package report/);
    assert.equal(fs.readFileSync(path.join(out, 'preparation.json'), 'utf8'), report);
    assert.equal(fs.readFileSync(path.join(out, 'QA.md'), 'utf8'), 'preserve final QA');
    assert.deepEqual(fs.readdirSync(out).sort(), ['QA.md', 'preparation.json']);
  } finally {
    assert.equal(path.dirname(path.resolve(out)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(out).startsWith('lux-sphere-qa-'));
    fs.rmSync(out, { recursive: true, force: true });
  }
});
