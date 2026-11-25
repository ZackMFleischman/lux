import {readFileSync,writeFileSync} from 'node:fs';
const ours=['apps/build-worker/src/composition-declarations.mjs','apps/studio/src/GraphPanel.tsx','packages/runtime/src/components/image-chain.ts','packages/visual-sdk/src/discovery.mjs','packages/visual-sdk/src/sdk-composition.ts','scripts/test-component-model.mjs','skills/lux-visual-creation/SKILL.md','skills/lux-visual-creation/references/visual-programming.md','tests/studio/dock-shell.test.tsx'];
for(const path of [...ours,'apps/studio/src/authoring.tsx','tests/studio/interactions.test.tsx']){
 let count=0;const s=readFileSync(path,'utf8').replace(/<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> [^\r\n]+\r?\n/g,(_,a,b)=>{count++;if(path==='apps/studio/src/authoring.tsx')return '    getOutput:()=>({...DEFAULT_OUTPUT,...client.getSnapshot().authoring?.output}),\n'+a;if(path==='tests/studio/interactions.test.tsx')return b;return a;});
 if(!count)throw Error(path);writeFileSync(path,s);
}
