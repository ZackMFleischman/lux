import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('shortcut activation preflights both paths and preserves existing shortcuts on conflict',{skip:process.platform!=='win32'},async t=>{
 const temp=await mkdtemp(join(tmpdir(),'lux-shortcuts-'));t.after(()=>rm(temp,{recursive:true,force:true}));
 const root=join(temp,'Programs','Lux'),directory=join(root,'builds','one'),workspace=join(directory,'runtime');
 const desktop=join(temp,'Desktop'),programs=join(temp,'Start');
 for(const path of [desktop,programs,join(workspace,'apps/studio/assets/branding')])await mkdir(path,{recursive:true});
 await writeFile(join(workspace,'apps/studio/assets/branding/lux.ico'),'fixture');
 const record={directory,workspace,executable:join(directory,'Lux.exe')};
 const recordPath=join(directory,'installation.json');await writeFile(recordPath,JSON.stringify(record));
 const run=()=>spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('scripts/studio-shortcuts.ps1'),'-Record',recordPath,'-DesktopFolder',desktop,'-ProgramsFolder',programs],{env:{...process.env,LOCALAPPDATA:temp},encoding:'utf8',windowsHide:true});
 let result=run();assert.equal(result.status,0,result.stderr);
 const before=await readFile(join(desktop,'Lux.lnk'));const receipt=await readFile(join(root,'installation.json'));
 const foreign=Buffer.from('unrelated invalid shortcut');await writeFile(join(programs,'Lux.lnk'),foreign);
 result=run();assert.notEqual(result.status,0);
 assert.deepEqual(await readFile(join(desktop,'Lux.lnk')),before);
 assert.deepEqual(await readFile(join(programs,'Lux.lnk')),foreign);
 assert.deepEqual(await readFile(join(root,'installation.json')),receipt);
});
