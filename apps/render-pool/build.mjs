// Bundles the unchanged Studio visual worker for the render pool page.
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [join(here, '../studio/src/visual-worker.mjs')],
  outfile: join(here, 'dist/worker.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'chrome140',
  logLevel: 'warning',
});
console.log('render pool worker bundled');
