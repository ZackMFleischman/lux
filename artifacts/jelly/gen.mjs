// node gen.mjs bell tentacles nebula ... -> rewrites src/visual.ts (chain order) and copies parts
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
const chain = process.argv.slice(2);
const defs = [], nodes = [], edges = [], expose = [];
chain.forEach((n, i) => {
  const dst = `src/jellyfish/${n}.ts`;
  if (!(process.env.SKIP ?? '').split(',').includes(n) && existsSync(`parts/${n}.ts`)) copyFileSync(`parts/${n}.ts`, dst);
  const src = readFileSync(dst, 'utf8');
  const block = src.slice(src.indexOf('controls: {'), src.indexOf('controlDescriptions'));
  const ids = [...block.matchAll(/^\s{6}(\w+): \{ type/gm)].map((m) => m[1]);
  nodes.push(`    { id: '${n}', definition: '${n}' },`);
  if (i > 0) edges.push(`    {\n      id: '${chain[i - 1]}-to-${n}',\n      from: { nodeId: '${chain[i - 1]}', portId: 'image' },\n      to: { nodeId: '${n}', portId: 'image' },\n      delay: 'none',\n    },`);
  if ((process.env.EXPOSE ?? 'bell,planet').split(',').includes(n)) for (const id of ids) expose.push(`    { id: '${n}${id[0].toUpperCase()}${id.slice(1)}', nodeId: '${n}', controlId: '${id}' },`);
  if (n === 'fish') for (const id of ['motherSize', 'motherGlow', 'motherBeam', 'motherSpin']) expose.push(`    { id: 'fish${id[0].toUpperCase()}${id.slice(1)}', nodeId: 'fish', controlId: '${id}' },`);
  defs.push(n);
});
writeFileSync('src/visual.ts', `import { defineVisual } from '@lux/visual-sdk';
${chain.map((n) => `import ${n} from './jellyfish/${n}.ts';`).join('\n')}

export default defineVisual({
  label: 'Cosmic Jellyfish',
  definitions: {
${defs.map((d) => `    ${d},`).join('\n')}
  },
  nodes: [
${nodes.join('\n')}
  ],
  edges: [
${edges.join('\n')}
  ],
  output: { nodeId: '${chain.at(-1)}', portId: 'image' },
  expose: [
${expose.join('\n')}
  ],
});
`);
