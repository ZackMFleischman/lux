import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
await build({ entryPoints: ['tests/studio/dock-shell.test.tsx'], outfile: 'apps/studio/dist/dock-shell.test.mjs', bundle: true,
  platform: 'node', format: 'esm', packages: 'external', target: 'node24', jsx: 'automatic',
  plugins: [{ name: 'local-dock-css', setup(build) { build.onResolve({ filter: /^dockview-react\/dist\/styles\/dockview.css$/ }, args => ({ path: require.resolve(args.path) })); } }] });
const result = spawnSync(process.execPath, ['--test', 'apps/studio/dist/dock-shell.test.mjs'], { stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error; process.exitCode = result.status ?? 1;
