import {readFile} from 'node:fs/promises';
import {resolveStudioSession,createStudioConnection} from '../../scripts/studio-session.mjs';
const base='C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac';
const receipt=JSON.parse(await readFile(base+'/tracer-components-launch.json','utf8'));
const call=createStudioConnection(resolveStudioSession({workspace:receipt.workspace,env:{...process.env,...receipt.mcp.env}}),{timeoutMs:75000});
const current=await call('read');
console.log(JSON.stringify({draftVersion:current.draftVersion,scene:current.scene,entry:current.source?.entry}));
await call('scene.open',{path:base+'/Living Painting - Aligned Tracer Cuts.lux-scene',expectedDraftVersion:current.draftVersion,discardDirty:false});
console.log(JSON.stringify({opened:true,library:await call('library.list')}));
