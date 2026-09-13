import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const root = join(directory, '../..');
const tests = join(root, 'tests/studio');
for (const args of [
  [join(directory, 'build.mjs'), '--tests'],
  ['--test', '--test-isolation=none', ...(await readdir(tests)).filter(name => name.endsWith('.test.ts')).map(name => join(tests, name)),
    join(directory, 'dist/view.test.cjs'), join(directory, 'dist/interactions.test.mjs')],
  ['--test', '--test-isolation=none', join(directory, 'dist/source-editor.test.mjs')],
  ['--experimental-vm-modules', '--test', join(tests, 'visual-worker.test.mjs')],
  ['--test','--test-isolation=none',join(root,'tests/performance/live.test.mjs'),join(root,'tests/performance/recovery.test.ts')],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true, timeout: 60000 });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
