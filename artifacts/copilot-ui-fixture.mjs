import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const root=new URL('../tools/live-copilot/',import.meta.url);
const setup=`
Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[]})}});
globalThis.RTCPeerConnection=class {iceGatheringState='complete';localDescription={sdp:'v=0'};addTrack(){} createDataChannel(){return {}} async createOffer(){return {}} async setLocalDescription(){} async setRemoteDescription(){} close(){} };
globalThis.WebSocket=class {
static OPEN=1;readyState=1;
constructor(){setTimeout(()=>this.onopen?.(),20)}
send(raw){if(JSON.parse(raw).type==='disconnect'){this.onmessage?.({data:JSON.stringify({type:'stopped',confirmed:true})});return;}
const events=[
{type:'log',message:'Simulated speech packets — no microphone or paid services'},
{type:'transcript',speaker:'You',delta:'Make the visual',startMs:0,endMs:100},
{type:'transcript',speaker:'You',delta:' faster.',startMs:100,endMs:200},
{type:'log',message:'→ delegated'},
{type:'transcript',speaker:'Copilot',delta:' I can',startMs:300,endMs:400},
{type:'log',message:'→ lux.studio.status'},
{type:'transcript',speaker:'Copilot',delta:' check',startMs:400,endMs:500},
{type:'transcript',speaker:'Copilot',delta:' that for you.',startMs:500,endMs:600}];
events.forEach((event,i)=>setTimeout(()=>this.onmessage?.({data:JSON.stringify(event)}),i*100));}
close(){}
};`;
const server=createServer(async(req,res)=>{const path=req.url==='/'?'index.html':req.url.slice(1);if(!['index.html','client.js','transcript.js'].includes(path)){res.writeHead(404).end();return;}res.setHeader('Content-Type',path.endsWith('.html')?'text/html':'text/javascript');res.end((path==='client.js'?setup:'')+await readFile(new URL(path,root),'utf8'));});
server.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port));
