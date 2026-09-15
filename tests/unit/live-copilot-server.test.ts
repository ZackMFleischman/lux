import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { once } from 'node:events';
import { startServer } from '../../tools/live-copilot/server.ts';

test('serves only the app files; refuses cross-origin WebSocket control', async () => {
  const server = await startServer({ apiKey: 'test-secret-never-send', preflight: async () => ({}), execute: async () => 'done' });
  try {
    const page = await (await fetch(server.url)).text();
    assert.match(page, /Start listening/); assert.ok(!page.includes('test-secret-never-send'));
    assert.equal((await fetch(`${server.url}/.env.local`)).status, 404);
    const socket = new WebSocket(server.url.replace('http:', 'ws:') + '/copilot', { origin: 'https://untrusted.example' });
    const [error] = await once(socket, 'error'); assert.match(error.message, /403/);
  } finally { await server.close(); }
});

test('local control socket rejects malformed commands without creating a Live session', async () => {
  let creates = 0;
  const server = await startServer({ apiKey: 'test', preflight: async () => ({}), execute: async () => 'done',
    client: { live: { create: async () => { creates++; throw Error('must not run'); } } } as never });
  const socket = new WebSocket(server.url.replace('http:', 'ws:') + '/copilot', { origin: server.url });
  try {
    await once(socket, 'open');
    socket.send(JSON.stringify({ type: 'connect', sdp: '' }));
    const [message] = await once(socket, 'message');
    assert.match(message.toString(), /SDP/); assert.equal(creates, 0);
  } finally { socket.close(); await server.close(); }
});


test('failed ChatGPT preflight prevents any paid model call', async () => {
  let paid = 0;
  const server = await startServer({ apiKey: 'key', preflight: async () => { throw Error('ChatGPT login required'); }, execute: async () => 'done',
    client: { live: { create: async () => { paid++; throw Error('paid'); } }, responses: { create: () => { paid++; } } } as never });
  const socket = new WebSocket(server.url.replace('http:', 'ws:') + '/copilot', { origin: server.url });
  try {
    await once(socket, 'open'); socket.send(JSON.stringify({ type: 'connect', sdp: 'v=0\r\n' }));
    await once(socket, 'message'); assert.equal(paid, 0);
  } finally { socket.close(); await server.close(); }
});

test('Live uses client delegation and only local execute handles the task', async () => {
  let paidResponses = 0, executed = 0, configuration: any;
  const server = await startServer({ apiKey: 'key', preflight: async () => ({ application: 'Lux' }), execute: async () => { executed++; return 'done'; },
    client: { live: { create: async (config: any) => { configuration = config; return { session: { id: 'live' }, transport: { type: 'webrtc', sdp: 'answer' } }; } },
      responses: { create: () => { paidResponses++; throw Error('paid delegation forbidden'); } } } as never,
    attach: ((options: any) => {
      void options.execute('Inspect Lux', new AbortController().signal);
      return { ready: Promise.resolve(), close: async () => {} };
    }) as never });
  const socket = new WebSocket(server.url.replace('http:', 'ws:') + '/copilot', { origin: server.url });
  try {
    await once(socket, 'open'); socket.send(JSON.stringify({ type: 'connect', sdp: 'v=0\r\n' }));
    await once(socket, 'message');
    assert.deepEqual(configuration.session.delegation, { type: 'client' });
    assert.equal(executed, 1); assert.equal(paidResponses, 0);
  } finally { socket.close(); await server.close(); }
});

test('Stop acknowledgement waits until Live finalization completes', async () => {
  let finish!: () => void;
  const finalization = new Promise<void>(resolve => { finish = resolve; });
  const server = await startServer({ apiKey: 'key', preflight: async () => ({}), execute: async () => 'done',
    client: { live: { create: async () => ({ session: { id: 'id' }, transport: { type: 'webrtc', sdp: 'answer' } }) } } as never,
    attach: (() => ({ ready: Promise.resolve(), close: () => finalization })) as never });
  const socket = new WebSocket(server.url.replace('http:', 'ws:') + '/copilot', { origin: server.url });
  const messages: any[] = []; socket.on('message', raw => messages.push(JSON.parse(raw.toString())));
  try {
    await once(socket, 'open'); socket.send(JSON.stringify({ type: 'connect', sdp: 'v=0\r\n' }));
    await once(socket, 'message'); socket.send(JSON.stringify({ type: 'disconnect' }));
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(messages.some(message => message.type === 'stopped'), false);
    const acknowledged = once(socket, 'message'); finish(); await acknowledged;
    assert.equal(messages.find(message => message.type === 'stopped').confirmed, true);
  } finally { finish(); socket.close(); await server.close(); }
});
