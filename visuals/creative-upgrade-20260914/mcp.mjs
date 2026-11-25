import {Client} from '../../.worktrees/lux-creative/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StdioClientTransport} from '../../.worktrees/lux-creative/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import {readFile,writeFile} from 'node:fs/promises';
const root='C:/Users/zFlei/repos/lux/.worktrees/lux-creative';
const c=new Client({name:'prismatic-observatory',version:'1'});
try {
 await c.connect(new StdioClientTransport({command:process.execPath,args:[root+'/scripts/studio-mcp.mjs'],cwd:root,env:{...process.env,LUX_STUDIO_PROFILE:'creative',LUX_STUDIO_SESSION_ID:'0d81d4baad74ec80f0b5f174660e957e1c25'}}));
 const args=process.argv[3]?JSON.parse(await readFile(process.argv[3],'utf8')):{};
 const r=await c.callTool({name:process.argv[2],arguments:args},undefined,{timeout:75000});
 await writeFile(new URL('./last-result.json',import.meta.url),JSON.stringify(r,null,2));
 for(const x of r.content??[]) {if(x.type==='text')console.log(x.text);if(x.type==='image'){await writeFile(new URL('./preview.png',import.meta.url),Buffer.from(x.data,'base64'));console.log('Preview saved.');}}
 if(r.isError)process.exitCode=1;
}finally{await c.close()}
