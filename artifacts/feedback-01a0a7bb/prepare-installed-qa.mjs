import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join, dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

// Reuse the reviewed native scenarios against the packaged executable. Keep
// source fixtures and artifacts in the checkout; connect to the package profile.
const root=resolve(import.meta.dirname,'../..');
const record=JSON.parse(await readFile(process.argv[2],'utf8'));
const destination=join(import.meta.dirname,'installed-qa');
await mkdir(destination,{recursive:true});
for(const name of ['test-scene-control-animation.mjs','test-studio-capture.mjs']) {
  let source=await readFile(join(root,'scripts',name),'utf8');
  source=source.replaceAll(/from (['"])(\.{1,2}\/[^'"]+)\1/g,(_match,quote,path)=>`from ${quote}${pathToFileURL(resolve(root,'scripts',path)).href}${quote}`);
  source=source.replace(/const root\s*=\s*resolve\(import\.meta\.dirname,\s*['"]\.\.['"]\);/,`const root=${JSON.stringify(root)};\nconst installation=${JSON.stringify(record)};`);
  source=source.replaceAll('installedElectron(root)','installation.executable');
  source=source.replace(/args:\s*\[join\(root,\s*['"]apps\/studio\/dist\/main\.cjs['"]\)\]/,'args: []');
  source=source.replace(/cwd:\s*root,\s*env/,'cwd: installation.directory, env');
  source=source.replace('resolveStudioSession({workspace:root,env})','resolveStudioSession({workspace:installation.workspace,env})');
  source=source.replace(/const report\s*=\s*\{/, 'const report={installation:recordPlaceholder,');
  source=source.replace('installation:recordPlaceholder','installation:{sourceCommit:installation.sourceCommit,executable:installation.executable,workspace:installation.workspace}');
  await writeFile(join(destination,name),source);
}
const libraryHarness=join(root,'.worktrees/standard-library/artifacts/standard-library-native/run-library-qa.mjs');
let library=await readFile(libraryHarness,'utf8');
const libraryBody=library.indexOf('const root');
library=library.slice(0,libraryBody).replaceAll(/from (['"])(\.{1,2}\/[^'"]+)\1/g,(_match,quote,path)=>`from ${quote}${pathToFileURL(resolve(dirname(libraryHarness),path)).href}${quote}`)+library.slice(libraryBody);
library=library.replace(/const root\s*=\s*resolve\(import\.meta\.dirname,\s*['"]\.\.\/\.\.['"]\);/,`const root=${JSON.stringify(root)};\nconst installation=${JSON.stringify(record)};`);
library=library.replaceAll('installedElectron(root)','installation.executable');
library=library.replace(/args:\s*\[join\(root,\s*['"]apps\/studio\/dist\/main\.cjs['"]\)\]/,'args: []');
library=library.replace(/cwd:\s*root,\s*env,\s*timeout/,'cwd: installation.directory, env, timeout');
library=library.replace('command: process.execPath','command: installation.node');
library=library.replace("args: [join(root, 'scripts/studio-mcp.mjs')], cwd: root, env",'args: [installation.adapter], cwd: installation.workspace, env');
library=library.replace("commit: 'add6587b21410ea42699c6985553ff8a0708ba92'",'commit: installation.sourceCommit, installation');
await writeFile(join(destination,'library-qa.mjs'),library);
console.log(destination);
