import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = new URL('../tests/project/', import.meta.url);
const tests = readdirSync(directory, { recursive: true }).filter(path => /\.test\.(?:ts|mjs)$/.test(path)).sort().map(path => fileURLToPath(new URL(path.replaceAll('\\', '/'), directory)));
if (!tests.length) throw Error('No project CPU tests discovered');
const result = spawnSync(process.execPath, ['--test', ...tests], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
