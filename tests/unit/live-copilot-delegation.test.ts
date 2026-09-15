import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDelegationHandler } from '../../tools/live-copilot/delegation.ts';
const speech = (delta: string, start_ms = 0) => ({ type: 'session.input_transcript.delta', delta, start_ms });
const delegate = (id: string) => ({ type: 'session.delegation.created', delegation: { id, target: 'client' } });
test('client delegation constructs tasks from transcript and state, returns documented commentary', async () => {
  const sent: any[] = [], tasks: string[] = [];
  const handler = createDelegationHandler({ state: { visual: 'test' }, send: e => sent.push(e),
    execute: async task => { tasks.push(task); return tasks.length === 1 ? 'Made it faster.' : 'Backed it off.'; } });
  await handler.handle(speech('Make the visual faster.'));
  await handler.handle(delegate('opaque-1'));
  await handler.handle(delegate('opaque-1'));
  await handler.handle(speech('Back it off a little.', 1000));
  await handler.handle(delegate('opaque-2'));
  assert.equal(tasks.length, 2);
  assert.match(tasks[0]!, /Make the visual faster/); assert.match(tasks[0]!, /test/);
  assert.match(tasks[1]!, /Made it faster/); assert.match(tasks[1]!, /Back it off/);
  assert.equal(sent[0].type, 'session.commentary.append'); assert.equal(sent[0].delegation_id, 'opaque-1');
  assert.equal(sent[1].content, 'Backed it off.');
});
test('missing transcript and backend failures return failure, never success', async () => {
  const sent: any[] = [];
  const handler = createDelegationHandler({ state: {}, send: e => sent.push(e), execute: async () => { throw Error('subscription limit reached'); } });
  await handler.handle(delegate('empty'));
  assert.match(sent[0].content, /No user transcript/);
  await handler.handle(speech('faster')); await handler.handle(delegate('failed'));
  assert.match(sent[1].content, /Could not confirm.*subscription limit/);
});
test('stop aborts local work and suppresses late completion', async () => {
  const sent: any[] = []; let signal!: AbortSignal; let finish!: (s: string) => void;
  const handler = createDelegationHandler({ state: {}, send: e => sent.push(e), execute: async (_task, s) => {
    signal = s; return new Promise<string>(resolve => { finish = resolve; });
  } });
  await handler.handle(speech('faster')); const pending = handler.handle(delegate('id'));
  await Promise.resolve(); handler.stop(); finish('Made it faster'); await pending;
  assert.equal(signal.aborted, true); assert.deepEqual(sent, []);
});

test('full client-delegation adapter routes a Lux task through Codex JSONL, then returns Live commentary', async () => {
  const { createCodex } = await import('../../tools/live-copilot/codex.ts');
  const sent: any[] = []; const invocations: string[][] = [];
  const codex = createCodex({ root: '.', apiKey: 'voice-key', readConfiguration: async () => ({}), run: async (args, options) => {
    invocations.push(args);
    if (args.includes('status')) return { code: 0, stdout: 'Logged in using ChatGPT', stderr: '' };
    assert.match(options.input!, /What can you change/);
    assert.equal(options.env.OPENAI_API_KEY, undefined);
    options.onEvent?.({ type: 'item.completed', item: { type: 'mcp_tool_call', server: 'lux-studio', tool: 'lux.studio.discover', status: 'completed', result: { content: [] } } });
    options.onEvent?.({ type: 'item.completed', item: { type: 'agent_message', text: '{"success":true,"summary":"I can adjust the current visual controls.","operation":"inspect","applied_tools":["lux.studio.discover"]}' } });
    options.onEvent?.({ type: 'turn.completed' });
    return { code: 0, stdout: '', stderr: '' };
  } });
  const handler = createDelegationHandler({ state: { tools: ['lux.studio.discover'] }, execute: codex.execute, send: event => sent.push(event) });
  await handler.handle(speech('What can you change in Lux?'));
  await handler.handle(delegate('client-delegation-id'));
  assert.equal(invocations.length, 2);
  assert.equal(sent[0].delegation_id, 'client-delegation-id');
  assert.equal(sent[0].content, 'I can adjust the current visual controls.');
});

test('a new delegation without a new transcript never repeats a mutation', async () => {
  let calls = 0; const sent: any[] = [];
  const handler = createDelegationHandler({ state: {}, execute: async () => { calls++; return 'Done'; }, send: e => sent.push(e) });
  await handler.handle(speech('faster')); await handler.handle(delegate('a')); await handler.handle(delegate('b'));
  assert.equal(calls, 1); assert.match(sent[1].content, /No user transcript/);
});
