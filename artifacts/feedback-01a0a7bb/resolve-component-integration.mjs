import {readFileSync,writeFileSync} from 'node:fs';
function resolve(path,combine){const s=readFileSync(path,'utf8');let count=0;const out=s.replace(/<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> [^\r\n]+\r?\n/g,(_,ours,theirs)=>{count++;return combine(ours,theirs);});if(count!==1)throw Error(`${path}: ${count}`);writeFileSync(path,out);}
resolve('apps/studio/src/GraphPanel.tsx',(o,t)=>t.replace('height=180;','height=Math.max(180,190+(body?.edges.length??0)*12);'));
resolve('packages/visual-sdk/src/discovery.mjs',(o,t)=>o+t.split('\n').filter(l=>l.includes('authoring:')).join('\n')+'\n');
resolve('skills/lux-visual-creation/SKILL.md',(o,t)=>t.replace('The flattened result must remain one linear image chain of 1–8 leaf components and one final image. Branching, feedback and delays remain unavailable.','The flattened graph supports 1–8 reachable leaf components and one final image. Legacy image chains remain supported; explicit image, paths2d and shader-field connections can form acyclic fan-out. Feedback, delays, and interactive graph rewiring are unavailable.'));
resolve('skills/lux-visual-creation/references/visual-programming.md',(o,t)=>t.replace('Code metadata statically declares image ports','Code metadata statically declares image, paths2d or shader-field ports'));
resolve('packages/visual-sdk/src/sdk-composition.ts',(o,t)=>{
 const prefix=o.slice(0,o.indexOf('export interface ComponentDefinition'));
 const code=o.slice(o.indexOf('export interface ComponentDefinition'),o.indexOf('export function defineComponent')).replace('interface ComponentDefinition','interface CodeComponentDefinition');
 const declaration="type CodeDeclaration<C extends ControlDeclarations,I extends PortDeclarations,O extends PortDeclarations>={readonly metadata:Omit<ComponentDeclaration,'inputs'|'outputs'|'controls'|'controlDescriptions'>&{readonly inputs:I;readonly outputs:O;readonly controls:C;readonly controlDescriptions:{readonly [K in keyof C]:string}};create(context:ComponentContext):Promise<ComponentInstance<NoInfer<C>,NoInfer<I>,NoInfer<O>>>};\n";
 const rest=t.slice(t.indexOf('type Node='))
 .replace("readonly portId:'image'","readonly portId:string")
 .replace('Record<string,ComponentDefinition>','Record<string,ComponentDefinition<any,any,any>>')
 .replace('ComponentDefinition<C extends ControlDeclarations=ControlDeclarations>=CodeComponentDefinition<C>', 'ComponentDefinition<C extends ControlDeclarations=ControlDeclarations,I extends PortDeclarations=LegacyImageInputs,O extends PortDeclarations=LegacyImageOutputs>=CodeComponentDefinition<C,I,O>')
 .replace('defineComponent<const C extends ControlDeclarations>(definition:CodeDeclaration<C>):CodeComponentDefinition<C>;', 'defineComponent<const C extends ControlDeclarations,const I extends PortDeclarations,const O extends PortDeclarations>(definition:CodeDeclaration<C,I,O>):CodeComponentDefinition<C,I,O>;')
 .replace('definition:CodeDeclaration<ControlDeclarations>|GraphDeclaration):ComponentDefinition{','definition:CodeDeclaration<any,any,any>|GraphDeclaration):ComponentDefinition<any,any,any>{');
 return prefix+code+declaration+rest;
});
