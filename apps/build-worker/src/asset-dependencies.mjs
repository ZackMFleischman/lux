// Inventory the actual installed codec implementations used by asset admission.
// These are trusted distribution files, never paths supplied by visual source.
import { readFile, readdir, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
const versions = {'fast-png':'8.0.0',pako:'2.1.0','jpeg-js':'0.4.4',fflate:'0.8.2',iobuffer:'6.0.1'};
const fail = message => { throw Object.assign(Error(message),{code:'SERVICE_UNAVAILABLE'}); };
async function packageRoot(entry, name) {
  let at = dirname(await realpath(entry));
  for (let i=0;i<8;i++,at=dirname(at)) {
    try {
      const metadata = JSON.parse(await readFile(join(at,'package.json'),'utf8'));
      if (metadata.name === name) {
        if (metadata.version !== versions[name]) fail(`Install pinned ${name}@${versions[name]}`);
        return at;
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  fail(`Codec package root unavailable: ${name}`);
}
export async function assetDependencyPaths(root) {
  const paths = {'compiler/asset-dependencies.mjs':fileURLToPath(import.meta.url)};
  for (const name of ['index.mjs','limits.mjs','png.mjs','jpeg.mjs']) paths[`assets/${name}`]=join(root,'packages/assets/src',name);
  const requireAsset = createRequire(join(root,'packages/assets/src/index.mjs'));
  const roots = {};
  for (const name of ['fast-png','pako','jpeg-js']) roots[name]=await packageRoot(requireAsset.resolve(name),name);
  const requirePng = createRequire(join(roots['fast-png'],'package.json'));
  for (const name of ['fflate','iobuffer']) roots[name]=await packageRoot(requirePng.resolve(name),name);
  let count=0,total=0;
  for (const [name,base] of Object.entries(roots)) {
    const pending=[''];
    while(pending.length) {
      const directory=pending.pop();
      for(const item of await readdir(join(base,directory),{withFileTypes:true})) {
        if(item.name==='node_modules')continue;
        const suffix=join(directory,item.name),path=join(base,suffix);
        if(item.isDirectory()) { pending.push(suffix); continue; }
        if(!/\.(?:[cm]?js|json)$/.test(item.name))continue;
        const inside=relative(base,await realpath(path));
        if(inside.startsWith('..')||isAbsolute(inside))fail('Codec inventory escapes installed package');
        total+=(await readFile(path)).byteLength;
        if(++count>1024||total>16777216)fail('Codec dependency inventory exceeds bounds');
        paths[`codec/${name}/${suffix.replaceAll('\\','/')}`]=path;
      }
    }
  }
  return paths;
}
