import fs from 'node:fs';
import path from 'node:path';
const dir=import.meta.dirname;
const read=JSON.parse(fs.readFileSync(path.join(dir,'tuned-read.json'),'utf8'));
const values=read.status.authoring.controls;
const files={
  'quasar.ts':fs.readFileSync(path.join(dir,'quasar.ts'),'utf8'),
  'bloom.ts':fs.readFileSync(path.join(dir,'bloom.ts'),'utf8'),
  'tuned-starfield.ts':read.source.files['starfield/starfield.ts'],
};
for(const [id,value] of Object.entries(values)) {
  const pattern=new RegExp('(\\b'+id+'\\s*:\\s*\\{[^{}]*?\\bdefault\\s*:\\s*)[-+0-9.eE]+');
  let matches=0;
  for(const file of Object.keys(files)) {
    if(pattern.test(files[file])) {
      files[file]=files[file].replace(pattern,(_,prefix)=>prefix+String(value));
      matches++;
    }
  }
  if(matches!==1)throw Error('Expected exactly one default for '+id+', found '+matches);
}
for(const [name,source] of Object.entries(files))fs.writeFileSync(path.join(dir,name),source);
console.log('Baked '+Object.keys(values).length+' live values as authored defaults.');
