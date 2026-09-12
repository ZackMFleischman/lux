import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// ESM CPU tests externalize JS packages; bundle Dockview's CSS as a sidecar.
const testCss = { name: 'test-dock-css', setup(build) {
  build.onResolve({ filter: /^dockview-react\/dist\/styles\/dockview.css$/ }, args => ({ path: require.resolve(args.path) }));
} };
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const root = join(directory, '../..');
const dist = join(directory, 'dist');
await mkdir(dist, { recursive: true });
const common = { bundle: true, sourcemap: true, logLevel: 'info', absWorkingDir: root };
await build({ ...common, entryPoints: [join(directory, 'src/main.ts')], outfile: join(dist, 'main.cjs'),
  platform: 'node', format: 'cjs', target: 'node24', external: ['electron'] });
await build({ ...common, entryPoints: [join(directory, 'src/preload.ts')], outfile: join(dist, 'preload.cjs'),
  platform: 'node', format: 'cjs', target: 'node24', external: ['electron'] });
await build({ ...common, entryPoints: [join(directory, 'src/entry.tsx')], outfile: join(dist, 'renderer.js'),
  platform: 'browser', format: 'esm', target: 'chrome140', jsx: 'automatic' });
await build({ ...common, entryPoints: [join(directory, 'src/visual-worker.mjs')], outfile: join(dist, 'visual-worker.js'),
  platform: 'browser', format: 'esm', target: 'chrome140' });
await copyFile(join(directory, 'src/index.html'), join(dist, 'index.html'));
if (process.argv.includes('--tests')) await build({ ...common,
  entryPoints: [join(root, 'tests/studio/view.test.tsx')], outfile: join(dist, 'view.test.cjs'),
  platform: 'node', format: 'cjs', target: 'node24', jsx: 'automatic' });
if (process.argv.includes('--tests')) await build({ ...common,
  entryPoints: [join(root, 'tests/studio/interactions.test.tsx')], outfile: join(dist, 'interactions.test.mjs'),
  platform: 'node', format: 'esm', packages: 'external', plugins: [testCss], target: 'node24', jsx: 'automatic' });
if (process.argv.includes('--tests')) await build({ ...common,
  entryPoints: [join(root, 'tests/studio/source-editor.test.tsx')], outfile: join(dist, 'source-editor.test.mjs'),
  platform: 'node', format: 'esm', packages: 'external', plugins: [testCss], target: 'node24', jsx: 'automatic' });
