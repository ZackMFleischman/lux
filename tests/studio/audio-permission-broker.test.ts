import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createAudioPermissionBroker } from '../../apps/studio/src/audio/audio-permission-broker.ts';

const pageUrl = 'file:///C:/profile/studio-shell.html';
const securityOrigin = 'file://';
const requestDetails = Object.freeze({ isMainFrame: true, requestingUrl: pageUrl, securityOrigin, mediaTypes: ['audio'] });
const checkDetails = Object.freeze({ isMainFrame: true, requestingUrl: pageUrl, securityOrigin, mediaType: 'audio' });

function fixture() {
  let requestHandler: any, checkHandler: any, now = 1000, timer: (() => void) | undefined;
  const session = {
    setPermissionRequestHandler(handler: any) { requestHandler = handler; },
    setPermissionCheckHandler(handler: any) { checkHandler = handler; },
  };
  const main = new EventEmitter() as EventEmitter & { id: number; isDestroyed(): boolean };
  main.id = 1; main.isDestroyed = () => false;
  const other = new EventEmitter() as EventEmitter & { id: number; isDestroyed(): boolean };
  other.id = 2; other.isDestroyed = () => false;
  const broker = createAudioPermissionBroker({
    session, getMainWebContents: () => main, pageUrl, securityOrigin,
    now: () => now, createToken: () => 'arm-token-000001',
    setExpiry(callback: () => void) { timer = callback; return 7; },
    clearExpiry() { timer = undefined; },
  } as any);
  return {
    broker, main, other,
    request(webContents: any, permission = 'media', details: any = requestDetails) {
      let decision: boolean | undefined;
      requestHandler(webContents, permission, (allowed: boolean) => { decision = allowed; }, details);
      return decision;
    },
    check(webContents: any, permission = 'media', origin = securityOrigin, details: any = checkDetails) {
      return checkHandler(webContents, permission, origin, details);
    },
    expire() { assert.ok(timer); now = 6001; const callback = timer; timer = undefined; callback(); },
  };
}

test('fresh arm permits one exact audio request and active capture only satisfies checks', () => {
  const f = fixture();
  const arm = f.broker.arm(f.main as any);

  assert.deepEqual(arm, { token: 'arm-token-000001', expiresAtMs: 6000 });
  assert.equal(f.check(f.main), true);
  assert.equal(f.request(f.main), true);
  assert.equal(f.request(f.main), false, 'active attempt cannot authorize another request');
  assert.equal(f.broker.activate(f.main as any, arm.token), true);
  assert.equal(f.check(f.main), true);
  assert.equal(f.request(f.main), false, 'active capture still requires a fresh arm for a new request');

  f.broker.revoke(f.main as any);
  assert.equal(f.check(f.main), false);
});

test('first malformed main-window request consumes the arm and every foreign context is denied', () => {
  const f = fixture();
  f.broker.arm(f.main as any);

  assert.equal(f.request(f.main, 'media', { ...requestDetails, mediaTypes: ['audio', 'video'] }), false);
  assert.equal(f.request(f.main), false, 'a denied first attempt consumed the arm');

  f.broker.arm(f.main as any);
  assert.equal(f.request(f.other), false);
  assert.equal(f.check(f.other), false);
  assert.equal(f.check(null), false);
  assert.equal(f.check(f.main, 'media', securityOrigin, { ...checkDetails, isMainFrame: false }), false);
  assert.equal(f.check(f.main, 'media', securityOrigin, { ...checkDetails, requestingUrl: undefined }), false);
  assert.equal(f.check(f.main, 'media', securityOrigin, { ...checkDetails, mediaType: 'video' }), false);
  assert.equal(f.check(f.main, 'midi'), false);
});

test('arm expiry, navigation, renderer loss, and destruction revoke permission state', () => {
  for (const event of ['did-start-navigation', 'render-process-gone', 'destroyed']) {
    const f = fixture();
    f.broker.arm(f.main as any);
    f.main.emit(event);
    assert.equal(f.check(f.main), false, event);
  }

  const expired = fixture();
  expired.broker.arm(expired.main as any);
  expired.expire();
  assert.equal(expired.check(expired.main), false);
  assert.equal(expired.request(expired.main), false);
});

test('token-matched cancellation rejects stale activation', () => {
  const f = fixture();
  const first = f.broker.arm(f.main as any);
  assert.equal(f.request(f.main), true);
  assert.equal(f.broker.cancel(f.main as any, 'wrong-token'), false);
  assert.equal(f.broker.cancel(f.main as any, first.token), true);
  assert.equal(f.broker.activate(f.main as any, first.token), false);
  assert.equal(f.check(f.main), false);
});
