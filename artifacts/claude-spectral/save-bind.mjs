import { readFile, writeFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const scene = process.argv[2];
const c = new Client({ name: 'save-bind', version: '1' });
const j = async (n, a = {}) => { const r = await c.callTool({ name: `lux.studio.${n}`, arguments: a }, undefined, { timeout: 600000 }); if (r.isError) throw Error(r.content[0].text); return JSON.parse(r.content[0].text); };
await c.connect(new StdioClientTransport({ command: process.execPath, args: ['scripts/studio-mcp.mjs'], cwd: process.cwd(), env: { ...process.env } }));
let d = await j('read');
await j('save', { path: scene, expectedDraftVersion: d.draftVersion, overwrite: true });
const s = JSON.parse(await readFile(scene, 'utf8'));
const h = s.controls.sourceHash ? (await j('status')).authoring.controlSchemaHash : null;
const base = { nodePath: [], definitionHash: h, schemaHash: h, enabled: true };
const analyzer = { version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 };
const band = (controlId, b, amount, attackMs, releaseMs) => ({ kind: 'audio', ...base, controlId, source: { kind: 'audio-band', logicalInputId: 'primary-audio', band: b, analyzer }, amount, attackMs, releaseMs });
s.controlAnimations = [
  { ...base, controlId: 'noiseScale', shape: 'sine', periodSeconds: 4, amount: 1.6, phase: 0 },
  band('bass', 'bass', 1, 30, 280), band('mids', 'mids', 1, 60, 400), band('highs', 'highs', 1, 15, 180),
  { kind: 'kick', ...base, controlId: 'kick', source: { kind: 'audio-kick', logicalInputId: 'primary-audio', analyzer }, amount: 1, attackMs: 5, releaseMs: 260, sensitivity: 0.6, retriggerMs: 180, envelope: 'exponential' },
];
await writeFile(scene, JSON.stringify(s, null, 2));
d = await j('read');
console.log(JSON.stringify(await j('open', { path: scene, expectedDraftVersion: d.draftVersion })));
const st = await j('status');
console.log('issues', JSON.stringify(st.authoring.issues ?? null).slice(0, 300), 'anims', JSON.stringify(st.authoring.controlAnimations ?? st.controlAnimations ?? '').slice(0, 300));
await c.close();
