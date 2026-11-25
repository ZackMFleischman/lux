import {readFile,writeFile} from 'node:fs/promises';
const path=new URL('../../examples/components/wandering-tracers/painting.ts',import.meta.url);
let s=await readFile(path,'utf8');
const snapshot=JSON.parse(await readFile('C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac/before-prototype.json','utf8'));
for(const [key,value] of Object.entries(snapshot.status.authoring.controls)) {
  s=s.replace(new RegExp(`(    ${key}: \\{[^\\n]*default: )[^,]+`),`$1${value}`);
}
await writeFile(path,s);
