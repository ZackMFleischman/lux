import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const workspace = 'C:/Users/zFlei/repos/lux/.worktrees/library-context';
const client = new Client({name:'lux-default-catalog-proof',version:'1'});
try {
  await client.connect(new StdioClientTransport({command:process.execPath,args:[`${workspace}/scripts/studio-mcp.mjs`],cwd:workspace,env:{...process.env,LUX_STUDIO_PROFILE:'test-default-catalog-proof',LUX_STUDIO_MCP_TEST:'1',LUX_STUDIO_LIBRARY_ROOT:'C:/Users/zFlei/repos/lux/library'}}));
  const instructions=client.getInstructions();
  assert.ok(instructions?.includes('Prismatic Observatory'));
  const response=await client.callTool({name:'lux.studio.discover',arguments:{}});
  const discovery=JSON.parse(response.content[0].text);
  const catalog=discovery.libraryCatalog;
  assert.equal(catalog.entries.length,8);
  for(const entry of catalog.entries){assert.equal(typeof entry.description,'string');assert.ok(instructions.includes(entry.id));assert.deepEqual(Object.keys(entry).sort(),['description','id','name','revision']);}
  assert.equal(discovery.parameters.maxCount,undefined);
  const result={candidate:'36727700ae12ecc3f017a495953e1f79f5804a71',defaultInstructions:true,libraryListCalls:0,sourceLoaded:false,entries:catalog.entries,studioOpened:false};
  await writeFile(new URL('./default-library-context-proof.json',import.meta.url),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally {await client.close();}
