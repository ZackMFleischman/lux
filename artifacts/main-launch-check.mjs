import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {writeFile} from 'node:fs/promises';
const c=new Client({name:'main-launch-check',version:'1.0.0'});
const env={...process.env,LUX_STUDIO_PROFILE:'creative-c8e73bbdb600a59b83b225c2',LUX_STUDIO_SESSION_ID:'73edf2e06c962b450746d2da9a946f6ecbf7'};
const call=async name=>{const r=await c.callTool({name:'lux.studio.'+name,arguments:{}},undefined,{timeout:60000});if(r.isError)throw Error(JSON.stringify(r.content));return r;};
const json=r=>JSON.parse(r.content.find(x=>x.type==='text').text);
try {await c.connect(new StdioClientTransport({command:process.execPath,args:[process.cwd()+'/scripts/studio-mcp.mjs'],cwd:process.cwd(),env}));const d=json(await call('discover'));const r=json(await call('read'));await writeFile('artifacts/main-launch-read.json',JSON.stringify(r));console.log(JSON.stringify({runningStudio:d.runningStudio,draftVersion:r.draftVersion,status:r.status}));const capture=await call('capture');const im=capture.content.find(x=>x.type==='image');if(im)await writeFile('artifacts/main-launch-preview.png',Buffer.from(im.data,'base64'));}finally{await c.close();}
