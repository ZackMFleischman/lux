import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolveStudioSession, studioTestEnvironment, createStudioConnection } from '../../scripts/studio-session.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'lux-session-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const a = join(root, 'a'), b = join(root, 'b');
  await mkdir(a); await mkdir(b);
  return { root, a, b, appData: join(root, 'profile') };
}

test('normal checkouts, creative, and every test run have separate profiles', async t => {
  const { a, b, appData } = await fixture(t);
  const one = resolveStudioSession({ workspace: a, appData, env: {} });
  assert.deepEqual(one, resolveStudioSession({ workspace: a, appData, env: {} }));
  const creativeEnv = { LUX_STUDIO_PROFILE: 'creative', LUX_STUDIO_SMOKE: '1', ELECTRON_RUN_AS_NODE: '1', LUX_STUDIO_SESSION_ID: 'old' };
  const test1 = studioTestEnvironment(creativeEnv), test2 = studioTestEnvironment(creativeEnv);
  assert.equal(test1.LUX_STUDIO_MCP_TEST, '1');
  assert.equal(test1.LUX_STUDIO_SMOKE, undefined);
  assert.equal(test1.ELECTRON_RUN_AS_NODE, undefined);
  assert.equal(test1.LUX_STUDIO_SESSION_ID, undefined);
  assert.equal(creativeEnv.LUX_STUDIO_PROFILE, 'creative');
  const paths = [one.directory,
    resolveStudioSession({ workspace: b, appData, env: {} }).directory,
    resolveStudioSession({ workspace: a, appData, env: { LUX_STUDIO_PROFILE: 'creative' } }).directory,
    resolveStudioSession({ workspace: a, appData, env: test1 }).directory,
    resolveStudioSession({ workspace: a, appData, env: test2 }).directory];
  assert.equal(new Set(paths).size, 5);
  for (const profile of ['', '../creative', 'C:\\profile', 'UPPER', 'a/b', 'x'.repeat(81)]) {
    assert.throws(() => resolveStudioSession({ workspace: a, appData, env: { LUX_STUDIO_PROFILE: profile } }), /profile/i);
  }
  assert.throws(() => resolveStudioSession({ workspace: a, appData, env: { LUX_STUDIO_PROFILE: 'creative', LUX_STUDIO_MCP_TEST: '1' } }), /test profile/i);
});

async function endpoint(t, session, label, { dropBuild = false } = {}) {
  const calls = [];
  const identity = { profile: session.profile, workspace: session.workspace, sessionId: randomUUID(), pid: process.pid };
  const token = randomUUID();
  const server = createServer(async (req, res) => {
    assert.equal(req.headers.authorization, `Bearer ${token}`);
    let body = ''; for await (const chunk of req) body += chunk;
    const command = JSON.parse(body); calls.push(command.method);
    if (dropBuild && command.method === 'build') { req.socket.destroy(); return; }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true, result: { label, studioSession: identity } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const record = { version: 1, ...identity, url: `http://127.0.0.1:${server.address().port}/`, token };
  await mkdir(session.directory, { recursive: true });
  await writeFile(session.endpointPath, JSON.stringify(record));
  return { record, calls };
}

test('connections route only to their selected profile and refuse endpoint replacement', async t => {
  const { a, appData } = await fixture(t);
  const creative = resolveStudioSession({ workspace: a, appData, env: { LUX_STUDIO_PROFILE: 'creative' } });
  const testing = resolveStudioSession({ workspace: a, appData, env: studioTestEnvironment({}) });
  const c = await endpoint(t, creative, 'creative'), other = await endpoint(t, testing, 'test');
  const creator = createStudioConnection(creative), tester = createStudioConnection(testing);
  assert.equal((await creator('status')).label, 'creative');
  assert.equal((await tester('build', {})).label, 'test');
  const count = other.calls.length;
  await writeFile(creative.endpointPath, JSON.stringify(other.record));
  await assert.rejects(creator('build', {}), /profile|checkout|changed/i);
  assert.equal(other.calls.length, count, 'No request reached the other instance');
  await writeFile(creative.endpointPath, JSON.stringify({ ...c.record, sessionId: randomUUID() }));
  await assert.rejects(creator('status'), /changed/i);
  await writeFile(creative.endpointPath, JSON.stringify(c.record));
  assert.equal((await creator('status')).label, 'creative');
});

test('rejects mismatched checkout and legacy or invalid endpoint before sending any request', async t => {
  const { a, b, appData } = await fixture(t);
  const session = resolveStudioSession({ workspace: a, appData, env: { LUX_STUDIO_PROFILE: 'creative' } });
  const live = await endpoint(t, session, 'creative');
  await assert.rejects(createStudioConnection({ ...session, expectedSessionId: randomUUID() })('build', {}), /changed/i);
  for (const record of [
    { ...live.record, workspace: b }, { ...live.record, version: undefined },
    { ...live.record, url: 'https://example.com/' }, { ...live.record, pid: -1 },
  ]) {
    await writeFile(session.endpointPath, JSON.stringify(record));
    await assert.rejects(createStudioConnection(session)('build', {}), /endpoint|checkout/i);
  }
  assert.deepEqual(live.calls, []);
});

test('failed startup discovery can connect after a stale endpoint is replaced', async t => {
  const { a, appData } = await fixture(t);
  const session = resolveStudioSession({ workspace: a, appData, env: {} });
  const stale = await endpoint(t, session, 'stale');
  await writeFile(session.endpointPath, JSON.stringify({ ...stale.record, url: 'http://127.0.0.1:1/' }));
  const call = createStudioConnection(session);
  await assert.rejects(call('status'));
  const live = await endpoint(t, session, 'ready');
  assert.equal((await call('status')).label, 'ready');
  const count = live.calls.length;
  await writeFile(session.endpointPath, JSON.stringify({ ...live.record, sessionId: randomUUID() }));
  await assert.rejects(call('build', {}), /changed/i);
  assert.equal(live.calls.length, count);
});

test('an uncertain mutation keeps the selected instance bound', async t => {
  const { a, appData } = await fixture(t);
  const session = resolveStudioSession({ workspace: a, appData, env: {} });
  await endpoint(t, session, 'original', { dropBuild: true });
  const call = createStudioConnection(session);
  await assert.rejects(call('build', {}));
  const replacement = await endpoint(t, session, 'replacement');
  await assert.rejects(call('build', {}), /changed/i);
  assert.deepEqual(replacement.calls, [], 'Uncertain build must not be retried on a new process');
});

test('actual Windows stdio adapter selects its test profile and refuses a replacement', { skip: process.platform !== 'win32' }, async t => {
  const { appData } = await fixture(t);
  const workspace = resolve(import.meta.dirname, '../..');
  const env = studioTestEnvironment({ ...process.env, APPDATA: appData });
  const session = resolveStudioSession({ workspace, appData, env });
  const live = await endpoint(t, session, 'selected Studio');
  const client = new Client({ name: 'isolation-cpu-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: [join(workspace, 'scripts/studio-mcp.mjs')], cwd: workspace, env }));
  t.after(() => client.close());
  const status = await client.callTool({ name: 'lux.studio.status', arguments: {} });
  assert.ok(!status.isError);
  assert.equal(JSON.parse(status.content[0].text).label, 'selected Studio');
  const discovery = await client.callTool({ name: 'lux.studio.discover', arguments: {} });
  assert.equal(JSON.parse(discovery.content[0].text).runningStudio.studioSession.profile, session.profile);
  const count = live.calls.length;
  await writeFile(session.endpointPath, JSON.stringify({ ...live.record, sessionId: randomUUID() }));
  const rejected = await client.callTool({ name: 'lux.studio.status', arguments: {} });
  assert.equal(rejected.isError, true);
  assert.match(rejected.content[0].text, /changed/i);
  assert.equal(live.calls.length, count);
});
