import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readDesktopInstallation } from '../../scripts/studio-desktop.mjs';

test('installed discovery accepts only the recorded self-contained paths',async t=>{
 const root=await mkdtemp(join(tmpdir(),'lux-install-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=join(root,'builds','one'), workspace=join(directory,'resources','app','runtime');
 const record={version:1,profile:'desktop',directory,workspace,executable:join(directory,'Lux.exe'),node:join(directory,'resources','app','node.exe'),adapter:join(workspace,'scripts','studio-installed-mcp.mjs')};
 for(const p of [record.executable,record.node,record.adapter]) {await mkdir(join(p,'..'),{recursive:true});await writeFile(p,'fixture');}
 await writeFile(join(directory,'installation.json'),JSON.stringify(record));await writeFile(join(root,'installation.json'),JSON.stringify(record));
 assert.deepEqual(await readDesktopInstallation({root}),record);
 await writeFile(join(root,'installation.json'),JSON.stringify({...record,adapter:process.execPath}));
 await assert.rejects(readDesktopInstallation({root}),/Invalid installed adapter/);
 await writeFile(join(root,'installation.json'),JSON.stringify({...record,directory:root}));
 await assert.rejects(readDesktopInstallation({root}),/Invalid Lux installation/);
});
