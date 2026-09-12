import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
for (const args of [
  ['node_modules/typescript/bin/tsc', '-p', 'apps/studio/src/layout/tsconfig.json'],
  ['--test', '--test-isolation=none', '--test-reporter=tap', 'tests/studio/layout.test.ts'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error; if (result.status !== 0) process.exit(result.status ?? 1);
}
// Compile the real React binding and bundled local styles without mounting an app.
const output = await build({ absWorkingDir: root, entryPoints: ['apps/studio/src/layout/LuxDockLayout.tsx'],
  bundle: true, platform: 'browser', format: 'esm', target: 'chrome140', jsx: 'automatic',
  outdir: 'artifacts/layout-spike', write: false, metafile: true });
if (Object.keys(output.metafile.inputs).some(name => name.includes('dockview-enterprise'))) throw Error('Unexpected enterprise dependency');
if (!output.outputFiles.some(file => file.path.endsWith('.css'))) throw Error('Dockview CSS missing');
console.log('Dockview React adapter and local CSS bundled; no application or graphics launched.');
