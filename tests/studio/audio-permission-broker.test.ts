import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createAudioPermissionBroker } from '../../apps/studio/src/audio/audio-permission-broker.ts';

const pageUrl = 'file:///C:/profile/studio-shell.html';
const securityOrigin = 'file:///';
const requestDetails = Object.freeze({ isMainFrame: true, requestingUrl: pageUrl, securityOrigin, mediaTypes: ['audio'] });
const checkDetails = Object.freeze({ isMainFrame: true, requestingUrl: '', embeddingOrigin: securityOrigin, mediaType: 'audio' });
const originCheckDetails = Object.freeze({ isMainFrame: true, requestingUrl: pageUrl, securityOrigin, mediaType: 'audio' });
const postRequestCheckDetails = Object.freeze({ isMainFrame: true, requestingUrl: pageUrl, embeddingOrigin: securityOrigin });

function fixture() {
  let requestHandler: any, checkHandler: any, now = 1000, timer: (() => void) | undefined;
  const reports:any[]=[];
  const session = {
    setPermissionRequestHandler(handler: any) { requestHandler = handler; },
    setPermissionCheckHandler(handler: any) { checkHandler = handler; },
  };
  const main = new EventEmitter() as EventEmitter & { id: number; isDestroyed(): boolean };
  main.id = 1; main.isDestroyed = () => false; (main as any).getURL = () => pageUrl;
  const other = new EventEmitter() as EventEmitter & { id: number; isDestroyed(): boolean };
  other.id = 2; other.isDestroyed = () => false; (other as any).getURL = () => pageUrl;
  const broker = createAudioPermissionBroker({
    session, getMainWebContents: () => main, pageUrl, securityOrigin,
    diagnostic:(details:any)=>reports.push(details),
    now: () => now, createToken: () => 'arm-token-000001',
    setExpiry(callback: () => void) { timer = callback; return 7; },
    clearExpiry() { timer = undefined; },
  } as any);
  return {
    broker, main, other,reports,
    request(webContents: any, permission = 'media', details: any = requestDetails) {
      let decision: boolean | undefined;
      requestHandler(webContents, permission, (allowed: boolean) => { decision = allowed; }, details);
      return decision;
    },
    check(webContents: any, permission = 'media', origin = '', details: any = checkDetails) {
      return checkHandler(webContents, permission, origin, details);
    },
    advance(milliseconds:number){now+=milliseconds;},
    pendingExpiry(){return timer;},
    expire() { assert.ok(timer); now = 6001; const callback = timer; timer = undefined; callback(); },
  };
}

test('fresh arm permits one exact audio request and active capture only satisfies checks', () => {
  const f = fixture();
  const arm = f.broker.arm(f.main as any);

  assert.deepEqual(arm, { token: 'arm-token-000001', expiresAtMs: 6000 });
  assert.equal(f.check(f.main), false,'an armed intent must not bypass the exact request handler');
  assert.equal(f.check(f.main, 'media', securityOrigin, originCheckDetails), false);
  assert.equal(f.check(f.main, 'media', securityOrigin, postRequestCheckDetails), false, 'capture continuation requires an exact allowed request');
  assert.equal(f.request(f.main), true);
  assert.equal(f.check(f.main, 'media', securityOrigin, postRequestCheckDetails), true);
  assert.equal(f.request(f.main), false, 'active attempt cannot authorize another request');
  assert.equal(f.broker.activate(f.main as any, arm.token), true);
  assert.equal(f.check(f.main), true);
  assert.equal(f.request(f.main), false, 'active capture still requires a fresh arm for a new request');

  f.broker.revoke(f.main as any);
  assert.equal(f.check(f.main), false);
});

test('discovery arm permits exact audio enumeration checks without permitting capture', () => {
  const f = fixture();
  const arm = f.broker.discover(f.main as any);

  assert.deepEqual(arm, { token: 'arm-token-000001', expiresAtMs: 6000 });
  assert.equal(f.check(f.main), true);
  assert.equal(f.check(f.main, 'media', securityOrigin, originCheckDetails), true);
  assert.equal(f.check(f.main, 'media', securityOrigin, postRequestCheckDetails), false);
  assert.equal(f.request(f.main), false, 'discovery cannot authorize media capture');
  assert.equal(f.check(f.main), false, 'a denied capture consumes the discovery arm');
});

test('a timely accepted audio request can finish after the intent deadline without admitting a second request', () => {
  const f=fixture(),arm=f.broker.arm(f.main as any),staleTimer=f.pendingExpiry()!;
  assert.equal(f.request(f.main),true);f.advance(9000);staleTimer();
  assert.equal(f.check(f.main,'media',securityOrigin,postRequestCheckDetails),true);
  assert.equal(f.check(f.main),false,'an in-flight attempt is not a cached grant for a new capture');
  assert.equal(f.request(f.main),false);
  assert.equal(f.broker.activate(f.main as any,arm.token),true);
  assert.deepEqual(f.reports.at(-1),{stage:'active',code:'capture-activated',elapsedMs:9000,attemptMs:9000});
  assert.doesNotMatch(JSON.stringify(f.reports),/arm-token|deviceId/);
  assert.equal(f.check(f.main),true);
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
  assert.equal(f.check(f.main, 'media', '', { ...checkDetails, isMainFrame: false }), false);
  assert.equal(f.check(f.main, 'media', '', { ...checkDetails, requestingUrl: undefined }), false);
  assert.equal(f.check(f.main, 'media', '', { ...checkDetails, embeddingOrigin: 'file://wrong' }), false);
  assert.equal(f.check(f.main, 'media', '', { ...checkDetails, mediaType: 'video' }), false);
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


test('accepted requests still revoke before late completion on cancel, navigation, loss, or destruction',()=>{
 for(const event of ['did-start-navigation','render-process-gone','destroyed','cancel']){
  const f=fixture(),arm=f.broker.arm(f.main as any);assert.equal(f.request(f.main),true);f.advance(9000);
  if(event==='cancel')f.broker.cancel(f.main as any,arm.token);else f.main.emit(event);
  assert.equal(f.broker.activate(f.main as any,arm.token),false,event);assert.equal(f.check(f.main),false,event);
 }
});


test('late unconsumed intent cannot capture and successful completion rechecks exact page identity',()=>{
 const expired=fixture();expired.broker.arm(expired.main as any);expired.advance(9000);assert.equal(expired.request(expired.main),false);assert.equal(expired.reports.at(-1).code,'intent-expired');
 const moved=fixture(),arm=moved.broker.arm(moved.main as any);assert.equal(moved.request(moved.main),true);(moved.main as any).getURL=()=>pageUrl+'?changed';
 assert.equal(moved.broker.activate(moved.main as any,arm.token),false);assert.equal(moved.reports.at(-1).code,'activation-context-rejected');
});


test('an admitted but unsettled capture has a separate bounded deadline',()=>{
 const f=fixture(),arm=f.broker.arm(f.main as any);assert.equal(f.request(f.main),true);f.advance(60001);
 assert.equal(f.check(f.main,'media',securityOrigin,postRequestCheckDetails),false);
 assert.equal(f.broker.activate(f.main as any,arm.token),false);assert.ok(f.reports.some(row=>row.code==='attempt-expired'));
});
