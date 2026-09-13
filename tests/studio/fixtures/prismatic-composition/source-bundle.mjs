import { readFileSync } from 'node:fs';
const files=['composition.ts','ball.ts','kaleidoscope.ts'];
export function prismaticCompositionSource(){return {sdkVersion:'0.4.0',entry:'composition.ts',files:Object.fromEntries(files.map(path=>[path,readFileSync(new URL(path,import.meta.url),'utf8')]))};}
