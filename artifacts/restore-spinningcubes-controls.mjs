import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readFile,writeFile} from 'node:fs/promises';
const c=new Client({name:'lux-saved-controls',version:'1'});
const call=async(name,args={})=>{const r=await c.callTool({name:'lux.studio.'+name,arguments:args},undefined,{timeout:75000});if(r.isError)throw Error(JSON.stringify(r.content));return r};
const json=r=>JSON.parse(r.content.find(x=>x.type==='text').text);
try{
await c.connect(new StdioClientTransport({command:process.execPath,args:['scripts/studio-mcp.mjs'],cwd:process.cwd(),env:{...process.env,LUX_STUDIO_PROFILE:'creative-c8e73bbdb600a59b83b225c2',LUX_STUDIO_SESSION_ID:'c5a6db070d8e1b55735dd87de0466185a89b'},stderr:'pipe'}));
const saved=JSON.parse(await readFile('C:/Users/zFlei/Dropbox/VJ/lux/spinningcubes.lux-scene','utf8'));
const state=json(await call('status')).authoring;
if(state.revisionId!==saved.controls.sourceHash)throw Error('Source revision differs from saved scene');
const values={};
for(const [alias,bindings] of Object.entries(state.composition.publicControlBindings)) {
 if(bindings.length!==1)throw Error('Ambiguous binding');
 const b=bindings[0],node=saved.controls.nodes.find(n=>JSON.stringify(n.nodePath)===JSON.stringify(b.nodePath));
 if(node && b.controlId in node.values)values[alias]=node.values[b.controlId];
}
const result=json(await call('parameters',{instanceId:state.instanceId,expectedGeneration:state.generation,expectedRevisionId:state.revisionId,expectedControlSchemaHash:state.controlSchemaHash,mode:'live',values}));
console.log('Saved controls applied:',result.applied,JSON.stringify(values));
const capture=await call('capture');
await writeFile('artifacts/spinningcubes-new-main.png',Buffer.from(capture.content.find(x=>x.type==='image').data,'base64'));
console.log('Captured live preview');
}finally{await c.close();}
