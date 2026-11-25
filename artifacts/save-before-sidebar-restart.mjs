import {readDesktopInstallation} from '../scripts/studio-desktop.mjs';
import {resolveStudioSession,createStudioConnection} from '../scripts/studio-session.mjs';
import {writeFile} from 'node:fs/promises';
const record=await readDesktopInstallation();const session=resolveStudioSession({workspace:record.workspace,env:{...process.env,LUX_STUDIO_PROFILE:'desktop'}});const call=createStudioConnection(session,{timeoutMs:60000});const status=await call('status');const draft=await call('read');
const path='C:/Users/zFlei/repos/lux/visuals/Vinyl Cosmos - Checkpoint 2026-09-17.lux-scene';
const saved=await call('scene.save',{path,expectedDraftVersion:draft.draftVersion,overwrite:true});
await writeFile('artifacts/before-sidebar-restart.json',JSON.stringify({record,studioSession:status.studioSession,path,saved,playback:status.authoring?.playback},null,2));console.log(JSON.stringify({saved:true,path,sessionId:status.studioSession?.sessionId,playback:status.authoring?.playback}));
