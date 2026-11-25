import {loadEnvFile} from 'node:process';
import OpenAI from 'openai';
loadEnvFile('.env.local');
const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0});
const base=new URL(client.baseURL);console.log('API destination:',base.origin+base.pathname);
try{const response=await client.models.retrieve('gpt-live-1').withResponse();console.log('Model reachable:',response.data.id,'HTTP',response.response.status);}
catch(e){console.log(JSON.stringify({status:e.status,message:e.message,requestId:e.request_id}));}
