import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { studioTestEnvironment } from '../../scripts/studio-session.mjs';

test('stdio adapter registers and dispatches the complete Studio build input', async t => {
  const root = resolve(import.meta.dirname, '../..');
  const appData = await mkdtemp(join(tmpdir(), 'lux-studio-mcp-registration-'));
  const env = studioTestEnvironment({ ...process.env, APPDATA: appData });
  const client = new Client({ name: 'studio-mcp-registration-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: [join(root, 'scripts/studio-mcp.mjs')], cwd: root, env }));
  t.after(async () => {
    await client.close();
    await rm(appData, { recursive: true, force: true });
  });

  const tools = await client.listTools();
  const build = tools.tools.find(tool => tool.name === 'lux.studio.build');
  assert.ok(build);
  assert.equal(build.inputSchema.type, 'object');
  assert.deepEqual(build.inputSchema.required, ['expectedDraftVersion']);
  assert.deepEqual(Object.keys(build.inputSchema.properties).sort(),
    ['document', 'expectedDraftVersion', 'libraryLinks', 'source', 'story']);

  const result = await client.callTool({ name: 'lux.studio.build', arguments: {
    expectedDraftVersion: 0,
    source: { sdkVersion: '0.2.0', entry: 'visual.ts', files: {
      'visual.ts': 'export default { create() { return {}; } };',
    } },
  } });
  assert.equal(result.isError, true);
  const message = result.content.map(item => item.type === 'text' ? item.text : '').join('\n');
  assert.match(message, /ENOENT|no such file|endpoint/i);
  assert.doesNotMatch(message, /expectedDraftVersion|invalid.*arguments|invalid input/i);
});
