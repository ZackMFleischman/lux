import {readFileSync,writeFileSync} from 'node:fs';
const base='examples/components/wandering-tracers/';
const p='d10d1010-63ac-49c7-8ad7-8cf6458b5101',b='d10d2020-63ac-49c7-8ad7-8cf6458b5102',r='d10d3030-63ac-49c7-8ad7-8cf6458b5103';
const source=readFileSync(base+'painting.ts','utf8');
const controls=[...source.slice(source.indexOf('  controls: {'),source.indexOf('    controlDescriptions:')).matchAll(/^\s+(\w+): \{ type: 'number'/gm)].map(m=>m[1]);
const exposures=[...controls.map(id=>({id,nodeId:b,controlId:id})),...['count','speed','curl','sway','seed','width','pace'].map(id=>({id:'tracer'+id[0].toUpperCase()+id.slice(1),nodeId:p,controlId:id})),...['contrast','hatch','bleed'].map(id=>({id:'tracer'+id[0].toUpperCase()+id.slice(1),nodeId:r,controlId:id}))];
writeFileSync(base+'painting-composition.ts',`import { defineComposition } from '@lux/visual-sdk';
import paths from './paths.ts';
import painting from './painting.ts';
import renderer from './renderer.ts';

// One immutable snapshot drives both region carving and the visible tracer ink.
export default defineComposition({
  label: 'Living Painting — Shared Tracers',
  definitions: { paths, painting, renderer },
  nodes: [
    { id: '${p}', definition: 'paths' },
    { id: '${b}', definition: 'painting' },
    { id: '${r}', definition: 'renderer' },
  ],
  edges: [
    { id: 'd10d4010-63ac-49c7-8ad7-8cf6458b5104', from: { nodeId: '${p}', portId: 'paths' }, to: { nodeId: '${b}', portId: 'paths' }, delay: 'none' },
    { id: 'd10d4020-63ac-49c7-8ad7-8cf6458b5105', from: { nodeId: '${p}', portId: 'paths' }, to: { nodeId: '${r}', portId: 'paths' }, delay: 'none' },
    { id: 'd10d4030-63ac-49c7-8ad7-8cf6458b5106', from: { nodeId: '${b}', portId: 'image' }, to: { nodeId: '${r}', portId: 'image' }, delay: 'none' },
  ],
  output: { nodeId: '${r}', portId: 'image' },
  expose: ${JSON.stringify(exposures,null,2)},
});
`);
