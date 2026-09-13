import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { sourceBuildInputSchema, sourceReadResult } from '../apps/studio/src/source/agent-contract.ts';
import { assetLimits } from '../packages/assets/src/index.mjs';
import { resolve } from 'node:path';
import { createStudioConnection, resolveStudioSession } from './studio-session.mjs';
import { discoverVisualSdk } from '../packages/visual-sdk/src/discovery.mjs';
import { parameterInputSchema, playbackInputSchema, restartInputSchema } from '../apps/studio/src/runtime-operations.ts';
const server = new McpServer({ name: 'lux-studio', version: '0.1.0' });
const selectedSession = resolveStudioSession({ workspace: resolve(import.meta.dirname, '..') });
const call = createStudioConnection(selectedSession);
const text = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
async function runningStudio() {
  try { const status = await call('status'); return { connected: true, studioSession: status.studioSession, capabilities: status.capabilities ?? null,
    compatible: status.capabilities?.codeDeclaredParameters === true,
    advice: status.capabilities?.codeDeclaredParameters ? undefined : 'Running Studio predates this adapter; restart from the matching checkout before using SDK 0.2.' }; }
  catch (error) { return { connected: false, compatible: false,
    selectedSession: { profile: selectedSession.profile, workspace: selectedSession.workspace },
    advice: `Use the same Studio profile and checkout; reconnect the adapter after replacing Studio. ${error.message}` }; }
}
server.registerTool('lux.studio.discover', { description: 'Read the exact visual SDK, example and standalone Lux capabilities. Start Lux Studio separately.', inputSchema: {} }, async () => text({ ...await discoverVisualSdk(), scope: 'standalone-studio', tools: ['read', 'build', 'capture', 'status', 'parameters', 'playback', 'restart'], resolume: false,
  runningStudio: await runningStudio(),
  parameters: { kinds: ['number'], maxCount: 32, declaredInCode: true, requiredGuard: 'expectedControlSchemaHash from current runtime status', implicitControls: false },
  sourceDocuments: { versions: [1, 2], replacement: 'complete source; preserve sourceVersion and assets when editing v2',
    assetPlayback: true, assetExport: true, assetFormats: ['image/bmp', 'image/png', 'image/jpeg'], decodedImages: 'context.images: top-down sRGB straight-alpha RGBA' , assetDimension: assetLimits.dimension, assetCount: assetLimits.count,
    assetFileBytes: assetLimits.imageBytes, assetTotalBytes: assetLimits.totalBytes,
    sourceV2JsonBytes: 6291456, requestBytes: 8388608, readToolResultBytes: 16777216 } }));
server.registerTool('lux.studio.read', { description: 'Read complete source and draft version before changing it. Preserve sourceVersion and all assets when editing v2. The complete escaped tool result is limited to 16 MiB.', inputSchema: {} }, async () => sourceReadResult(await call('read')));
server.registerTool('lux.studio.status', { description: 'Read actual standalone preview status.', inputSchema: {} }, async () => text(await call('status')));
server.registerTool('lux.studio.build', { description: 'Compile and preview replacement source. Read first; expectedDraftVersion prevents overwriting intervening edits. Failed builds retain the working preview.',
  inputSchema: sourceBuildInputSchema.shape }, async input => text(await call('build', input)));
server.registerTool('lux.studio.capture', { description: 'Return an actual 1920x1080 PNG from Lux with its frame, controls and revision metadata.', inputSchema: {} }, async () => {
  const result = await call('capture'); return { content: [{ type: 'image', mimeType: 'image/png', data: result.base64 }, { type: 'text', text: JSON.stringify(result.metadata) }] };
});
for (const [method, schema, description] of [
  ['parameters', parameterInputSchema, 'Set a partial map of code-defined numeric parameters. Read status for controlSchema IDs/ranges, instance, generation, revision and expectedControlSchemaHash guards. Returns actual applied frame state; live mode only.'],
  ['playback', playbackInputSchema, 'Play, pause or reset the Studio runtime using current instance and generation guards. Reset preserves playing/paused state. Returns applied state.'],
  ['restart', restartInputSchema, 'Restart the Studio runtime using current instance and generation guards. Retains source and controls; returns replacement runtime state.'],
]) server.registerTool(`lux.studio.${method}`, { description, inputSchema: schema.shape }, async input => text(await call(method, input)));
await server.connect(new StdioServerTransport());
