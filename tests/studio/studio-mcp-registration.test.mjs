import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { studioTestEnvironment, resolveStudioSession } from '../../scripts/studio-session.mjs';

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
  assert.ok(tools.tools.find(tool => tool.name === 'lux.studio.animation'), 'MCP must expose numeric control animation');
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


test('MCP animation checks the running app capability before forwarding binding edits',async t=>{
  const {createAgentBridge}=await import('../../apps/studio/src/agent-bridge.ts');
  const {studioCapabilities}=await import('../../apps/studio/src/capabilities.ts');
  const root=resolve(import.meta.dirname,'../..'),appData=await mkdtemp(join(tmpdir(),'lux-animation-mcp-'));
  const env=studioTestEnvironment({...process.env,APPDATA:appData}),session=resolveStudioSession({workspace:root,env});
  let capabilities={},calls=[];
  const identity={sessionId:'12345678-1234-1234-1234-123456789abc',profile:session.profile,workspace:session.workspace,pid:process.pid};
  const bridge=await createAgentBridge(async(method,params)=>{
    if(method==='status')return {studioSession:identity,capabilities};
    calls.push({method,params});return {applied:true};
  });
  const client=new Client({name:'animation-mcp-test',version:'1.0.0'});
  t.after(async()=>{await client.close();bridge.close();await rm(appData,{recursive:true,force:true});});
  await mkdir(session.directory,{recursive:true});
  await writeFile(session.endpointPath,JSON.stringify({version:1,...identity,url:bridge.url,token:bridge.token}));
  await client.connect(new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/studio-mcp.mjs')],cwd:root,env}));
  const hash='a'.repeat(64),args={instanceId:'runtime',expectedGeneration:2,expectedRevisionId:'revision',expectedControlSchemaHash:hash,nodePath:[],controlId:'speed',animation:{kind:'audio',nodePath:[],definitionHash:hash,schemaHash:hash,controlId:'speed',amount:1,enabled:true,attackMs:20,releaseMs:200,source:{kind:'audio-band',logicalInputId:'primary-audio',band:'bass',analyzer:{version:1,fftSize:2048,minDecibels:-100,maxDecibels:-30}}}};
  const rejected=await client.callTool({name:'lux.studio.animation',arguments:args});
  assert.equal(rejected.isError,true);assert.match(rejected.content[0].text,/Running Studio does not support/);assert.deepEqual(calls,[]);
  capabilities=studioCapabilities;
  const applied=await client.callTool({name:'lux.studio.animation',arguments:args});
  assert.equal(applied.isError,undefined);assert.deepEqual(calls,[{method:'animation',params:args}]);
  const removed=await client.callTool({name:'lux.studio.animation',arguments:{...args,animation:null}});
  assert.equal(removed.isError,undefined);assert.deepEqual(calls.at(-1),{method:'animation',params:{...args,animation:null}});
});
