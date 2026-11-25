import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'smol-toml';
import { sanitizeEnvironment, requireChatGPT, validateRouting, createCodex, enforcedConfig } from '../../tools/live-copilot/codex.ts';

test('software summaries require completed execution evidence', async () => {
  let item: any;
  const codex = createCodex({ root: '.', apiKey: '', readConfiguration: async () => ({}), run: async (args, options) => {
    if (args.includes('status')) return { code: 0, stdout: 'Logged in using ChatGPT', stderr: '' };
    if (item) options.onEvent?.({ type: 'item.completed', item });
    options.onEvent?.({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ success: true, summary: 'Verified file.', operation: 'software', applied_tools: [] }) } });
    options.onEvent?.({ type: 'turn.completed' });
    return { code: 0, stdout: '', stderr: '' };
  } });
  for (item of [undefined, { type: 'command_execution', status: 'completed', exit_code: 1 }, { type: 'file_change', status: 'failed' }]) {
    await assert.rejects(codex.execute('Write a file', new AbortController().signal), /Required tool evidence/);
  }
  for (item of [{ type: 'command_execution', status: 'completed', exit_code: 0 }, { type: 'file_change', status: 'completed' }]) {
    assert.equal(await codex.execute('Write a file', new AbortController().signal), 'Verified file.');
  }
});

test('all Lux tools are preapproved with workspace writes and unchanged other server permissions', () => {
  const settings = parse(enforcedConfig.filter((_value, index) => index % 2 === 1).join('\n')) as any;
  assert.equal(settings.forced_login_method, 'chatgpt');
  assert.equal(settings.model_provider, 'openai');
  assert.equal(settings.approval_policy, undefined);
  assert.equal(settings.sandbox_mode, 'workspace-write');
  assert.deepEqual(settings.mcp_servers, { 'lux-studio': { default_tools_approval_mode: 'approve' } });
});

test('saved per-tool prompts are overridden using exact canonical names', async () => {
  let settings: any;
  const codex = createCodex({ root: process.cwd(), apiKey: '', readConfiguration: async () => ({
    mcp_servers: { 'lux-studio': { tools: { 'lux.studio.status': { approval_mode: 'prompt' } } } },
  }), run: async (args) => {
    settings = parse(args.slice(0, -2).filter((_v, i) => i % 2 === 1).join('\n'));
    return { code: 0, stdout: 'Logged in using ChatGPT', stderr: '' };
  } });
  await codex.verify();
  assert.equal(settings.mcp_servers['lux-studio'].tools['lux.studio.status'].approval_mode, 'approve');
});

test('filtered Lux tool configuration fails clearly before opening a session', async () => {
  for (const filter of [{ enabled_tools: ['lux.studio.status'] }, { disabled_tools: ['lux.studio.build'] }]) {
    const codex = createCodex({ root: '.', apiKey: '', readConfiguration: async () => ({ mcp_servers: { 'lux-studio': filter } }),
      run: async () => { throw Error('must fail before invocation'); } });
    await assert.rejects(codex.verify(), /Remove that Lux-only filter/);
  }
});

test('authentication requires an affirmative ChatGPT status, not just exit zero', () => {
  requireChatGPT({ code: 0, stdout: '', stderr: 'Logged in using ChatGPT\n' });
  for (const result of [
    { code: 0, stdout: 'Logged in using an API key', stderr: '' },
    { code: 1, stdout: '', stderr: 'Not logged in' },
    { code: 0, stdout: '', stderr: '' },
  ]) assert.throws(() => requireChatGPT(result), /codex login status[\s\S]*codex logout[\s\S]*codex login/);
});
test('Codex environment loses all key aliases while preserving login access', () => {
  assert.deepEqual(sanitizeEnvironment({ OPENAI_API_KEY: 'voice-secret', codex_api_key: 'other',
    LUX_VOICE_TOKEN: 'Bearer voice-secret', USERPROFILE: 'user', APPDATA: 'app', CODEX_HOME: 'home', PATH: 'path' }, 'voice-secret'),
  { USERPROFILE: 'user', APPDATA: 'app', CODEX_HOME: 'home', PATH: 'path' });
});
test('incompatible authentication and provider routing fail closed', () => {
  validateRouting({}, {});
  for (const config of [{ forced_login_method: 'api' }, { model_provider: 'custom' },
    { openai_base_url: 'https://other' }, { model_providers: { openai: {} } }, { profile: 'custom' }]) {
    assert.throws(() => validateRouting(config, {}), /Codex configuration/);
  }
  assert.throws(() => validateRouting({}, { OPENAI_BASE_URL: 'https://other' }), /OPENAI_BASE_URL/);
  assert.throws(() => validateRouting({ shell_environment_policy: { set: { LUX_KEY: 'voice-secret' } } }, {}, 'voice-secret'), /stored environment/);
  assert.throws(() => validateRouting({ mcp_servers: { lux: { env: { CODEX_API_KEY: 'key' } } } }, {}), /stored environment/);
});
test('delegation enforces config and rejects subscription limits without a fallback', async () => {
  const calls: any[] = [];
  const codex = createCodex({ root: '.', apiKey: 'voice-secret', env: { OPENAI_API_KEY: 'voice-secret' },
    readConfiguration: async () => ({}), run: async (args, options) => {
      calls.push({ args, options });
      if (args.includes('status')) return { code: 0, stdout: '', stderr: 'Logged in using ChatGPT' };
      options.onEvent?.({ type: 'turn.failed', error: { message: 'You have hit your usage limit' } });
      return { code: 1, stdout: '', stderr: '' };
    } });
  await assert.rejects(codex.execute('Make it faster', new AbortController().signal), /subscription.*limit/i);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.deepEqual(call.args.slice(0, enforcedConfig.length), enforcedConfig);
    assert.equal(call.options.env.OPENAI_API_KEY, undefined);
    assert.ok(!call.args.includes('--last'));
    assert.ok(!call.args.some((x: string) => x.includes('bypass') || x === '--approve-for-me'));
  }
});
test('complete Codex adapter accepts an MCP-backed result, rejects incomplete turns', async () => {
  let complete = true;
  const logs: string[] = [];
  const codex = createCodex({ root: '.', apiKey: 'key', readConfiguration: async () => ({}), log: s => logs.push(s),
    run: async (args, options) => {
      if (args.includes('status')) return { code: 0, stdout: 'Logged in using ChatGPT', stderr: '' };
      options.onEvent?.({ type: 'item.completed', item: { type: 'mcp_tool_call', server: 'lux-studio', tool: 'lux.studio.status', status: 'completed', result: { content: [] } } });
      options.onEvent?.({ type: 'item.completed', item: { type: 'agent_message', text: '{"success":true,"summary":"Lux is running.","operation":"inspect","applied_tools":["mcp__lux_studio__lux_studio_status"]}' } });
      if (complete) options.onEvent?.({ type: 'turn.completed' });
      return { code: 0, stdout: '', stderr: '' };
    } });
  assert.equal(await codex.execute('Inspect Lux', new AbortController().signal), 'Lux is running.');
  assert.match(logs.join('\n'), /lux.studio.status/);
  complete = false;
  await assert.rejects(codex.execute('Inspect Lux', new AbortController().signal), /incomplete/i);
});

test('expired authentication and unavailable models fail without another invocation', async () => {
  for (const message of ['401 authentication token expired', 'model not found']) {
    let tasks = 0;
    const codex = createCodex({ root: '.', apiKey: 'key', readConfiguration: async () => ({}), run: async (args, options) => {
      if (args.includes('status')) return { code: 0, stdout: 'Logged in using ChatGPT', stderr: '' };
      tasks++; options.onEvent?.({ type: 'turn.failed', error: { message } });
      return { code: 1, stdout: '', stderr: '' };
    } });
    await assert.rejects(codex.execute('Inspect Lux', new AbortController().signal), /authentication failed|model is unavailable/);
    assert.equal(tasks, 1);
  }
});


test('a status read cannot support a claimed change; a completed mutation can', async () => {
  let tool = 'lux.studio.status';
  const codex = createCodex({ root: '.', apiKey: 'key', readConfiguration: async () => ({}), run: async (args, options) => {
    if (args.includes('status')) return { code: 0, stdout: 'Logged in using ChatGPT', stderr: '' };
    options.onEvent?.({ type: 'item.completed', item: { type: 'mcp_tool_call', server: 'lux-studio', tool, status: 'completed', result: { content: [] } } });
    options.onEvent?.({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ success: true, summary: 'Made it faster.', operation: 'change', applied_tools: [tool] }) } });
    options.onEvent?.({ type: 'turn.completed' });
    return { code: 0, stdout: '', stderr: '' };
  } });
  await assert.rejects(codex.execute('faster', new AbortController().signal), /Required tool evidence/);
  tool = 'lux.studio.parameters';
  assert.equal(await codex.execute('faster', new AbortController().signal), 'Made it faster.');
});
