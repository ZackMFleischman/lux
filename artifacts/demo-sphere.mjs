import fs from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const root = 'C:/Users/zFlei/repos/lux/.worktrees/tracer';
const scene = JSON.parse(await fs.readFile('C:/Users/zFlei/repos/lux/.worktrees/parameter-integration/artifacts/studio-parameters/sphere.lux-scene', 'utf8'));
const client = new Client({ name: 'lux-demo-setup', version: '1.0.0' });
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [root + '/scripts/studio-mcp.mjs'], cwd: root }));
  const call = async (name, args = {}) => {
    const response = await client.callTool({ name: 'lux.studio.' + name, arguments: args }, undefined, { timeout: 75000 });
    if (response.isError) throw Error(JSON.stringify(response));
    return JSON.parse(response.content.find(item => item.type === 'text').text);
  };
  const discovery = await call('discover');
  if (!discovery.runningStudio.compatible) throw Error('Studio adapter mismatch');
  const before = await call('read');
  const built = await call('build', { expectedDraftVersion: before.draftVersion, source: scene.source });
  const state = built.status.authoring;
  await call('parameters', { instanceId: state.instanceId, expectedGeneration: state.generation, expectedRevisionId: state.revisionId, expectedControlSchemaHash: state.controlSchemaHash, values: scene.controls.values });
  await call('playback', { instanceId: state.instanceId, expectedGeneration: state.generation, action: 'play' });
  const status = await call('status');
  console.log(JSON.stringify({ ready: true, playback: status.authoring.playback, controls: status.authoring.controls }));
} finally { await client.close(); }
