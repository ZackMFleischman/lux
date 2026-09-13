import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloseConfirmation } from '../../apps/studio/src/close-confirmation.ts';
test('close confirmation deduplicates pending requests, cancels cleanly and rejects stale approvals', () => {
  const requests: string[] = []; let next = 0;
  const guard = createCloseConfirmation(() => String(++next), id => requests.push(id));
  assert.equal(guard.allowClose(false), true);
  assert.equal(guard.allowClose(true), false); assert.equal(guard.allowClose(true), false);
  assert.deepEqual(requests, ['1']);
  assert.equal(guard.reply('1', false), false);
  assert.equal(guard.allowClose(true), false);
  assert.throws(() => guard.reply('1', true), /no longer current/);
  assert.equal(guard.reply('2', true), true);
  assert.equal(guard.allowClose(true), true);
});
