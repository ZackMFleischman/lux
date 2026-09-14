import { readFileSync } from 'node:fs';

const local=['composition.ts','double-mirror.ts','wrapped-mirror.ts','ball.ts','kaleidoscope.ts'];
export function nestedPrismaticCompositionSource(){
  return {sdkVersion:'0.4.0',entry:'composition.ts',files:Object.fromEntries(local.map(path=>[path,readFileSync(new URL(path,import.meta.url),'utf8')]))};
}
