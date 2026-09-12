import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticTarget, SourceCompileError } from '../../apps/studio/src/source/diagnostics.ts';
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
