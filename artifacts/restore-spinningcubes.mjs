import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readFile,writeFile} from 'node:fs/promises';
const c=new Client({name:'lux-scene-restore',version:'1'});
const env={...process.env,LUX_STUDIO_PROFILE:'creative-c8e73bbdb600a59b83b225c2',LUX_STUDIO_SESSION_ID:'c5a6db070d8e1b55735dd87de0466185a89b'};
const call=async(name,args={})=>{const r=await c.callTool({name:'lux.studio.'+name,arguments:args},undefined,{timeout:75000});if(r.isError)throw Error(JSON.stringify(r.content));return JSON.parse(r.content.find(x=>x.type==='text').text)};
try{
await c.connect(new StdioClientTransport({command:process.execPath,args:['scripts/studio-mcp.mjs'],cwd:process.cwd(),env,stderr:'pipe'}));
const d=await call('discover');console.log('Discovery connected:',JSON.stringify(d.runningStudio));
const before=await call('read');
const scene=JSON.parse(await readFile('C:/Users/zFlei/Dropbox/VJ/lux/spinningcubes.lux-scene','utf8'));
const built=await call('build',{expectedDraftVersion:before.draftVersion,source:scene.source,...(scene.libraryLinks?{libraryLinks:scene.libraryLinks}:{})});
await writeFile('artifacts/spinningcubes-main-build.json',JSON.stringify(built));
console.log(JSON.stringify(built.status?.authoring??built).slice(0,16000));
}finally{await c.close();}
