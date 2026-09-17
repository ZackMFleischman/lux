import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeControlDeclarations,normalizeControlSchema,canonicalControlSchemaJson,defaultControlValues} from '../../packages/runtime-contracts/src/parameters.mjs';
import {normalizeComponentDeclaration} from '../../packages/runtime-contracts/src/components.mjs';
import {validateControlAnimationBindings} from '../../packages/runtime-contracts/src/control-animation.mjs';
import {parameterCompiledArtifactSchema,componentCompiledArtifactSchema,DEFAULT_OUTPUT} from '../../packages/runtime-contracts/src/index.ts';
import {parameterInputSchema,nodeParameterInputSchema} from '../../apps/studio/src/runtime-operations.ts';
import {prepareWorkerControlState} from '../../apps/studio/src/controls/worker-control-state.mjs';
import {createSceneDocument,verifySceneDocument} from '../../packages/core/src/scene-document.ts';
import {studioCapabilities,supportsManualTapTempoCapability} from '../../apps/studio/src/capabilities.ts';

const declarations=Object.fromEntries(Array.from({length:64},(_,i)=>[`control${i}`,{type:'number',label:`Control ${i}`,group:'Motion',description:'A live parameter.',min:0,max:4,default:1}]));
test('manual/tap adapter guard requires protocol 3 and exact 20 through 300 BPM capability',()=>{
 assert.equal(supportsManualTapTempoCapability(studioCapabilities),true);
 for(const value of [undefined,{...studioCapabilities,protocolVersion:2},{...studioCapabilities,tempo:{...studioCapabilities.tempo,manual:false}},{...studioCapabilities,tempo:{...studioCapabilities.tempo,tap:false}},{...studioCapabilities,tempo:{...studioCapabilities.tempo,bpm:{min:10,max:300}}},{...studioCapabilities,tempo:{...studioCapabilities.tempo,bpm:{min:20,max:400}}}])assert.equal(supportsManualTapTempoCapability(value),false);
});
test('64 scene and component controls pass normalization and compiled DTOs',()=>{
 assert.equal(Object.hasOwn(studioCapabilities,'maxParameters'),false);
 assert.equal(studioCapabilities.maxParameterMetadataBytes,32768);
 const schema=normalizeControlDeclarations(declarations);
 assert.equal(schema.length,64);assert.deepEqual(normalizeControlSchema(schema),schema);
 assert.equal(parameterCompiledArtifactSchema.shape.controls.parse(schema).length,64);
 const component=normalizeComponentDeclaration({declarationVersion:1,key:'lux/many',label:'Many',description:'Many controls',tags:[],inputs:{},outputs:{},controls:declarations,
  controlDescriptions:Object.fromEntries(schema.map(row=>[row.id,'Live value'])),lifecycle:{state:'stateless',reset:'seed'}});
 assert.equal(component.controls.length,64);
 assert.equal(componentCompiledArtifactSchema.shape.component.parse(component).controls.length,64);
 const unicode=normalizeControlDeclarations({value:{type:'number',label:'Value',group:'😀'.repeat(80),description:'😀'.repeat(512),min:0,max:1,default:0}});
 assert.equal(parameterCompiledArtifactSchema.shape.controls.parse(unicode)[0]!.group,unicode[0]!.group);
});
test('artifact DTOs admit strict trigger definitions without a persistent default',()=>{
 const trigger=normalizeControlDeclarations({regenerate:{type:'trigger',label:'Regenerate',description:'Build another pattern',group:'Actions'}})[0]!;
 assert.deepEqual(parameterCompiledArtifactSchema.shape.controls.parse([trigger]),[trigger]);
 assert.throws(()=>parameterCompiledArtifactSchema.shape.controls.parse([{...trigger,default:false}]));
 assert.throws(()=>parameterCompiledArtifactSchema.shape.controls.parse([{...trigger,extra:true}]));
});
test('animation metadata remains byte-bounded without a binding-count cap',()=>{
 const binding={nodePath:['x'.repeat(1048576)],definitionHash:'a'.repeat(64),schemaHash:'a'.repeat(64),controlId:'control0',shape:'sine',periodSeconds:2,amount:.5,phase:0,enabled:true};
 assert.throws(()=>validateControlAnimationBindings([binding]),/metadata exceeds 1 MiB/);
});
test('64-value bulk writes are admitted for scene and component targets',()=>{
 const values=Object.fromEntries(Object.keys(declarations).map(id=>[id,2]));
 const input={instanceId:'test-instance',expectedGeneration:1,expectedRevisionId:'revision',expectedControlSchemaHash:'a'.repeat(64),values};
 assert.equal(Object.keys(parameterInputSchema.parse(input).values).length,64);
 assert.equal(Object.keys(nodeParameterInputSchema.parse({...input,nodePath:['11111111-1111-4111-8111-111111111111']}).values).length,64);
 assert.throws(()=>parameterInputSchema.parse({...input,values:{}}));
});
test('64 animation bindings evaluate and survive scene save/reopen with all base controls',async()=>{
 const schema=normalizeControlDeclarations(declarations),schemaHash=createHash('sha256').update(canonicalControlSchemaJson(schema)).digest('hex');
 const values=defaultControlValues(schema);
 const bindings=schema.map(control=>({nodePath:[],definitionHash:schemaHash,schemaHash,controlId:control.id,shape:'sine' as const,periodSeconds:2,amount:.5,phase:.25,enabled:true}));
 assert.equal(validateControlAnimationBindings(bindings).length,64);
 const worker=await prepareWorkerControlState({sdkVersion:'0.2.0',controlSchema:schema,controlSchemaHash:schemaHash,controls:values,controlAnimations:bindings});
 assert.equal(worker.values(0).control63,1.5);
 const document=createSceneDocument({sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':'export {}'}},DEFAULT_OUTPUT,{sourceHash:'a'.repeat(64),schema,schemaHash,values},[],bindings);
 const reopened=await verifySceneDocument(JSON.parse(JSON.stringify(document)));
 assert.equal(reopened.version,3);
 assert.deepEqual(reopened.controlAnimations,bindings);assert.deepEqual(reopened.controls,document.controls);
});
