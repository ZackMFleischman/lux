// Lux render pool: a headless Electron host that keeps N hidden render
// windows warm and renders frames at exact times straight to disk.
// Started (and reused) by scripts/lux-render.mjs; exits after an idle period.
//
// Endpoint: 127.0.0.1 HTTP with a random port and bearer token, published to
// the endpoint file passed as --endpoint. Requests are JSON:
//   GET  /status                       -> {pid, pool, busy, warm[]}
//   POST /render {job, frames:[{t, path}]} -> {rendered, failed:[{t, error}], timing}
//   POST /shutdown

'use strict';
const { app, BrowserWindow } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).filter(p => p.length === 2));
const POOL = Math.max(1, Math.min(8, Number(args.pool ?? 3)));
const IDLE_MS = Math.max(60000, Number(args.idleMs ?? 20 * 60 * 1000));
const ENDPOINT = args.endpoint;
if (!ENDPOINT) { console.error('render pool: --endpoint=<file> is required'); process.exit(2); }

app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.on('window-all-closed', () => {});

const token = crypto.randomBytes(24).toString('hex');
const slots = [];
let busy = 0, idleTimer;
function touch() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (busy === 0) shutdown(); else touch(); }, IDLE_MS);
}
function shutdown() {
  try { fs.rmSync(ENDPOINT, { force: true }); } catch {}
  app.exit(0);
}

async function makeSlot(index) {
  const win = new BrowserWindow({ show: false, width: 64, height: 64, webPreferences: {
    sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  await win.loadFile(path.join(__dirname, 'page.html'));
  return { index, win, key: undefined, queue: Promise.resolve() };
}

// Run one slot's share of a job: prepare (warm if the same source/settings),
// then render its frames in time order and write each PNG to its path.
async function runOnSlot(slot, job, frames, result) {
  const wc = slot.win.webContents;
  const started = Date.now();
  const mode = await wc.executeJavaScript(`prepare(${JSON.stringify(job)})`);
  slot.key = job.key;
  result.timing.push({ slot: slot.index, prepare: mode, prepareMs: Date.now() - started });
  for (const frame of frames) {
    try {
      const bytes = await wc.executeJavaScript(`renderFrame(${Number(frame.t)})`);
      await fs.promises.mkdir(path.dirname(frame.path), { recursive: true });
      await fs.promises.writeFile(frame.path, Buffer.from(bytes));
      result.rendered += 1;
    } catch (error) {
      result.failed.push({ t: frame.t, error: String(error?.message ?? error).slice(0, 500) });
      // A failed visual is discarded so the next job starts clean.
      slot.key = undefined;
      await wc.executeJavaScript('releaseVisual()').catch(() => {});
      break;
    }
  }
}

async function render(body) {
  const { job, frames } = body;
  if (!job?.key || !Array.isArray(frames)) throw Error('render needs {job, frames}');
  const sorted = [...frames].sort((a, b) => a.t - b.t);
  // Prefer slots already warm for this job; split frames into contiguous runs.
  const ordered = [...slots].sort((a, b) => (b.key === job.key) - (a.key === job.key));
  const use = ordered.slice(0, Math.max(1, Math.min(slots.length, Math.ceil(sorted.length / 8))));
  const per = Math.ceil(sorted.length / use.length);
  const result = { rendered: 0, failed: [], timing: [] };
  const started = Date.now();
  await Promise.all(use.map((slot, i) => {
    const part = sorted.slice(i * per, (i + 1) * per);
    if (part.length === 0) return Promise.resolve();
    slot.queue = slot.queue.then(() => runOnSlot(slot, job, part, result));
    return slot.queue;
  }));
  // Frames a failed slot never reached are reported, not silently dropped.
  const done = new Set(result.failed.map(f => f.t));
  for (const f of sorted) if (!fs.existsSync(f.path) && !done.has(f.t)) result.failed.push({ t: f.t, error: 'not rendered (slot stopped after an earlier failure)' });
  result.timing.push({ totalMs: Date.now() - started, frames: sorted.length });
  return result;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

app.whenReady().then(async () => {
  for (let i = 0; i < POOL; i += 1) slots.push(await makeSlot(i));
  const server = http.createServer(async (req, res) => {
    const reply = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (req.headers.authorization !== `Bearer ${token}`) return reply(401, { error: 'unauthorized' });
    touch();
    try {
      if (req.method === 'GET' && req.url === '/status') return reply(200, { pid: process.pid, pool: slots.length, busy, warm: slots.map(s => s.key ?? null) });
      if (req.method === 'POST' && req.url === '/shutdown') { reply(200, { ok: true }); return setTimeout(shutdown, 50); }
      if (req.method === 'POST' && req.url === '/render') {
        busy += 1;
        try { return reply(200, await render(await readBody(req))); } finally { busy -= 1; touch(); }
      }
      reply(404, { error: 'not found' });
    } catch (error) { reply(500, { error: String(error?.message ?? error) }); }
  });
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    fs.mkdirSync(path.dirname(ENDPOINT), { recursive: true });
    fs.writeFileSync(ENDPOINT, JSON.stringify({ port, token, pid: process.pid, pool: slots.length, root: path.resolve(__dirname, '../../..') }));
    touch();
  });
});
