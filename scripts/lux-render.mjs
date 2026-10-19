// Fast offline rendering of Lux visuals without launching Studio.
//
//   node scripts/lux-render.mjs render --src <dir> --out <dir> [--times 1,2.5 | --range 0:72.5:24]
//        [--controls '{"startAt":0}'] [--width 1920 --height 1080] [--pool 3]
//   node scripts/lux-render.mjs video --src <dir> --out <file.mp4> --range 0:72.5:24
//        [--audio <song.mp3> --audio-start 0] [--controls ...] [--keep-frames <dir>]
//   node scripts/lux-render.mjs status | stop
//
// The first call compiles the source (cached by content hash) and starts a
// warm headless render pool (apps/render-pool) that later calls reuse; it
// exits by itself after 20 idle minutes. Frames are rendered at exact song
// times (true seek, no playback/reset tricks) and written straight to disk
// as t<seconds>.png (4 decimals).

import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileVisual } from '../apps/build-worker/src/compile.mjs';
import { linkRuntime } from '../apps/build-worker/src/link-runtime.mjs';
import { normalizeControlSchema } from '../packages/runtime-contracts/src/parameters.mjs';
import { createCompositionControlState } from '../packages/runtime/src/components/composition-controls.ts';
import { installedElectron } from './studio-electron.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootKey = createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 12);
const stateDir = join(tmpdir(), 'lux-render', rootKey);
const endpointFile = join(stateDir, 'endpoint.json');
const cacheDir = join(stateDir, 'compile-cache');

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[++i];
    else out._.push(a);
  }
  return out;
}

async function bundleSource(dir) {
  const files = {};
  const walk = async d => {
    for (const name of (await readdir(d)).sort()) {
      const p = join(d, name);
      if ((await stat(p)).isDirectory()) await walk(p);
      else if (p.endsWith('.ts')) files[relative(dir, p).split(sep).join('/')] = await readFile(p, 'utf8');
    }
  };
  await walk(dir);
  const sdkVersion = Object.values(files).some(s => s.includes('defineComponent')) ? '0.4.0' : '0.2.0';
  return { sdkVersion, entry: 'visual.ts', files };
}

// Compile + link once per source content; repeat renders skip both.
export async function compileCached(source) {
  const hash = createHash('sha256').update(JSON.stringify(source)).digest('hex');
  const file = join(cacheDir, `${hash}.json`);
  if (existsSync(file)) return { ...JSON.parse(await readFile(file, 'utf8')), cached: true };
  const dependencyRoot = await realpath(join(root, 'node_modules'));
  const started = Date.now();
  const compiled = await compileVisual({ source }, { dependencyRoot });
  if (!compiled.ok) throw Error(compiled.diagnostics.map(d => `${d.file ?? ''}:${d.line ?? ''} ${d.message}`).join('\n'));
  const linked = await linkRuntime(compiled.artifact, { dependencyRoot });
  const entry = { sourceHash: compiled.artifact.sourceHash, sdkVersion: source.sdkVersion, linked, compileMs: Date.now() - started };
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, JSON.stringify(entry));
  return { ...entry, cached: false };
}

// Worker init payload, mirroring Studio's standalone client.
export function jobFor(compiled, { width, height, controls }) {
  const { linked } = compiled;
  const settings = { width, height, fps: 60, seed: 0 };
  const controlSchema = normalizeControlSchema(linked.controls ?? []);
  let values, nodeControls;
  if (linked.linkedVersion === 5) {
    const state = createCompositionControlState(linked.composition, undefined);
    values = { ...state.values(), ...controls };
    nodeControls = { sourceHash: compiled.sourceHash, nodes: state.snapshot().nodes };
  } else {
    values = Object.fromEntries(controlSchema.filter(c => c.type !== 'trigger').map(c => [c.id, c.default]));
    Object.assign(values, controls);
  }
  const key = createHash('sha256').update(JSON.stringify([compiled.sourceHash, linked.linkedHash, settings, values])).digest('hex').slice(0, 32);
  return { key, linked, settings, sdkVersion: compiled.sdkVersion, controlSchema, controlSchemaHash: linked.controlSchemaHash, controls: values, nodeControls };
}

async function endpoint() {
  try {
    const e = JSON.parse(await readFile(endpointFile, 'utf8'));
    const r = await fetch(`http://127.0.0.1:${e.port}/status`, { headers: { authorization: `Bearer ${e.token}` }, signal: AbortSignal.timeout(3000) });
    if (r.ok) return e;
  } catch { /* not running */ }
  return undefined;
}

// Rebuild the pool's worker bundle when the Studio worker source is newer.
async function ensureWorkerBundle() {
  const bundle = join(root, 'apps/render-pool/dist/worker.js');
  const source = join(root, 'apps/studio/src/visual-worker.mjs');
  if (existsSync(bundle) && (await stat(bundle)).mtimeMs >= (await stat(source)).mtimeMs) return false;
  const built = spawnSync(process.execPath, [join(root, 'apps/render-pool/build.mjs')], { cwd: root, encoding: 'utf8' });
  if (built.status !== 0) throw Error(`render pool worker build failed: ${built.stderr}`);
  return true;
}

export async function ensurePool(pool = 3) {
  const live = await endpoint();
  const rebuilt = await ensureWorkerBundle();
  if (live && !rebuilt) return live;
  if (live) await call(live, '/shutdown', {}).catch(() => {});
  const electron = installedElectron(root);
  await mkdir(stateDir, { recursive: true });
  const child = spawn(electron, [join(root, 'apps/render-pool/src/main.cjs'), `--pool=${pool}`, `--endpoint=${endpointFile}`], {
    cwd: root, detached: true, stdio: 'ignore', windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  });
  child.unref();
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 300));
    const e = await endpoint();
    if (e) return e;
  }
  throw Error('render pool did not start within 60 s');
}

async function call(e, path, body) {
  const r = await fetch(`http://127.0.0.1:${e.port}${path}`, {
    method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${e.token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await r.json();
  if (!r.ok) throw Error(value.error ?? `render pool ${path} failed (${r.status})`);
  return value;
}

export async function renderFrames({ src, out, times, controls = {}, width = 1920, height = 1080, pool = 3 }) {
  const source = await bundleSource(resolve(src));
  const compiled = await compileCached(source);
  const job = jobFor(compiled, { width, height, controls });
  const e = await ensurePool(pool);
  const frames = times.map(t => ({ t, path: join(resolve(out), `t${t.toFixed(4).padStart(9, '0')}.png`) }));
  const result = await call(e, '/render', { job, frames });
  return { ...result, compileMs: compiled.cached ? 0 : compiled.compileMs, compileCached: compiled.cached };
}

// Frames to H.264 (and optional AAC song) with ffmpeg; frames stay on disk
// only when --keep-frames is given.
export async function renderVideo({ src, out, range, controls, width, height, pool, audio, audioStart = 0, keepFrames }) {
  const [a, b, fps] = range;
  const frameDir = keepFrames ? resolve(keepFrames) : join(stateDir, 'video', createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 8));
  const times = Array.from({ length: Math.round((b - a) * fps) }, (_, i) => a + i / fps);
  const result = await renderFrames({ src, out: frameDir, times, controls, width, height, pool });
  if (result.failed.length) throw Error(`${result.failed.length} frames failed, first: ${JSON.stringify(result.failed[0])}`);
  const list = join(frameDir, 'frames.txt');
  const frameLine = t => {
    const file = join(frameDir, `t${t.toFixed(4).padStart(9, '0')}.png`).split(sep).join('/');
    return `file '${file}'\nduration ${(1 / fps).toFixed(6)}\n`;
  };
  await writeFile(list, times.map(frameLine).join(''));
  const args = ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list];
  if (audio) args.push('-ss', String(audioStart), '-t', String(b - a), '-i', resolve(audio), '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), resolve(out));
  const encoded = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (encoded.status !== 0) throw Error(`ffmpeg failed: ${encoded.stderr.slice(-800)}`);
  if (!keepFrames) await import('node:fs/promises').then(fs => fs.rm(frameDir, { recursive: true, force: true }));
  return { ...result, video: resolve(out) };
}

export function timesFrom(args) {
  if (args.times) return String(args.times).split(',').map(Number);
  if (args.range) {
    const [a, b, fps] = String(args.range).split(':').map(Number);
    const n = Math.round((b - a) * fps);
    return Array.from({ length: n }, (_, i) => a + i / fps);
  }
  throw Error('give --times or --range start:end:fps');
}

if (import.meta.url === `file:///${process.argv[1].replaceAll('\\', '/')}` || process.argv[1]?.endsWith('lux-render.mjs')) {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  try {
    if (command === 'status') console.log(JSON.stringify((await endpoint()) ? await call(await endpoint(), '/status') : { running: false }));
    else if (command === 'stop') { const e = await endpoint(); if (e) await call(e, '/shutdown', {}); console.log('stopped'); }
    else if (command === 'render') {
      const started = Date.now();
      const result = await renderFrames({
        src: args.src, out: args.out, times: timesFrom(args),
        controls: args.controls ? JSON.parse(args.controls) : {},
        width: Number(args.width ?? 1920), height: Number(args.height ?? 1080), pool: Number(args.pool ?? 3),
      });
      console.log(JSON.stringify({ ...result, wallMs: Date.now() - started }));
      if (result.failed.length) process.exitCode = 1;
    } else if (command === 'video') {
      const started = Date.now();
      const range = String(args.range ?? '').split(':').map(Number);
      if (range.length !== 3 || range.some(n => !Number.isFinite(n))) throw Error('video needs --range start:end:fps');
      const result = await renderVideo({
        src: args.src, out: args.out, range, controls: args.controls ? JSON.parse(args.controls) : {},
        width: Number(args.width ?? 1920), height: Number(args.height ?? 1080), pool: Number(args.pool ?? 3),
        audio: args.audio, audioStart: Number(args['audio-start'] ?? 0), keepFrames: args['keep-frames'],
      });
      console.log(JSON.stringify({ video: result.video, rendered: result.rendered, wallMs: Date.now() - started }));
    } else {
      console.error('usage: lux-render.mjs render --src <dir> --out <dir> (--times a,b | --range s:e:fps) [--controls json] | video --src <dir> --out <file.mp4> --range s:e:fps [--audio f --audio-start s] | status | stop');
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(String(error?.stack ?? error));
    process.exitCode = 1;
  }
}
