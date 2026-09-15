import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copyIndependentTree, desktopSourceFile, dependencySelection } from '../../scripts/studio-package.mjs';

test('package source selection excludes private and development files', () => {
 for(const p of ['packages/visual-sdk/src/index.ts','scripts/studio-compile.mjs','apps/build-worker/src/worker.mjs','package.json']) assert.ok(desktopSourceFile(p),p);
 for(const p of ['.env.local','visuals/private.lux','tools/live-copilot/server.ts','artifacts/scene.json','.git/config','docs/private.md']) assert.equal(desktopSourceFile(p),false,p);
});

test('dependency copy relocates internal links and copies bytes independently', async t => {
 const root=await mkdtemp(join(tmpdir(),'lux-package-')); t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'source'),dest=join(root,'copy');
 await mkdir(join(source,'.store','dep'),{recursive:true});
 await writeFile(join(source,'.store','dep','index.js'),'original');
 await symlink(join(source,'.store','dep'),join(source,'dep'),process.platform==='win32'?'junction':'dir');
 await copyIndependentTree(source,dest);
 assert.ok((await realpath(join(dest,'dep'))).startsWith(dest));
 await writeFile(join(source,'.store','dep','index.js'),'modified');
 assert.equal(await readFile(join(dest,'dep','index.js'),'utf8'),'original');
});

test('dependency copy rejects links outside the package tree', async t => {
 const root=await mkdtemp(join(tmpdir(),'lux-package-')); t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'source'); await mkdir(source);
 await symlink(root,join(source,'escape'),process.platform==='win32'?'junction':'dir');
 await assert.rejects(copyIndependentTree(source,join(root,'copy')),/outside/);
});

test('dependency selection includes transitive packages without unrelated tools',async t=>{
 const root=await mkdtemp(join(tmpdir(),'lux-closure-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'modules'),dest=join(root,'copy');
 const a=join(source,'.pnpm','a@1','node_modules','a'),b=join(source,'.pnpm','b@1','node_modules','b');
 for(const path of [a,b,join(source,'.pnpm','unused@1','node_modules','unused')]){await mkdir(path,{recursive:true});await writeFile(join(path,'index.js'),'module');}
 const type=process.platform==='win32'?'junction':'dir';
 await symlink(a,join(source,'a'),type);await symlink(b,join(a,'..','b'),type);
 const select=await dependencySelection(source,['a']);
 assert.ok(select('.pnpm/b@1/node_modules/b/index.js'));assert.equal(select('.pnpm/unused@1'),false);
 await copyIndependentTree(source,dest,new Map(),select);
 assert.equal(await readFile(join(dest,'.pnpm','a@1','node_modules','b','index.js'),'utf8'),'module');
 await assert.rejects(readFile(join(dest,'.pnpm','unused@1','node_modules','unused','index.js')),/ENOENT/);
});
