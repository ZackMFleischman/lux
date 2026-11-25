import {readFile,writeFile} from 'node:fs/promises';
import {resolveStudioSession,createStudioConnection} from '../../scripts/studio-session.mjs';
const base='C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac';
const receipt=JSON.parse(await readFile(base+'/tracer-components-launch.json','utf8'));
const call=createStudioConnection(resolveStudioSession({workspace:receipt.workspace,env:{...process.env,...receipt.mcp.env}}),{timeoutMs:75000});
const entries=await call('library.list');if(entries.some(e=>e.name==='Wandering Tracers'))throw Error('Already exists; inspect instead');
const files={};for(const f of ['overlay.ts','paths.ts','tracer-state.ts','renderer.ts','tracer-texture.ts','tracer-spline.ts'])files[f]=await readFile('examples/components/wandering-tracers/'+f,'utf8');
const result=await call('library.create',{name:'Wandering Tracers',description:'Fine watercolor tracers over any image, with separate path generation and rendering. Shared paths can drive region carving.',source:{sdkVersion:'0.4.0',entry:'overlay.ts',files}});
await writeFile(base+'/wandering-tracers-library.json',JSON.stringify(result,null,2));console.log(JSON.stringify({id:result.id,revision:result.revision}));
