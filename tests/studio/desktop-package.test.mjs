import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import vm from 'node:vm';
import { ComponentLibraryStore } from '../../packages/core/src/component-library-store.ts';
import * as packaging from '../../scripts/studio-package.mjs';
import { copyIndependentTree, desktopSourceFile, dependencySelection, installedMainSource, repositoryLibraryRootFromCommonDirectory } from '../../scripts/studio-package.mjs';

test('package source selection excludes private and development files', () => {
 for(const p of ['packages/visual-sdk/src/index.ts','scripts/studio-compile.mjs','scripts/studio-library-context.mjs','apps/build-worker/src/worker.mjs','library/catalog.json','library/components/11111111-1111-4111-8111-111111111111/revisions/1/source/component.ts','package.json']) assert.ok(desktopSourceFile(p),p);
 for(const p of ['.env.local','visuals/private.lux','tools/live-copilot/server.ts','artifacts/scene.json','.git/config','docs/private.md']) assert.equal(desktopSourceFile(p),false,p);
});

test('desktop library snapshot includes newly saved files and retained history without unrelated files', async t => {
 const root=await mkdtemp(join(tmpdir(),'lux-package-library-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'library'),destination=join(root,'package','library');
 const store=new ComponentLibraryStore(source);
 const first=await store.create({name:'New untracked component',description:'Saved after the last commit.',source:{sdkVersion:'0.4.0',entry:'component.ts',files:{'component.ts':'export const value=1;'}}});
 await store.update({id:first.id,expectedRevision:1,name:first.name,description:first.description,source:{...first.source,files:{'component.ts':'export const value=2;'}}});
 await rm(join(source,'components',first.id,'revisions','1'),{recursive:true});
 await writeFile(join(source,'.env.local'),'private');
 const catalogBefore=await readFile(join(source,'catalog.json'),'utf8');
 const copied=await packaging.copyDesktopLibrary(source,destination);
 assert.ok(copied.includes(`components/${first.id}/revisions/2/source/component.ts`));
 assert.equal(copied.includes('.env.local'),false);
 assert.equal(copied.includes('.write.lock'),false);
 assert.equal((await new ComponentLibraryStore(destination).read(first.id)).revision,2);
 assert.equal(await readFile(join(destination,'components',first.id,'revisions','2','source','component.ts'),'utf8'),'export const value=2;');
 assert.equal(await readFile(join(source,'catalog.json'),'utf8'),catalogBefore);
});

test('desktop packaging records the primary repository library for linked worktrees',()=>{
 assert.equal(repositoryLibraryRootFromCommonDirectory('C:/repo/lux/.git'),join('C:/repo/lux','library'));
 assert.throws(()=>repositoryLibraryRootFromCommonDirectory('C:/repo/lux/.git/worktrees/feature'),/common directory/i);
});

test('installed bootstrap discards inherited library overrides except for isolated test launches',()=>{
 const run=env=>{
  const process={env:{...env}};
  vm.runInNewContext(installedMainSource('C:/repo/lux/library'),{__dirname:'C:/installed/app',process,
   require:id=>id==='node:path'?path:undefined});
  return process.env;
 };
 assert.equal(run({LUX_STUDIO_LIBRARY_ROOT:'C:/unsafe/inherited'}).LUX_STUDIO_LIBRARY_ROOT,undefined);
 assert.equal(run({LUX_STUDIO_MCP_TEST:'1',LUX_STUDIO_PROFILE:'test-isolated',LUX_STUDIO_LIBRARY_ROOT:'C:/temp/library'}).LUX_STUDIO_LIBRARY_ROOT,'C:/temp/library');
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
