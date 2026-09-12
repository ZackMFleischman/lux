import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ProducerSession } = require('../../tools/gpu-spike/producer-session.cjs');

test('shutdown retains borrowed textures until GPU completion and receiver retirement', () => {
  let completed: number[] = [];
  let closed = false, releases = 0, shutdownCalls = 0;
  const bridge = { submit: () => '{"id":1}', poll: () => JSON.stringify(completed.splice(0)),
    shutdown: () => { shutdownCalls++; return JSON.stringify({ closed }); } };
  const session = new ProducerSession(bridge);
  session.submit({ textureInfo: { handle: { ntHandle: 1 } }, release() { releases++; } });
  session.stop();
  assert.equal(session.drain(), false);
  assert.equal(shutdownCalls, 0);
  assert.equal(releases, 0);
  completed = [1];
  assert.equal(session.drain(), false);
  assert.equal(releases, 1);
  closed = true;
  assert.equal(session.drain(), true);
  assert.equal(session.drain(), true);
  assert.equal(releases, 1);
});

test('late paint is released without submitting and unknown completion fails closed', () => {
  let submissions = 0, releases = 0;
  const session = new ProducerSession({ submit() { submissions++; }, poll: () => '[99]' });
  session.stop();
  session.submit({ release() { releases++; } });
  assert.equal(submissions, 0);
  assert.equal(releases, 1);
  assert.throws(() => session.poll(), /unknown completion/);
});

test('query failure preserves leases for supervised process failure', () => {
  let releases = 0;
  const session = new ProducerSession({ submit: () => '{"id":2}', poll() { throw Error('device failed'); } });
  session.submit({ textureInfo: { handle: { ntHandle: 1 } }, release() { releases++; } });
  session.stop();
  assert.throws(() => session.drain(), /device failed/);
  assert.equal(session.held.size, 1);
  assert.equal(releases, 0);
});

test('ambiguous native acceptance never releases the submitted texture', () => {
  for (const submit of [() => { throw Error('accepted then failed'); }, () => 'malformed', () => '{"id":0}', () => '{}']) {
    let releases = 0;
    const session = new ProducerSession({ submit, poll: () => '[]', shutdown: () => '{"closed":true}' });
    assert.throws(() => session.submit({ textureInfo: { handle: { ntHandle: 1 } }, release() { releases++; } }));
    session.stop();
    assert.equal(releases, 0);
    assert.equal(session.uncertain.size, 1);
    assert.equal(session.drain(), false);
  }
});
