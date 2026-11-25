import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const root=resolve(import.meta.dirname,'../..');
const installation=JSON.parse(await readFile(process.argv[2],'utf8'));
const destination=join(import.meta.dirname,'final-installed-qa');
await mkdir(destination,{recursive:true});
for(const name of ['test-studio-shortcuts.mjs','test-studio-preview-lifecycle.mjs']) {
  let source=await readFile(join(root,'scripts',name),'utf8');
  source=source.replaceAll(/from (['"])(\.{1,2}\/[^'"]+)\1/g,(_match,quote,path)=>`from ${quote}${pathToFileURL(resolve(root,'scripts',path)).href}${quote}`);
  function replaceRequired(pattern,replacement){const next=source.replace(pattern,replacement);if(next===source)throw Error(`Missing harness substitution: ${name}: ${pattern}`);source=next;}
  replaceRequired(/const root\s*=\s*resolve\(import\.meta\.dirname,\s*['"]\.\.['"]\);/,`const root=${JSON.stringify(root)};\nconst installation=${JSON.stringify(installation)};`);
  replaceRequired('installedElectron(root)','installation.executable');
  replaceRequired(/args:\s*\[join\(root,\s*['"]apps\/studio\/dist\/main\.cjs['"]\)\]/,'args: []');
  replaceRequired(/cwd:\s*root,\s*env/,'cwd: installation.directory, env');
  replaceRequired(/const report\s*=\s*\{/,'const report={installation,');
  if(name.includes('lifecycle')) {
    replaceRequired('resolveStudioSession({workspace:root,env})','resolveStudioSession({workspace:installation.workspace,env})');
    replaceRequired("join(root,'artifacts','preview-lifecycle',`run-${Date.now()}`)","join(root,'artifacts/feedback-01a0a7bb/final-installed-qa',`lifecycle-${Date.now()}`)");
  } else {
    replaceRequired("join(root, 'artifacts/studio-ui/shortcuts')","join(root, 'artifacts/feedback-01a0a7bb/final-installed-qa/shortcuts')");
  }
  await writeFile(join(destination,name),source);
}
console.log(destination);
