import { readFileSync } from 'node:fs';

const local=['composition.ts','double-mirror.ts','wrapped-mirror.ts'];
export function nestedPrismaticCompositionSource(){
  const files=Object.fromEntries(local.map(path=>[path,readFileSync(new URL(path,import.meta.url),'utf8')]));
  files['ball.ts']=readFileSync(new URL('../prismatic-composition/ball.ts',import.meta.url),'utf8');
  files['kaleidoscope.ts']=readFileSync(new URL('../prismatic-composition/kaleidoscope.ts',import.meta.url),'utf8');
  return {sdkVersion:'0.4.0',entry:'composition.ts',files};
}
