import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const receipt=JSON.parse(await readFile(new URL('./combined-desktop-session.json',import.meta.url),'utf8'));
const path='C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac/Living Painting - Reusable Components.lux-scene';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const before=hash(await readFile(path));
const client=new Client({name:'lux-combined-release-reopen',version:'1'});
const call=async(name,args={})=>{const r=await client.callTool({name:`lux.studio.${name}`,arguments:args},undefined,{timeout:75000});if(r.isError)throw Error(JSON.stringify(r.content));return r;};
const json=r=>JSON.parse(r.content.find(item=>item.type==='text').text);
try{
 await client.connect(new StdioClientTransport(receipt.mcp));
 const current=json(await call('read'));
 const opened=json(await call('open',{path,expectedDraftVersion:current.draftVersion,discardDirty:false}));
 await new Promise(resolve=>setTimeout(resolve,1500));
 const status=json(await call('status'));
 assert.equal(status.studioSession.sessionId,receipt.studioSession.sessionId);
 assert.ok(status.authoring&&!status.authoring.fault);
 const capture=await call('capture');
 const png=capture.content.find(item=>item.type==='image');assert.ok(png);
 await writeFile(new URL('./combined-painting.png',import.meta.url),Buffer.from(png.data,'base64'));
 // The previous user desktop was paused for QA; restore that state after the fresh open.
 await call('playback',{instanceId:status.authoring.instanceId,expectedGeneration:status.authoring.generation,action:'pause'});
 assert.equal(hash(await readFile(path)),before);
 const result={ok:true,sourceCommit:receipt.sourceCommit,studioSession:receipt.studioSession,path,sceneHash:before,sceneName:status.authoring.sceneName,playback:'paused',revisionId:status.authoring.revisionId,libraryLinks:opened.libraryLinks};
 await writeFile(new URL('./combined-painting-open.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await client.close();}
