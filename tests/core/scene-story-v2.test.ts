import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
 createStorySceneDocumentV7,validateStorySceneDocumentV7,verifyStorySceneDocumentV7,
} from '../../packages/core/src/story-scene-v2.ts';
import {validateSceneDocument,verifySceneDocument,sceneControlSnapshot} from '../../packages/core/src/scene-document.ts';

const settings={width:640,height:360,fps:60,seed:0};
const tempo={bpm:120};
const schema=[] as const;
const schemaHash=createHash('sha256').update('[]').digest('hex');
const source=(text='export {}')=>({sdkVersion:'0.2.0' as const,entry:'visual.ts',files:{'visual.ts':text}});
const sourceHash=(value:ReturnType<typeof source>)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const visual=(id:string,text='export {}')=>{
 const submitted=source(text);
 return {id,source:submitted,controls:{sourceHash:sourceHash(submitted),schema,schemaHash,values:{}},controlAnimations:[]};
};
const story={version:2 as const,normalVisualId:'ambient',crossfadeSeconds:.5,beats:[
 {id:'arrival',label:'Arrival',timing:{kind:'timed' as const,durationSeconds:4},visualId:'lead'},
 {id:'orbit',label:'Orbit',timing:{kind:'sustained' as const},visualId:'ambient'},
],sequence:[
 {id:'opening',beatId:'arrival',follow:{kind:'after' as const,seconds:5},visualId:'lead'},
 {id:'orbit-1',beatId:'orbit',follow:{kind:'manual' as const},visualId:'ambient'},
]};

test('Scene v7 validates and verifies all visual sources without changing legacy scene dispatch',async()=>{
 const document=createStorySceneDocumentV7([visual('ambient'),visual('lead')],settings,tempo,story);
 assert.equal(document.version,7);
 assert.deepEqual(validateStorySceneDocumentV7(structuredClone(document)),document);
 assert.deepEqual(await verifyStorySceneDocumentV7(structuredClone(document)),document);
 assert.deepEqual(validateSceneDocument(structuredClone(document)),document);
 assert.deepEqual(await verifySceneDocument(structuredClone(document)),document);
 await assert.rejects(sceneControlSnapshot(document),/Scene v7|visual snapshots/i);
 const legacy={format:'lux-scene',version:6,source:source(),settings,controls:visual('legacy').controls,tempo};
 assert.deepEqual(validateSceneDocument(structuredClone(legacy)),legacy);
});

test('Scene v7 enforces visual identity, references, SDK and flat schema identity',()=>{
 const valid=createStorySceneDocumentV7([visual('ambient'),visual('lead')],settings,tempo,story);
 const animation={nodePath:[],definitionHash:schemaHash,schemaHash,controlId:'intensity',shape:'sine',periodSeconds:2,amount:1,phase:0,enabled:true};
 const withAnimation={...valid,visuals:[{...valid.visuals[0],controlAnimations:[animation]},valid.visuals[1]]};
 assert.deepEqual(validateStorySceneDocumentV7(withAnimation).visuals[0]!.controlAnimations,[animation]);
 for(const value of [
  {...valid,visuals:[]},
  {...valid,visuals:[valid.visuals[0],{...valid.visuals[1],id:'ambient'}]},
  {...valid,story:{...story,normalVisualId:'missing'}},
  {...valid,story:{...story,beats:[{...story.beats[0],visualId:'missing'},story.beats[1]]}},
  {...valid,story:{...story,sequence:[{...story.sequence[0],visualId:'missing'},story.sequence[1]]}},
  {...valid,visuals:[{...valid.visuals[0],source:{...valid.visuals[0]!.source,sdkVersion:'0.3.0'}},valid.visuals[1]]},
  {...valid,visuals:[{...valid.visuals[0],controlAnimations:undefined},valid.visuals[1]]},
  {...valid,visuals:[{...valid.visuals[0],controlAnimations:[{...animation,nodePath:['nested']}]},valid.visuals[1]]},
  {...valid,visuals:[{...valid.visuals[0],controlAnimations:[{...animation,definitionHash:'b'.repeat(64)}]},valid.visuals[1]]},
 ]) assert.throws(()=>validateStorySceneDocumentV7(value));
});

test('Scene v7 verification retains accepted control provenance across edited and invalid drafts',async()=>{
 const valid=createStorySceneDocumentV7([visual('ambient'),visual('lead')],settings,tempo,story);
 const changed={...valid,visuals:[{...valid.visuals[0],source:source('export default {')},valid.visuals[1]]};
 const reopened=await verifyStorySceneDocumentV7(changed);
 assert.equal(reopened.visuals[0]!.controls.sourceHash,valid.visuals[0]!.controls.sourceHash);
 assert.equal(reopened.visuals[0]!.source.files['visual.ts'],'export default {');
 await assert.rejects(verifyStorySceneDocumentV7({...valid,visuals:[{...valid.visuals[0],controls:{...valid.visuals[0]!.controls,sourceHash:'not-a-hash'}},valid.visuals[1]]}));
 await assert.rejects(verifyStorySceneDocumentV7({...valid,visuals:[valid.visuals[0],{...valid.visuals[1],controls:{...valid.visuals[1]!.controls,schemaHash:'b'.repeat(64)}}]}),/schema hash/i);
});

test('Scene v7 rejects unsupported fields and accessors without invoking them',()=>{
 const valid=createStorySceneDocumentV7([visual('ambient'),visual('lead')],settings,tempo,story);
 assert.throws(()=>validateStorySceneDocumentV7({...valid,extra:true}));
 assert.throws(()=>validateStorySceneDocumentV7({...valid,visuals:[{...valid.visuals[0],extra:true},valid.visuals[1]]}));
 let calls=0;const hostile=structuredClone(valid);Object.defineProperty(hostile.visuals[0],'source',{enumerable:true,get(){calls++;return source();}});
 assert.throws(()=>validateStorySceneDocumentV7(hostile));
 assert.equal(calls,0);
});

test('Scene v7 accepts the aggregate source boundary and rejects a source overflow',()=>{
 const maximum=Array.from({length:8},(_,index)=>visual(`v${index}`,'x'.repeat(1024*1024)));
 const quotaStory={...story,normalVisualId:'v0',beats:story.beats.map((beat,index)=>({...beat,visualId:`v${index}`})),sequence:story.sequence.map((row,index)=>({...row,visualId:`v${index}`}))};
 assert.equal(createStorySceneDocumentV7(maximum,settings,tempo,quotaStory).visuals.length,8);
 const overflow=[visual('v0','x'.repeat(1024*1024+1)),...maximum.slice(1)];
 assert.throws(()=>createStorySceneDocumentV7(overflow,settings,tempo,quotaStory),/source|1 MiB|quota/i);
});
import {exportSceneDocument} from '../../scripts/studio-export.mjs';
import {tmpdir} from 'node:os';
test('Scene7 export fails explicitly before preparing a Resolume package',async()=>{
 const document=createStorySceneDocumentV7([visual('ambient'),visual('lead')],settings,tempo,story);let called=false;
 await assert.rejects(exportSceneDocument({name:'Story',document,outputDirectory:tmpdir()},{prepare:async()=>{called=true;throw Error('Unexpected prepare');}}),/Resolume export does not support Story/);
 assert.equal(called,false);
});
