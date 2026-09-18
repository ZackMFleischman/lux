import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStudioQaAttempt } from '../../scripts/studio-qa.mjs';

test('QA attempt rejects a different checkout before creating evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lux-qa-root-'));
  const other = await mkdtemp(join(tmpdir(), 'lux-qa-other-'));
  await mkdir(join(root, 'artifacts'), { recursive: true });
  await assert.rejects(createStudioQaAttempt({ root, expectedWorkspace: other, label: 'wrong-root' }), /checkout mismatch/i);
});

test('QA attempt preserves an independent failed-attempt manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lux-qa-attempt-'));
  await mkdir(join(root, 'artifacts'), { recursive: true });
  const attempt = await createStudioQaAttempt({ root, expectedWorkspace: root, label: 'delayed-start', dependencyCheck: false });
  await attempt.finish({ error: 'startup deadline reached' });
  const manifest = JSON.parse(await readFile(join(attempt.directory, 'attempt.json'), 'utf8'));
  assert.equal(manifest.ok, false);
  assert.equal(manifest.error, 'startup deadline reached');
  assert.equal(manifest.workspace, attempt.session.workspace);
});
