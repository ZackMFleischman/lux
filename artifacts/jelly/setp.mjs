// node setp.mjs '{"bellTheme":1}'
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
execFileSync('node', ['artifacts/luxc.mjs', 'status', '{}', 'artifacts/jelly/st'], { stdio: 'ignore' });
const a = JSON.parse(readFileSync('artifacts/jelly/st.json', 'utf8')).authoring;
writeFileSync('artifacts/jelly/p.json', JSON.stringify({ instanceId: a.instanceId, expectedGeneration: a.generation, expectedRevisionId: a.revisionId, expectedControlSchemaHash: a.controlSchemaHash, mode: 'live', values: JSON.parse(process.argv[2]) }));
console.log(execFileSync('node', ['artifacts/luxc.mjs', 'parameters', '@artifacts/jelly/p.json', 'artifacts/jelly/pr']).toString().slice(0, 200));
