export const ballId='11111111-1111-4111-8111-111111111111';
export const kaleidoscopeAId='22222222-2222-4222-8222-222222222222';
export const kaleidoscopeBId='33333333-3333-4333-8333-333333333333';
export const edgeAId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const edgeBId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const image="{type:{kind:'image',colorSpace:'linear-srgb',alphaMode:'premultiplied'},label:'Image',description:'Image'}";
export const ballSource=`import {defineComponent} from '@lux/visual-sdk';
export default defineComponent({metadata:{declarationVersion:1,key:'demo/ball',label:'Ball',description:'Ball',tags:[],inputs:{},outputs:{image:${image}},controls:{intensity:{type:'number',label:'Intensity',default:.6,min:0,max:1,step:.01}},controlDescriptions:{intensity:'Spike amount'},lifecycle:{state:'stateful',reset:'seed'}},async create(){return {update(){},async evaluate(_inputs,context){return {image:await context.render({}, {})}},reset(){},dispose(){}}}});`;
export const kaleidoscopeSource=`import {defineComponent} from '@lux/visual-sdk';
export default defineComponent({metadata:{declarationVersion:1,key:'demo/kaleidoscope',label:'Kaleidoscope',description:'Effect',tags:[],inputs:{image:${image}},outputs:{image:${image}},controls:{segments:{type:'number',label:'Segments',default:6,min:2,max:16,step:1}},controlDescriptions:{segments:'Mirror segments'},lifecycle:{state:'stateful',reset:'seed'}},async create(){return {update(){},async evaluate(inputs,context){if(!inputs.image.texture)throw Error('missing texture');return {image:await context.render({}, {})}},reset(){},dispose(){}}}});`;
export const compositionSource=`import {defineComposition} from '@lux/visual-sdk';
import ball from './ball.ts';
import kaleidoscope from './kaleidoscope.ts';
export default defineComposition({definitions:{ball,kaleidoscope},nodes:[
 {id:'${ballId}',definition:'ball'},
 {id:'${kaleidoscopeAId}',definition:'kaleidoscope'},
 {id:'${kaleidoscopeBId}',definition:'kaleidoscope'}],edges:[
 {id:'${edgeAId}',from:{nodeId:'${ballId}',portId:'image'},to:{nodeId:'${kaleidoscopeAId}',portId:'image'},delay:'none'},
 {id:'${edgeBId}',from:{nodeId:'${kaleidoscopeAId}',portId:'image'},to:{nodeId:'${kaleidoscopeBId}',portId:'image'},delay:'none'}],
 output:{nodeId:'${kaleidoscopeBId}',portId:'image'},expose:[
 {id:'ballIntensity',nodeId:'${ballId}',controlId:'intensity'},
 {id:'segmentsA',nodeId:'${kaleidoscopeAId}',controlId:'segments'},
 {id:'segmentsB',nodeId:'${kaleidoscopeBId}',controlId:'segments'}]});`;
export const compositionSourceBundle=()=>({sdkVersion:'0.4.0',entry:'composition.ts',files:{'composition.ts':compositionSource,'ball.ts':ballSource,'kaleidoscope.ts':kaleidoscopeSource}});

export const compositeAId='44444444-4444-4444-8444-444444444444';
export const compositeBId='55555555-5555-4555-8555-555555555555';
export const wrapperNodeId='66666666-6666-4666-8666-666666666666';
export const wrappedEffectId='77777777-7777-4777-8777-777777777777';
export const directEffectId='88888888-8888-4888-8888-888888888888';
export const nestedEdgeAId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const nestedEdgeBId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export const innerEdgeId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
export const wrapperSource=`import {defineComposition} from '@lux/visual-sdk';
import kaleidoscope from './kaleidoscope.ts';
export default defineComposition({label:'Wrapped mirror',definitions:{kaleidoscope},nodes:[
 {id:'${wrappedEffectId}',definition:'kaleidoscope'}],edges:[],
 input:{nodeId:'${wrappedEffectId}',portId:'image'},output:{nodeId:'${wrappedEffectId}',portId:'image'},expose:[
 {id:'segments',nodeId:'${wrappedEffectId}',controlId:'segments'}]});`;
export const reusableCompositeSource=`import {defineComposition} from '@lux/visual-sdk';
import wrapped from './wrapper.ts';
import kaleidoscope from './kaleidoscope.ts';
export default defineComposition({label:'Double mirror',definitions:{wrapped,kaleidoscope},nodes:[
 {id:'${wrapperNodeId}',definition:'wrapped'},
 {id:'${directEffectId}',definition:'kaleidoscope'}],edges:[
 {id:'${innerEdgeId}',from:{nodeId:'${wrapperNodeId}',portId:'image'},to:{nodeId:'${directEffectId}',portId:'image'},delay:'none'}],
 input:{nodeId:'${wrapperNodeId}',portId:'image'},output:{nodeId:'${directEffectId}',portId:'image'},expose:[
 {id:'firstSegments',nodeId:'${wrapperNodeId}',controlId:'segments'},
 {id:'secondSegments',nodeId:'${directEffectId}',controlId:'segments'}]});`;
export const nestedCompositionSource=`import {defineComposition} from '@lux/visual-sdk';
import ball from './ball.ts';
import composite from './composite.ts';
export default defineComposition({label:'Nested demo',definitions:{ball,composite},nodes:[
 {id:'${ballId}',definition:'ball'},
 {id:'${compositeAId}',definition:'composite'},
 {id:'${compositeBId}',definition:'composite'}],edges:[
 {id:'${nestedEdgeAId}',from:{nodeId:'${ballId}',portId:'image'},to:{nodeId:'${compositeAId}',portId:'image'},delay:'none'},
 {id:'${nestedEdgeBId}',from:{nodeId:'${compositeAId}',portId:'image'},to:{nodeId:'${compositeBId}',portId:'image'},delay:'none'}],
 output:{nodeId:'${compositeBId}',portId:'image'},expose:[
 {id:'ballIntensity',nodeId:'${ballId}',controlId:'intensity'},
 {id:'segmentsA',nodeId:'${compositeAId}',controlId:'firstSegments'},
 {id:'segmentsB',nodeId:'${compositeBId}',controlId:'secondSegments'}]});`;
export const nestedCompositionSourceBundle=()=>({sdkVersion:'0.4.0',entry:'composition.ts',files:{
 'composition.ts':nestedCompositionSource,'composite.ts':reusableCompositeSource,'wrapper.ts':wrapperSource,
 'ball.ts':ballSource,'kaleidoscope.ts':kaleidoscopeSource}});
