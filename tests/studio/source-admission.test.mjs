import test from 'node:test';
import assert from 'node:assert/strict';
import { workerFactory } from './fixtures/admission-worker-factory.mjs';
import * as admission from '../../apps/studio/src/source/admission.mjs';
const red = 'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA==';
const source = (data = red) => ({sourceVersion:2,sdkVersion:'0.1.0',entry:'main.ts',files:{'main.ts':'export {}'},assets:{'assets/red.bmp':{mediaType:'image/bmp',encoding:'base64',data}}});

test('owned text edits reuse frozen assets without reinterpreting image headers', () => {
  assert.equal(typeof admission.createSourceAdmissionSession,'function');
  const session = admission.createSourceAdmissionSession(), owned = session.admit(source());
  const OriginalDataView = globalThis.DataView;
  try {
    globalThis.DataView = class { constructor() { throw Error('image decoding disabled'); } };
    const next = session.edit(owned,{'main.ts':'changed'});
    assert.equal(next.assets,owned.assets); assert.equal(next.files['main.ts'],'changed');
    assert.throws(()=>session.admit({...next}),/image decoding disabled/);
  } finally { globalThis.DataView = OriginalDataView; }
  assert.throws(()=>session.edit(JSON.parse(JSON.stringify(owned)),owned.files),/owned/);
  assert.throws(()=>admission.createSourceAdmissionSession().edit(owned,owned.files),/owned/);
  assert.throws(()=>session.edit(owned,{'../bad.ts':'bad'}));
});

test('real asynchronous worker fully admits bytes and isolates caller mutations', async () => {
  const session = admission.createSourceAdmissionSession(), factory = workerFactory(), input = source();
  const pending = session.admitAsync(input,factory);
  input.assets['assets/red.bmp'].data = 'mutated after dispatch';
  const owned = await pending;
  assert.equal(owned.assets['assets/red.bmp'].data,red);
  assert.equal(session.edit(owned,{'main.ts':'changed'}).assets,owned.assets);
  assert.throws(()=>{owned.files['main.ts']='bad';});
  assert.equal(factory.created[0].terminated,true); await factory.created[0].exited;
  await assert.rejects(session.admitAsync(source('AA=='),factory),{code:'SOURCE_BOUNDARY_VIOLATION'});
  assert.equal(factory.created[1].terminated,true); await factory.created[1].exited;
});

test('timeouts, worker failures and forged responses terminate without creating trusted sources', async () => {
  for (const mode of ['hang','wrong-id','forged-token','error']) {
    const session = admission.createSourceAdmissionSession(), factory = workerFactory(mode);
    await assert.rejects(session.admitAsync(source(),factory,mode === 'hang' ? 100 : 2000));
    assert.equal(factory.created.length,1); assert.equal(factory.created[0].terminated,true); await factory.created[0].exited;
  }
  const session = admission.createSourceAdmissionSession(), factory = workerFactory('hang');
  for (const timeout of [0,5001,1.5,NaN]) await assert.rejects(session.admitAsync(source(),factory,timeout));
  assert.equal(factory.created.length,0);
  const pending = session.admitAsync(source(),factory,100);
  await assert.rejects(session.admitAsync(source(),factory,100),/busy/);
  await assert.rejects(pending); await factory.created[0].exited;
});
