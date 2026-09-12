import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticTarget, SourceCompileError, diagnosticsForSource } from '../../apps/studio/src/source/diagnostics.ts';
import { createSourceWorkspace } from '../../apps/studio/src/source/workspace.ts';
test('diagnostic targets use one-based UTF-16 coordinates and clamp CRLF helper positions', () => {
  const w = createSourceWorkspace({ sdkVersion: '0.1.0', entry: 'main.ts', files: { 'main.ts': '', 'lib/color.ts': '// 😀\r\nconst x = 1;\r\n' } });
  const diagnostic = { file: 'lib/color.ts', line: 2, column: 7, message: 'type', draftVersion: 0 };
  assert.deepEqual(diagnosticTarget(diagnostic, w.getSnapshot()), { path: 'lib/color.ts', offset: 13 });
  assert.deepEqual(diagnosticTarget({ ...diagnostic, line: 99, column: 99 }, w.getSnapshot()), { path: 'lib/color.ts', offset: 21 });
  assert.deepEqual(diagnosticTarget({ ...diagnostic, line: undefined, column: undefined }, w.getSnapshot()), { path: 'lib/color.ts', offset: 0 });
  assert.equal(diagnosticTarget({ ...diagnostic, file: 'removed.ts' }, w.getSnapshot()), null);
  w.edit('main.ts', 'changed'); assert.equal(diagnosticTarget(diagnostic, w.getSnapshot()), null);
});
test('compile failures retain structured diagnostics and readable messages', () => {
  const diagnostics = [{ file: 'lib/color.ts', line: 2, column: 7, message: 'Type mismatch' }];
  const error = new SourceCompileError(diagnostics);
  diagnostics[0]!.message = 'caller mutation';
  assert.equal(error.diagnostics[0]?.message, 'Type mismatch');
  assert.match(error.message, /lib\/color.ts:2:7.*Type mismatch/);
});
test('candidate-only diagnostics cannot navigate an unchanged draft with the same version and file path', () => {
  const w = createSourceWorkspace({ sdkVersion: '0.1.0', entry: 'main.ts', files: { 'main.ts': 'old draft' } });
  const diagnostic = { file: 'main.ts', line: 1, column: 1, message: 'different candidate', draftVersion: 0, candidateOnly: true };
  assert.equal(diagnosticTarget(diagnostic, w.getSnapshot()), null);
});
test('failed changed multi-file candidate retains draft but labels its diagnostics separately', async () => {
  const w = createSourceWorkspace({ sdkVersion: '0.1.0', entry: 'main.ts', files: { 'main.ts': 'old draft', 'lib/helper.ts': 'old helper' } });
  const before = w.getSnapshot(), next = structuredClone(before.source); next.files['lib/helper.ts'] = 'invalid changed helper';
  const records = [{ file: 'lib/helper.ts', line: 1, column: 2, message: 'candidate error' }];
  await assert.rejects(w.submit(next, before.version, async () => { throw new SourceCompileError(records); }));
  const diagnostics = diagnosticsForSource(records, next, before.version, w.getSnapshot());
  assert.equal(w.getSnapshot().version, before.version); assert.deepEqual(w.getSnapshot().source, before.source);
  assert.equal(diagnostics[0]!.candidateOnly, true); assert.equal(diagnosticTarget(diagnostics[0]!, w.getSnapshot()), null);
  const current = diagnosticsForSource(records, structuredClone(before.source), before.version, w.getSnapshot());
  assert.equal(current[0]!.candidateOnly, false); assert.deepEqual(diagnosticTarget(current[0]!, w.getSnapshot()), { path: 'lib/helper.ts', offset: 1 });
});
