export const declaration = {declarationVersion:1,key:'test/image',label:'Image',description:'A test source',tags:[],inputs:{},outputs:{image:{type:{kind:'image',colorSpace:'linear-srgb',alphaMode:'premultiplied'},label:'Image',description:'Rendered image'}},controls:{speed:{type:'number',label:'Speed',default:1,min:0,max:2}},controlDescriptions:{speed:'Motion speed'},lifecycle:{state:'stateful',reset:'seed'}};
export const componentSource = (metadata=JSON.stringify(declaration),update='const speed: number = frame.controls.speed;',evaluate='return {image:await context.render({}, {})};') => `import {defineComponent as component} from '@lux/visual-sdk';
export default component({metadata:${metadata},async create(context){
  if (context.settings.width < 0) throw Error('never execute during compilation');
  return {update(frame){${update}},async evaluate(inputs,context){${evaluate}},reset(seed){},dispose(){}};
}});`;
