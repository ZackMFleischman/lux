import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneDocument,verifySceneDocument,sceneControlSnapshot} from '../../packages/core/src/scene-document.ts';
import {DEFAULT_OUTPUT} from '../../packages/runtime-contracts/src/index.ts';
import {canonicalControlSchemaJson} from '../../packages/runtime-contracts/src/parameters.mjs';
import {createHash} from 'node:crypto';
import {nodeIdSchema} from '../../packages/runtime-contracts/src/identities.ts';
const source={sdkVersion:'0.4.0' as const,entry:'composition.ts',files:{'composition.ts':'export {}'}};
const schema=[{id:'segments',type:'number' as const,label:'Segments',default:6,min:2,max:16,step:1,changeCost:'live' as const}];
const controls={sourceHash:'a'.repeat(64),nodes:[{nodePath:[nodeIdSchema.parse('22222222-2222-4222-8222-222222222222')],definitionHash:'b'.repeat(64),schema,schemaHash:createHash('sha256').update(canonicalControlSchemaJson(schema)).digest('hex'),values:{segments:9}}]};
const animations=[{nodePath:controls.nodes[0]!.nodePath,definitionHash:controls.nodes[0]!.definitionHash,schemaHash:controls.nodes[0]!.schemaHash,controlId:'segments',shape:'sine' as const,periodSeconds:2,amount:3,phase:.25,enabled:true}];
const link={componentId:'11111111-1111-4111-8111-111111111111',mountPath:'library/shared',resolvedRevision:2,files:['library/shared/component.ts']};
test('scene v4 persists leaf identity and values without a mutable flat control copy',async()=>{
 const document=createSceneDocument(source,DEFAULT_OUTPUT,controls,[],animations);if(document.version!==4)assert.fail('expected v4');assert.equal(Object.hasOwn(document.controls,'values'),false);assert.deepEqual(document.controlAnimations,animations);const reopened=await verifySceneDocument(JSON.parse(JSON.stringify(document)));if(reopened.version!==4)assert.fail('expected v4');assert.deepEqual(reopened.controlAnimations,animations);const snapshot=await sceneControlSnapshot(reopened);assert.ok('nodes' in snapshot);assert.deepEqual(snapshot.nodes[0]!.values,{segments:9});
});
test('scene save and reopen preserve 600 component snapshots',async()=>{
 const many={...controls,nodes:Array.from({length:600},(_,index)=>({...controls.nodes[0]!,nodePath:[nodeIdSchema.parse(`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`)],values:{segments:2+index%15}}))};
 const document=createSceneDocument(source,DEFAULT_OUTPUT,many);if(document.version!==4)assert.fail('expected v4');
 const reopened=await verifySceneDocument(JSON.parse(JSON.stringify(document)));if(reopened.version!==4)assert.fail('expected v4');
 const snapshot=await sceneControlSnapshot(reopened);assert.ok('nodes' in snapshot);assert.equal(snapshot.nodes.length,600);assert.deepEqual(snapshot.nodes[599]!.values,{segments:16});
});
test('scene save and reopen preserve more than eight linked components within source quotas',async()=>{
 const links=Array.from({length:12},(_,index)=>({componentId:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,mountPath:`library/item-${index}`,resolvedRevision:1,files:[`library/item-${index}/component.ts`]}));
 const linkedSource={...source,files:{...source.files,...Object.fromEntries(links.map(item=>[item.files[0]!, 'export default {}']))}};
 const document=createSceneDocument(linkedSource,DEFAULT_OUTPUT,controls,links);assert.equal(document.version,5);assert.equal(document.libraryLinks.length,12);
 const reopened=await verifySceneDocument(JSON.parse(JSON.stringify(document)));assert.equal(reopened.version,5);assert.equal(reopened.libraryLinks.length,12);
});
test('scene v4 rejects malformed node identity before save',()=>{assert.throws(()=>createSceneDocument(source,DEFAULT_OUTPUT,{...controls,nodes:[{...controls.nodes[0]!,nodePath:['wrong'] as any}]}));});
test('scene v5 persists linked component identity, resolved revision, and mounted fallback source',async()=>{
 const linkedSource={...source,files:{...source.files,'library/shared/component.ts':'export default {}'}};
 const document=createSceneDocument(linkedSource,DEFAULT_OUTPUT,controls,[link],animations);
 assert.equal(document.version,5);assert.deepEqual(document.libraryLinks,[link]);
 const reopened=await verifySceneDocument(JSON.parse(JSON.stringify(document)));
 assert.equal(reopened.version,5);assert.deepEqual(reopened.source,linkedSource);
 assert.deepEqual(reopened.libraryLinks,[link]);
 assert.deepEqual(reopened.controlAnimations,animations);
});
test('scene v4 remains compatible when no animation bindings are stored',async()=>{const document:any={format:'lux-scene',version:4,source,settings:DEFAULT_OUTPUT,controls},reopened=await verifySceneDocument(document);if(reopened.version!==4)assert.fail('expected v4');assert.deepEqual(reopened.controlAnimations,[]);});
test('scene v5 rejects duplicate links and mounted files outside their mount path',()=>{
 assert.throws(()=>createSceneDocument(source,DEFAULT_OUTPUT,controls,[link,link]),/duplicate/i);
 assert.throws(()=>createSceneDocument(source,DEFAULT_OUTPUT,controls,[{...link,files:['other.ts']}]),/mounted/i);
});
test('scene animation validation rejects accessors without invoking them',()=>{let invoked=false;const hostile:any={...animations[0]};Object.defineProperty(hostile,'amount',{enumerable:true,get(){invoked=true;return 2;}});assert.throws(()=>createSceneDocument(source,DEFAULT_OUTPUT,controls,[],[hostile]),/animation/i);assert.equal(invoked,false);});
