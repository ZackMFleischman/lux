import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { attachLive } from '../../tools/live-copilot/live.ts';

function fakeSocket() {
  const ws = new EventEmitter() as any;
  ws.socket = new EventEmitter(); ws.socket.readyState = 1;
  ws.socket.platformSocket = { terminate() { ws.socket.emit('close'); } };
  ws.sent = []; ws.send = (e: unknown) => ws.sent.push(e);
  ws.close = () => ws.socket.emit('close');
  return ws;
}
test('sideband attaches without restarting the session and finalizes once', async () => {
  const ws = fakeSocket();
  const live = attachLive({ client: {} as never, sessionId: 'opaque-session-id', execute: async () => 'done', state: {},
    onFailure: e => { throw e; }, onEnded() {}, driver: ws });
  ws.socket.emit('open'); await live.ready;
  assert.equal(ws.sent.length, 0);
  const closing = live.close(); const twice = live.close();
  assert.equal(ws.sent.filter((e: any) => e.type === 'session.close').length, 1);
  ws.emit('event', { type: 'session.closed' }); await Promise.all([closing, twice]);
});
test('closing during attachment promptly terminates the socket', async () => {
  const ws = fakeSocket(); ws.socket.readyState = 0;
  const live = attachLive({ client: {} as never, sessionId: 'id', execute: async () => 'done', state: {},
    onFailure() {}, onEnded() {}, driver: ws });
  await assert.rejects(live.close(), /unconfirmed|confirmed/); await assert.rejects(live.ready, /closed/);
  assert.equal(ws.sent.length, 0);
});
test('unexpected sideband loss reports failure and never replays work', async () => {
  const ws = fakeSocket(); const errors: Error[] = [];
  const live = attachLive({ client: {} as never, sessionId: 'id', execute: async () => 'done', state: {},
    onFailure: e => errors.push(e), onEnded() {}, driver: ws });
  ws.socket.emit('close'); await assert.rejects(live.ready, /closed/);
  assert.equal(errors.length, 1); await assert.rejects(live.close(), /confirmation/);
});


