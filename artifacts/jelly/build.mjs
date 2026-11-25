// node build.mjs <srcDir> -> writes build-args.json using latest draftVersion from read.json
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
const dir = process.argv[2];
const files = {};
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else files[relative(dir, p).split(sep).join('/')] = readFileSync(p, 'utf8');
  }
};
walk(dir);
const r = JSON.parse(readFileSync(new URL('./read.json', import.meta.url), 'utf8'));
writeFileSync(new URL('./build-args.json', import.meta.url), JSON.stringify({
  expectedDraftVersion: r.draftVersion,
  source: { sdkVersion: '0.4.0', entry: 'visual.ts', files },
}));
