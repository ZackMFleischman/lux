import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {writeFile} from 'node:fs/promises';
const c=new Client({name:'lux-restart-preservation',version:'1'});
try{
 await c.connect(new StdioClientTransport({command:process.execPath,args:['C:/Users/zFlei/repos/lux/.worktrees/lux-creative/scripts/studio-mcp.mjs'],cwd:'C:/Users/zFlei/repos/lux/.worktrees/lux-creative',env:{...process.env,LUX_STUDIO_PROFILE:'creative',LUX_STUDIO_SESSION_ID:'a8c894d19ba4e10a402021401da2f3167521'},stderr:'pipe'}));
 const r=await c.callTool({name:'lux.studio.read',arguments:{}});
 if(r.isError)throw Error(JSON.stringify(r.content));
 await writeFile('artifacts/before-main-restart.json',JSON.stringify(r));
 console.log('Current source and status preserved before requested restart');
}finally{await c.close();}
