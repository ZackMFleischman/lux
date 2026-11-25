// Isolated QA capture for the One More Dawn show.
// Launches a fresh test-profile Studio from this checkout, builds the show
// source, captures frames at the given song times, and closes only the
// Studio it launched. Never touches the user's creative/desktop profile.
//
// Usage (from the checkout root, after `node apps/studio/build.mjs`):
//   node visuals/one-more-dawn/tools/qa-capture.mjs <outDir> <t1> <t2> ...
// Options via env: SHOW_SRC (default visuals/one-more-dawn/src),
//   QA_WIDTH/QA_HEIGHT (default 1280x720 output via preview size is not
//   changed; captures use the scene's output resolution).

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createStudioQaAttempt } from '../../scripts/studio-qa.mjs';

const root = resolve(import.meta.dirname, '../..');
const [outDir, ...times] = process.argv.slice(2);
if (!outDir || times.length === 0) {
  console.error('usage: qa-capture.mjs <outDir> <songTime...>');
  process.exit(2);
}
const sourceRoot = resolve(root, process.env.SHOW_SRC ?? 'visuals/one-more-dawn/src');

async function bundle(dir) {
  const files = {};
  const walk = async d => {
    for (const name of await readdir(d)) {
      const p = join(d, name);
      if ((await stat(p)).isDirectory()) await walk(p);
      else if (p.endsWith('.ts')) files[relative(dir, p).split(sep).join('/')] = await readFile(p, 'utf8');
    }
  };
  await walk(dir);
  return { sdkVersion: '0.4.0', entry: 'visual.ts', files };
}

await mkdir(outDir, { recursive: true });
const attempt = await createStudioQaAttempt({ root, label: 'dawn-capture', evidenceRoot: join(root, 'artifacts', 'one-more-dawn-qa') });
const client = new Client({ name: 'dawn-qa', version: '1.0.0' });
let ok = false;
try {
  await attempt.launch({ viewport: { width: 1280, height: 800 }, timeoutMs: 90000 });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [join(root, 'scripts/studio-mcp.mjs')],
    cwd: root,
    env: { ...attempt.env },
  }));
  const call = async (name, args = {}) => {
    const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 240000 });
    if (r.isError) throw Error(`${name}: ${JSON.stringify(r.content).slice(0, 2000)}`);
    return r;
  };
  const json = r => JSON.parse(r.content.find(c => c.type === 'text').text);
  // Cold test profiles compile every pipeline on first build; retry the
  // build inside the same isolated Studio so later attempts start warm.
  let built;
  for (let n = 1; ; n += 1) {
    const current = json(await call('lux.studio.read'));
    try {
      built = json(await call('lux.studio.build', { expectedDraftVersion: current.draftVersion, source: await bundle(sourceRoot) }));
      break;
    } catch (error) {
      if (n >= 6 || !/exceeded five seconds|stopped making progress/.test(String(error))) throw error;
      console.error(`build attempt ${n}: ${String(error).slice(0, 160)}`);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  let a = built.status.authoring;
  const guard = () => ({ instanceId: a.instanceId, expectedGeneration: a.generation });
  a = json(await call('lux.studio.playback', { ...guard(), action: 'pause' })).status.authoring;
  for (const t of times) {
    a = json(await call('lux.studio.playback', { ...guard(), action: 'reset' })).status.authoring;
    a = json(await call('lux.studio.parameters', {
      ...guard(), expectedRevisionId: a.revisionId, expectedControlSchemaHash: a.controlSchemaHash,
      values: { startAt: Number(t) }, mode: 'live',
    })).status.authoring;
    const cap = await call('lux.studio.capture');
    const img = cap.content.find(c => c.type === 'image');
    const file = join(outDir, `t${Number(t).toFixed(2).padStart(6, '0')}.png`);
    await writeFile(file, Buffer.from(img.data, 'base64'));
    console.log('saved', file);
  }
  ok = true;
} catch (error) {
  console.error(String(error.stack ?? error));
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
  await attempt.finish({ ok });
}
