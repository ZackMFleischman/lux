import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import { sourceBuildInputObjectSchema,sourceBuildInputSchema,sourceReadResult,libraryCreateInputSchema,libraryReadInputSchema,libraryUpdateInputSchema,sceneSaveInputSchema,sceneOpenInputSchema,agentTransportLimits } from '../apps/studio/src/source/agent-contract.ts';
import { assetLimits } from '../packages/assets/src/index.mjs';
import { resolve } from 'node:path';
import { createStudioConnection, resolveStudioSession, studioAppData } from './studio-session.mjs';
import { createLibraryContext, resolveMcpStandardLibrary } from './studio-library-context.mjs';
import { discoverVisualSdk } from '../packages/visual-sdk/src/discovery.mjs';
import { parameterInputSchema,triggerInputSchema,nodeVariationInputSchema, playbackInputSchema, restartInputSchema,tempoSetInputSchema,tempoTapInputSchema,storyTransportInputSchema } from '../apps/studio/src/runtime-operations.ts';
import {supportsControlTriggersCapability,supportsManualTapTempoCapability,supportsStoryCapability} from '../apps/studio/src/capabilities.ts';
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
async function requireTriggerCapability(){const status=await call('status');if(!supportsControlTriggersCapability(status.capabilities))throw Error('Running Studio does not support acknowledged trigger actions. Use the adapter and Studio from the same build.');}
async function requireStoryCapability(){const status=await call('status');if(!supportsStoryCapability(status.capabilities))throw Error('Running Studio does not support Story playback. Use the adapter and Studio from the same build.');}
async function requireParameterKinds(input){
  const kinds=[...new Set(Object.values(input.values).map(value=>typeof value==='string'?'enum':typeof value))];
  if(kinds.every(kind=>kind==='number'))return;
  const status=await call('status');
  if(kinds.some(kind=>!status.capabilities?.parameterKinds?.includes(kind)))throw Error('Running Studio does not support these parameter types. Use the adapter and Studio from the same build.');
}
async function runningStudio() {
  try { const status = await call('status'); return { connected: true, studioSession: status.studioSession, capabilities: status.capabilities ?? null,
    compatible: status.capabilities?.codeDeclaredParameters === true && status.capabilities?.supportedSdkVersions?.includes('0.4.0'),
    advice: status.capabilities?.codeDeclaredParameters && status.capabilities?.supportedSdkVersions?.includes('0.4.0') ? undefined : 'Running Studio predates this adapter; restart from the matching checkout before using SDK 0.4 composition.' }; }
  catch (error) { return { connected: false, compatible: false,
    selectedSession: { profile: selectedSession.profile, workspace: selectedSession.workspace },
    advice: `Use the same Studio profile and checkout; reconnect the adapter after replacing Studio. ${error.message}` }; }
}
server.registerTool('lux.studio.discover', { description: 'Read the exact visual SDK, example and standalone Lux capabilities. Start Lux Studio separately.', inputSchema: {} }, async () => text({ ...await discoverVisualSdk(), scope: 'standalone-studio', tools: ['read', 'build', 'save', 'open', 'capture', 'status', 'parameters', 'trigger', 'variation', 'playback', 'restart','tempo.set','tempo.tap','story.read','story.transport','library.list','library.read','library.create','library.update'], resolume: false,
  libraryCatalog: await libraryContext.catalog(),
  runningStudio: await runningStudio(),
  story:{readTool:'lux.story.read',transportTool:'lux.story.transport',rootSdkVersion:'0.2.0',authoring:'Single-visual scenes use studio.read/build story v1; omit preserves, null clears. Scene v7 uses the exclusive complete document form with Story v2 visual references. Definitions persist; playback state does not.',sustained:'Manual launch stays indefinitely; sequence occurrences can assign dwell.',timed:'Only active timed/direct beats support local seek; no absolute Story seek.',build:'Successful rebuild and recovery return to Normal.'},
  triggers:{kind:'trigger',tool:'lux.studio.trigger',persistent:false,commandId:'Caller-supplied idempotency key; reuse only to retry the same uncertain action in the same guarded generation.',receipt:'Acknowledged after one completed update/render frame. A paused preview stays paused.',maxCommandIdsPerGeneration:16384},
  parameters: { kinds: ['number','boolean','enum'], declaredInCode: true, requiredGuard: 'expectedControlSchemaHash from current runtime status', implicitControls: false,
    composition: 'SDK 0.4 supports image-chain-v1 and typed-image-graph-v1 (image, paths2d and shader-field ports, acyclic fan-out). Selected leaf controls are public aliases; values remain owned by stable node identity.' },
  sourceDocuments: { versions:[1,2],sceneVersions:[1,2,3,4,5,6,7],multiVisualSceneVersion:7,replacement: 'For Scene v1-v6 submit complete source and preserve sourceVersion/assets. For Scene v7 submit the complete read.document; source is only the selected editor view.',
    assetPlayback: true, assetExport: true, assetFormats: ['image/bmp', 'image/png', 'image/jpeg'], decodedImages: 'context.images: top-down sRGB straight-alpha RGBA' , assetDimension: assetLimits.dimension, assetCount: assetLimits.count,
    assetFileBytes: assetLimits.imageBytes, assetTotalBytes: assetLimits.totalBytes,
    sourceV2JsonBytes:6291456,sceneV7JsonBytes:33554432,requestBytes:agentTransportLimits.requestBytes,readJsonBytes:agentTransportLimits.responseBytes,readToolResultBytes:agentTransportLimits.readToolResultBytes } }));
server.registerTool('lux.studio.read', { description: 'Read the current draft and version. For single-visual scenes source is authoritative. For Scene v7 document is the complete authoritative scene and source is the selected editor view. Preserve every document field. The JSON response is limited to 52 MiB and the escaped tool result to 104 MiB.', inputSchema: {} }, async () => sourceReadResult(await call('read')));
server.registerTool('lux.studio.status', { description: 'Read actual standalone preview status.', inputSchema: {} }, async () => text(await call('status')));
server.registerTool('lux.studio.build', { description: 'Compile and preview one complete replacement. Read first; expectedDraftVersion prevents overwriting intervening edits. Pass source (plus optional libraryLinks/Story v1) for single-visual scenes, or pass the complete Scene v7 document with no source/libraryLinks/story siblings. For Scene v7, preserve all visuals, sources, caches, animations, settings, tempo and Story v2. Successful builds return Story to Normal. Failed builds retain the working preview.',
  inputSchema: sourceBuildInputObjectSchema.shape }, async input => {const parsed=sourceBuildInputSchema.parse(input);if(parsed.story!==undefined||parsed.document!==undefined)await requireStoryCapability();return text(await call('build', parsed));});
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
  ['parameters', parameterInputSchema, 'Set a partial map of code-defined parameters: numbers, booleans, or stable enum option IDs. Read status for controlSchema types/options/ranges, instance, generation, revision and expectedControlSchemaHash guards. Returns actual applied frame state; live mode only.'],
  ['playback', playbackInputSchema, 'Play, pause or reset the Studio runtime using current instance and generation guards. Reset preserves playing/paused state. Returns applied state.'],
  ['restart', restartInputSchema, 'Restart the Studio runtime using current instance and generation guards. Retains source and controls; returns replacement runtime state.'],
]) server.registerTool(`lux.studio.${method}`, { description, inputSchema: schema.shape }, async input => {if(method==='parameters')await requireParameterKinds(input);return text(await call(method, input));});
server.registerTool('lux.studio.variation',{description:'Configure or remove stable per-instance variation for one numeric control. Read status first for nodePath, controlId and runtime guards. Amount is a symmetric range around the current base; distribution is random, centered, or spread. Pass variation:null to remove it.',inputSchema:nodeVariationInputSchema.shape},async input=>{await requireVariationCapability();return text(await call('variation',input));});
server.registerTool('lux.studio.trigger',{description:'Invoke one discovered trigger control with current instance, generation, revision and schema guards, a controlId and caller-supplied commandId. Optional nodePath addresses a component instance. Returns the completed-frame receipt. Retry an uncertain action with the same commandId and guards; never automatically retry across generations. Trigger actions are not saved values. A paused preview draws once with zero delta and remains paused.',inputSchema:triggerInputSchema.shape},async input=>{await requireTriggerCapability();return text(await call('trigger',input));});
server.registerTool('lux.story.read',{description:'Read accepted Story status, definition, or source capabilities. Status supplies current runtime guards and transport revision. Sustained beats have no local timeline; occurrence dwell is separate from timed beat phase.',inputSchema:{view:z.enum(['status','definition','capabilities'])}},async input=>{await requireStoryCapability();return text(await call('story.read',input));});
const storyTransportShape={...storyTransportInputSchema.options[0].shape,
  action:z.enum(['launch','start','pause','play','set-auto-advance','resume','advance','seek','replay','loop','return-normal']),
  beatId:z.string().optional(),occurrenceId:z.string().optional(),enabled:z.boolean().optional(),localTimeSeconds:z.number().finite().nonnegative().optional()};
server.registerTool('lux.story.transport',{description:'Control Story with one guarded action. launch stays on a beat indefinitely; start runs occurrences; resume requires an explicit occurrence and fresh dwell. Auto-advance controls dwell independently from timed phase. seek/replay/loop require a timed/direct beat. Return-normal resumes normal visual behavior without resetting ambient time. Reuse commandId only for an exact uncertain retry; read current guards and expectedStoryRevision first. Success is a completed-frame receipt, not merely admission.',inputSchema:storyTransportShape},async input=>{const command=storyTransportInputSchema.parse(input);await requireStoryCapability();const result=await call('story.transport',command);return text(result.applied);});
server.registerTool('lux.studio.tempo.set',{description:'Set manual scene tempo from 20 through 300 BPM using current runtime identity and revision guards. Preserves beat phase and returns the acknowledged tempo result.',inputSchema:tempoSetInputSchema.shape},async input=>{await requireTempoCapability();return text(await call('tempo.set',input));});
server.registerTool('lux.studio.tempo.tap',{description:'Tap scene tempo using the running Studio monotonic clock and current runtime identity and revision guards. Returns accepted, restarted, or ignored-short.',inputSchema:tempoTapInputSchema.shape},async input=>{await requireTempoCapability();return text(await call('tempo.tap',input));});
await server.connect(new StdioServerTransport());
