// Isolated QA capture for the One More Dawn show.
// Launches a fresh test-profile Studio from this checkout, builds the show
// source, captures frames at the given song times, and closes only the
// Studio it launched. Never touches the user's creative/desktop profile.
//
// Usage (from the checkout root, after `node apps/studio/build.mjs`):
//   node visuals/one-more-dawn/tools/qa-capture.mjs <outDir> <t1> <t2> ...
// Options via env: SHOW_SRC (default visuals/one-more-dawn/src),
//   QA_BUILD_SLOTS (default 2): how many captures may be in the expensive
//   launch + first-build phase at once, machine-wide. Everything else
//   (frame captures, other lanes' editing) runs fully in parallel.

import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createStudioQaAttempt } from '../../../scripts/studio-qa.mjs';

const root = resolve(import.meta.dirname, '../../..');
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

// Machine-wide build gate. Concurrent cold starts compete for the GPU and
// overrun Studio's visual start-up deadline, so only a few captures may be
// launching/building at once. A slot is a directory created atomically;
// slots left by dead processes (or older than 10 minutes) are reclaimed.
const slotRoot = join(tmpdir(), 'lux-dawn-qa-build-slots');
const slotCount = Math.max(1, Number(process.env.QA_BUILD_SLOTS ?? 2));
const alive = pid => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};
async function acquireBuildSlot() {
  await mkdir(slotRoot, { recursive: true });
  const started = Date.now();
  for (;;) {
    for (let i = 0; i < slotCount; i += 1) {
      const dir = join(slotRoot, `slot-${i}`);
      try {
        await mkdir(dir);
        await writeFile(join(dir, 'owner.json'), JSON.stringify({ pid: process.pid, at: Date.now() }));
        if (Date.now() - started > 1000) console.error(`build slot ${i} acquired after ${Math.round((Date.now() - started) / 1000)} s`);
        return async () => rm(dir, { recursive: true, force: true });
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        try {
          const owner = JSON.parse(await readFile(join(dir, 'owner.json'), 'utf8'));
          if (!alive(owner.pid) || Date.now() - owner.at > 10 * 60 * 1000) await rm(dir, { recursive: true, force: true });
        } catch {
          // Owner file not written yet or already removed; check again next pass.
        }
      }
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}

await mkdir(outDir, { recursive: true });
const attempt = await createStudioQaAttempt({ root, label: 'dawn-capture', evidenceRoot: join(root, 'artifacts', 'one-more-dawn-qa') });
const client = new Client({ name: 'dawn-qa', version: '1.0.0' });
let ok = false;
let releaseSlot = await acquireBuildSlot();
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
  // The first build in a fresh test profile can exceed the visual start-up
  // deadline while shaders compile; retry inside the same isolated Studio.
  const source = await bundle(sourceRoot);
  let built;
  for (let attempt = 1; ; attempt += 1) {
    const draft = json(await call('lux.studio.read')).draftVersion;
    try {
      built = json(await call('lux.studio.build', { expectedDraftVersion: draft, source }));
      break;
    } catch (error) {
      if (attempt >= 4 || !/exceeded|timed out|deadline|stopped making progress/i.test(String(error))) throw error;
      console.error(`build attempt ${attempt} timed out; retrying`);
    }
  }
  // The expensive phase is over; let the next lane build while we capture.
  await releaseSlot();
  releaseSlot = async () => {};
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
  await releaseSlot().catch(() => {});
  await client.close().catch(() => {});
  await attempt.finish({ ok });
}
