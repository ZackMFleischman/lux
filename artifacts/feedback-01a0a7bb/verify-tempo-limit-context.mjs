import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { studioTestEnvironment } from '../../scripts/studio-session.mjs';
const installation=JSON.parse(await readFile(process.argv[2],'utf8'));
const packagedCatalog=JSON.parse(await readFile(join(installation.workspace,'library/catalog.json'),'utf8'));
const {ComponentLibraryStore}=await import(pathToFileURL(join(installation.workspace,'packages/core/src/component-library-store.ts')).href);
const seedProofRoot=await mkdtemp(join(tmpdir(),'lux-package-seed-proof-'));
const seedProof=new ComponentLibraryStore(seedProofRoot,{seedRoot:join(installation.workspace,'library')});
assert.deepEqual((await seedProof.list()).map(({id,revision})=>({id,revision})),packagedCatalog.components);
for(const reference of packagedCatalog.components){
  const component=await seedProof.read(reference.id);
  for(const [file,source] of Object.entries(component.source.files)) {
    assert.equal(await readFile(join(installation.canonicalLibraryRoot,'components',reference.id,'revisions',String(reference.revision),'source',file),'utf8'),source);
  }
}
const client=new Client({name:'lux-installed-context-proof',version:'1'});
try {
  await client.connect(new StdioClientTransport({command:installation.node,args:[installation.adapter],cwd:installation.workspace,env:studioTestEnvironment()}));
  const instructions=client.getInstructions();
  const response=await client.callTool({name:'lux.studio.discover',arguments:{}});
  const discovery=JSON.parse(response.content[0].text);
  await writeFile(new URL(`./tempo-limit-qa/context-observed-${installation.sourceCommit.slice(0,8)}.json`,import.meta.url),JSON.stringify({instructions,catalog:discovery.libraryCatalog},null,2));
  assert.equal(discovery.libraryCatalog.error,undefined);
  assert.ok(packagedCatalog.components.length>=8);
  assert.deepEqual(discovery.libraryCatalog.entries.map(({id,revision})=>({id,revision})),packagedCatalog.components);
  for(const entry of discovery.libraryCatalog.entries){assert.ok(instructions.includes(entry.id));assert.deepEqual(Object.keys(entry).sort(),['description','id','name','revision']);}
  assert.equal(discovery.parameters.maxCount,undefined);
  const result={ok:true,installation,libraryListCalls:0,defaultInstructions:true,seedSourceClosureMatches:true,seedProofRoot,catalog:discovery.libraryCatalog};
  await writeFile(new URL('./tempo-limit-qa/context.json',import.meta.url),JSON.stringify(result,null,2));
  console.log(JSON.stringify({ok:true,sourceCommit:installation.sourceCommit,entries:discovery.libraryCatalog.entries.length}));
} finally {await client.close();}

