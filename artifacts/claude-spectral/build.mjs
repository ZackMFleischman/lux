// Temporary MCP client: open the Spectral copy, build the edited bundle, capture with simulated audio values.
import { readFile, writeFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const scene = process.argv[2];
const dir = 'artifacts/claude-spectral';
const client = new Client({ name: 'lux-spectral', version: '1.0.0' });
const call = async (name, args = {}) => {
  const r = await client.callTool({ name: `lux.studio.${name}`, arguments: args }, undefined, { timeout: 600000 });
  if (r.isError) throw Error(r.content?.map(c => c.text).join('\n'));
  return r;
};
const json = async (name, args) => JSON.parse((await call(name, args)).content.find(c => c.type === 'text').text);
await client.connect(new StdioClientTransport({ command: process.execPath, args: ['scripts/studio-mcp.mjs'], cwd: process.cwd(), env: { ...process.env } }));
try {
  let draft = await json('read');
  if (process.env.OPEN_FIRST === '1') {
    await json('open', { path: scene, expectedDraftVersion: draft.draftVersion });
    draft = await json('read');
  }
  const files = { ...draft.source.files };
  for (const name of ['visual.ts', 'pearl.ts', 'kaleidoscope.ts', 'spectrum.ts', 'companions.ts']) files[name] = await readFile(`${dir}/${name}`, 'utf8');
  const source = { ...draft.source, sdkVersion: '0.4.0', files };
  try {
    const png = await readFile(`${dir}/texture/nacre.png`);
    source.sourceVersion = 2;
    source.assets = { ...draft.source.assets, 'assets/nacre.png': { mediaType: 'image/png', encoding: 'base64', data: png.toString('base64') } };
    console.log('with texture', png.length);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const same = JSON.stringify(source) === JSON.stringify(draft.source);
  const built = same ? 'unchanged' : await json('build', { expectedDraftVersion: draft.draftVersion, source });
  console.log('build:', JSON.stringify(built).slice(0, 700));
  let status = await json('status');
  const a = status.authoring;
  console.log('schemaHash', a.controlSchemaHash, 'revision', a.revisionId);
  const shots = {};
  for (const [label, values] of Object.entries(shots)) {
    status = await json('status');
    await json('parameters', { instanceId: status.authoring.instanceId, expectedGeneration: status.authoring.generation, expectedRevisionId: status.authoring.revisionId, expectedControlSchemaHash: status.authoring.controlSchemaHash, values, mode: 'live' });
    await new Promise(r => setTimeout(r, 1500));
    const cap = await call('capture');
    await writeFile(`${dir}/${label}.png`, Buffer.from(cap.content.find(c => c.type === 'image').data, 'base64'));
  }
  status = await json('status');
  await json('parameters', { instanceId: status.authoring.instanceId, expectedGeneration: status.authoring.generation, expectedRevisionId: status.authoring.revisionId, expectedControlSchemaHash: status.authoring.controlSchemaHash, values: { bass: 0, mids: 0, highs: 0, kick: 0, kaleidoForce: 0, ringBloomPeriod: 24 }, mode: 'live' });
  console.log('issues:', JSON.stringify(status.authoring.issues ?? status.message ?? null).slice(0, 400));
  await writeFile(`${dir}/status.json`, JSON.stringify(await json('status'), null, 1));
} finally { await client.close(); }
