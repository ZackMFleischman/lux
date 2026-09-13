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
