import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoryWorkerResourcePorts} from '../../apps/studio/src/story/story-worker-resource-ports.mjs';

const identity=Object.freeze({instanceId:'instance',generation:2,scheduleHash:'a'.repeat(64),capsuleHash:'b'.repeat(64)});
test('resource requests preserve identity and settle only matching host responses',async()=>{
 const messages=[],ports=createStoryWorkerResourcePorts(identity,message=>messages.push(message));
 const request={kind:'story-asset-staging-reserve',requestId:'request-1',identity,visualId:'red',assetSetHash:'c'.repeat(64),decoderVersion:'v1',charge:{encodedBytes:0,rgbaBytes:0,totalBytes:0}};
 const pending=ports.broker(request);assert.deepEqual(messages[0],{type:'story-resource-request',...identity,revisionId:identity.scheduleHash,requestId:request.requestId,request});
 assert.equal(ports.accept({type:'story-resource-response',...identity,revisionId:identity.scheduleHash,requestId:'other',response:{}}),false);
 const response={kind:'story-asset-staging-granted',requestId:'request-1',identity,grantId:'grant',visualId:'red',assetSetHash:request.assetSetHash,decoderVersion:'v1',charge:request.charge};
 assert.equal(ports.accept({type:'story-resource-response',...identity,revisionId:identity.scheduleHash,requestId:'request-1',response}),true);assert.equal(await pending,response);assert.equal(ports.status().pending,0);
});
test('host denial and closure reject without accepting stale generation responses',async()=>{
 const ports=createStoryWorkerResourcePorts(identity,()=>{}),request={kind:'story-assets-decode',mode:'verify',requestId:'decode',identity,stagingGrantId:'grant',decoderVersion:'v1',visualId:'red',assetSetHash:'c'.repeat(64),assets:{}};
 const denied=ports.decoder(request);ports.accept({type:'story-resource-response',...identity,revisionId:identity.scheduleHash,requestId:'decode',error:{code:'DENIED',message:'no'}});await assert.rejects(denied,error=>error.code==='DENIED');
 const late=ports.broker({...request,kind:'story-asset-decode-authorize',requestId:'late'});ports.close();await assert.rejects(late,/closed/);assert.equal(ports.accept({type:'story-resource-response',...identity,revisionId:identity.scheduleHash,requestId:'late',response:{}}),false);
});
test('post-import global mutation cannot corrupt broker settlement or closure',async()=>{
 const descriptors={reject:Object.getOwnPropertyDescriptor(Promise,'reject'),clear:Object.getOwnPropertyDescriptor(Map.prototype,'clear'),String:globalThis.String},ports=createStoryWorkerResourcePorts(identity,()=>{}),request={kind:'story-asset-decode-authorize',requestId:'mutated',identity,stagingGrantId:'grant',decoderVersion:'v1',visualId:'red',assetSetHash:'c'.repeat(64)};
 const pending=ports.broker(request);
 try{Promise.reject=()=>{throw Error('mutated reject')};Map.prototype.clear=()=>{throw Error('mutated clear')};globalThis.String=()=>{throw Error('mutated String')};ports.accept({type:'story-resource-response',...identity,revisionId:identity.scheduleHash,requestId:'mutated',error:{code:'DENIED',message:'no'}});await assert.rejects(pending,error=>error.code==='DENIED');const late=ports.broker({...request,requestId:'late'});ports.close();await assert.rejects(late,/closed/);}
 finally{Object.defineProperty(Promise,'reject',descriptors.reject);Object.defineProperty(Map.prototype,'clear',descriptors.clear);globalThis.String=descriptors.String;}
});
