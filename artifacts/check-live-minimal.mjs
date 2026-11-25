import {loadEnvFile} from 'node:process';
import {readFile} from 'node:fs/promises';
import OpenAI from 'openai';
import {attachLive} from '../tools/live-copilot/live.ts';
loadEnvFile('.env.local');
const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0});
const saved=JSON.parse(await readFile('artifacts/live-start-request.json','utf8'));
try{
const result=await client.live.create({session:{model:'gpt-live-1',delegation:{type:'client'}},transport:saved.transport});
console.log('Minimal create succeeded');
const live=attachLive({client,sessionId:result.session.id,state:{},execute:async()=>{throw Error('diagnostic only')},onFailure:e=>console.log(e.message),onEnded(){}});
await live.ready;await live.close();console.log('Diagnostic session closed');
}catch(e){console.log(JSON.stringify({status:e.status,message:e.message,requestId:e.request_id,type:e.type,code:e.code,detail:e.error}));}
