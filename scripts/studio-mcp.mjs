import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { sourceBuildInputSchema, sourceReadResult,libraryCreateInputSchema,libraryReadInputSchema,libraryUpdateInputSchema,sceneSaveInputSchema,sceneOpenInputSchema } from '../apps/studio/src/source/agent-contract.ts';
import { assetLimits } from '../packages/assets/src/index.mjs';
import { resolve } from 'node:path';
import { createStudioConnection, resolveStudioSession, studioAppData } from './studio-session.mjs';
import { createLibraryContext, resolveMcpStandardLibrary } from './studio-library-context.mjs';
import { discoverVisualSdk } from '../packages/visual-sdk/src/discovery.mjs';
import { parameterInputSchema,nodeVariationInputSchema, playbackInputSchema, restartInputSchema,tempoSetInputSchema,tempoTapInputSchema } from '../apps/studio/src/runtime-operations.ts';
import {supportsManualTapTempoCapability} from '../apps/studio/src/capabilities.ts';
const selectedSession = resolveStudioSession({ workspace: resolve(import.meta.dirname, '..') });
let libraryContext;
try { libraryContext = createLibraryContext(await resolveMcpStandardLibrary({ workspace: selectedSession.workspace,
  profile: selectedSession.profile, env: process.env, appData: studioAppData(process.env) })); }
catch (error) { libraryContext = createLibraryContext(null, error); }
const server = new McpServer({ name: 'lux-studio', version: '0.1.0' },
  { instructions: libraryContext.instructions(await libraryContext.catalog()) });
const call = createStudioConnection(selectedSession);
const text = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
async function requireTempoCapability(){const status=await call('status');if(!supportsManualTapTempoCapability(status.capabilities))throw Error('Running Studio does not support manual/tap tempo from 20 through 300 BPM; restart from the matching checkout before sending tempo operations.');}
async function requireVariationCapability(){const status=await call('status');if(status.capabilities?.controlVariation?.stableInstanceKeys!==true)throw Error('Running Studio does not support per-instance control variation; restart from the matching checkout before configuring it.');}
async function runningStudio() {
  try { const status = await call('status'); return { connected: true, studioSession: status.studioSession, capabilities: status.capabilities ?? null,
    compatible: status.capabilities?.codeDeclaredParameters === true && status.capabilities?.supportedSdkVersions?.includes('0.4.0'),
    advice: status.capabilities?.codeDeclaredParameters && status.capabilities?.supportedSdkVersions?.includes('0.4.0') ? undefined : 'Running Studio predates this adapter; restart from the matching checkout before using SDK 0.4 composition.' }; }
  catch (error) { return { connected: false, compatible: false,
    selectedSession: { profile: selectedSession.profile, workspace: selectedSession.workspace },
    advice: `Use the same Studio profile and checkout; reconnect the adapter after replacing Studio. ${error.message}` }; }
}
server.registerTool('lux.studio.discover', { description: 'Read the exact visual SDK, example and standalone Lux capabilities. Start Lux Studio separately.', inputSchema: {} }, async () => text({ ...await discoverVisualSdk(), scope: 'standalone-studio', tools: ['read', 'build', 'save', 'open', 'capture', 'status', 'parameters', 'variation', 'playback', 'restart','tempo.set','tempo.tap','library.list','library.read','library.create','library.update'], resolume: false,
  libraryCatalog: await libraryContext.catalog(),
  runningStudio: await runningStudio(),
  parameters: { kinds: ['number'], declaredInCode: true, requiredGuard: 'expectedControlSchemaHash from current runtime status', implicitControls: false,
    composition: 'SDK 0.4 supports image-chain-v1 and typed-image-graph-v1 (image, paths2d and shader-field ports, acyclic fan-out). Selected leaf controls are public aliases; values remain owned by stable node identity.' },
  sourceDocuments: { versions: [1, 2], replacement: 'complete source; preserve sourceVersion and assets when editing v2',
    assetPlayback: true, assetExport: true, assetFormats: ['image/bmp', 'image/png', 'image/jpeg'], decodedImages: 'context.images: top-down sRGB straight-alpha RGBA' , assetDimension: assetLimits.dimension, assetCount: assetLimits.count,
    assetFileBytes: assetLimits.imageBytes, assetTotalBytes: assetLimits.totalBytes,
    sourceV2JsonBytes: 6291456, requestBytes: 8388608, readToolResultBytes: 16777216 } }));
server.registerTool('lux.studio.read', { description: 'Read complete source and draft version before changing it. Preserve sourceVersion and all assets when editing v2. The complete escaped tool result is limited to 16 MiB.', inputSchema: {} }, async () => sourceReadResult(await call('read')));
server.registerTool('lux.studio.status', { description: 'Read actual standalone preview status.', inputSchema: {} }, async () => text(await call('status')));
server.registerTool('lux.studio.build', { description: 'Compile and preview replacement source. Read first; expectedDraftVersion prevents overwriting intervening edits. Failed builds retain the working preview.',
  inputSchema: sourceBuildInputSchema.shape }, async input => text(await call('build', input)));
server.registerTool('lux.studio.save',{description:'Save the current scene to an explicit .lux-scene path. Read first and pass expectedDraftVersion. Existing paths require overwrite:true; external file changes remain protected.',inputSchema:sceneSaveInputSchema.shape},async input=>text(await call('scene.save',input)));
server.registerTool('lux.studio.open',{description:'Open an explicit .lux-scene path. Read first and pass expectedDraftVersion. Dirty source, controls, or library links require discardDirty:true; invalid scenes retain the current draft and preview.',inputSchema:sceneOpenInputSchema.shape},async input=>text(await call('scene.open',input)));
server.registerTool('lux.library.list',{description:'Explicitly refresh shared component metadata; the compact catalog is already supplied in server instructions and discovery.',inputSchema:{}},async()=>text(await call('library.list')));
server.registerTool('lux.library.read',{description:'Read one shared component, its own source and pinned Library dependencies. Omit revision for latest, or read an exact immutable revision.',inputSchema:libraryReadInputSchema.shape},async input=>text(await call('library.read',input)));
server.registerTool('lux.library.create',{description:'Validate an image/paths2d/shader-field component or SDK 0.4 composition, then publish its own source and optional pinned dependencies to the shared Library at revision 1.',inputSchema:libraryCreateInputSchema.shape},async input=>text(await libraryContext.attach(await call('library.create',input))));
server.registerTool('lux.library.update',{description:'Validate and build a complete replacement, then update one standard shared entry only when expectedRevision matches.',inputSchema:libraryUpdateInputSchema.shape},async input=>text(await libraryContext.attach(await call('library.update',input))));
server.registerTool('lux.studio.capture', { description: 'Return an actual PNG at the current Preview render size, with frame, controls and revision metadata. MCP does not change Preview resolution.', inputSchema: {} }, async () => {
  const result = await call('capture'); return { content: [{ type: 'image', mimeType: 'image/png', data: result.base64 }, { type: 'text', text: JSON.stringify(result.metadata) }] };
});
for (const [method, schema, description] of [
  ['parameters', parameterInputSchema, 'Set a partial map of code-defined numeric parameters. Read status for controlSchema IDs/ranges, instance, generation, revision and expectedControlSchemaHash guards. Returns actual applied frame state; live mode only.'],
  ['playback', playbackInputSchema, 'Play, pause or reset the Studio runtime using current instance and generation guards. Reset preserves playing/paused state. Returns applied state.'],
  ['restart', restartInputSchema, 'Restart the Studio runtime using current instance and generation guards. Retains source and controls; returns replacement runtime state.'],
]) server.registerTool(`lux.studio.${method}`, { description, inputSchema: schema.shape }, async input => text(await call(method, input)));
server.registerTool('lux.studio.variation',{description:'Configure or remove stable per-instance variation for one numeric control. Read status first for nodePath, controlId and runtime guards. Amount is a symmetric range around the current base; distribution is random, centered, or spread. Pass variation:null to remove it.',inputSchema:nodeVariationInputSchema.shape},async input=>{await requireVariationCapability();return text(await call('variation',input));});
server.registerTool('lux.studio.tempo.set',{description:'Set manual scene tempo from 20 through 300 BPM using current runtime identity and revision guards. Preserves beat phase and returns the acknowledged tempo result.',inputSchema:tempoSetInputSchema.shape},async input=>{await requireTempoCapability();return text(await call('tempo.set',input));});
server.registerTool('lux.studio.tempo.tap',{description:'Tap scene tempo using the running Studio monotonic clock and current runtime identity and revision guards. Returns accepted, restarted, or ignored-short.',inputSchema:tempoTapInputSchema.shape},async input=>{await requireTempoCapability();return text(await call('tempo.tap',input));});
await server.connect(new StdioServerTransport());
