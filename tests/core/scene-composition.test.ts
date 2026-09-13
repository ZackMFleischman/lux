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
const link={componentId:'11111111-1111-4111-8111-111111111111',mountPath:'library/shared',resolvedRevision:2,files:['library/shared/component.ts']};
test('scene v4 persists leaf identity and values without a mutable flat control copy',async()=>{
 const document=createSceneDocument(source,DEFAULT_OUTPUT,controls);assert.equal(document.version,4);assert.equal(Object.hasOwn(document.controls,'values'),false);const snapshot=await sceneControlSnapshot(await verifySceneDocument(document));assert.ok('nodes' in snapshot);assert.deepEqual(snapshot.nodes[0]!.values,{segments:9});
});
test('scene v4 rejects malformed node identity before save',()=>{assert.throws(()=>createSceneDocument(source,DEFAULT_OUTPUT,{...controls,nodes:[{...controls.nodes[0]!,nodePath:['wrong'] as any}]}));});
test('scene v5 persists linked component identity, resolved revision, and mounted fallback source',async()=>{
 const linkedSource={...source,files:{...source.files,'library/shared/component.ts':'export default {}'}};
 const document=createSceneDocument(linkedSource,DEFAULT_OUTPUT,controls,[link]);
 assert.equal(document.version,5);assert.deepEqual(document.libraryLinks,[link]);
 const reopened=await verifySceneDocument(JSON.parse(JSON.stringify(document)));
 assert.equal(reopened.version,5);assert.deepEqual(reopened.source,linkedSource);
 assert.deepEqual(reopened.libraryLinks,[link]);
});
test('scene v5 rejects duplicate links and mounted files outside their mount path',()=>{
 assert.throws(()=>createSceneDocument(source,DEFAULT_OUTPUT,controls,[link,link]),/duplicate/i);
 assert.throws(()=>createSceneDocument(source,DEFAULT_OUTPUT,controls,[{...link,files:['other.ts']}]),/mounted/i);
});
