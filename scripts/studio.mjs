import { spawn } from 'node:child_process';
import { ensureElectron, installedElectron } from './studio-electron.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { studioTestEnvironment } from './studio-session.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const smoke = process.argv.includes('--smoke');
const electron = smoke ? installedElectron(root) : ensureElectron(root);
const env = { ...(smoke ? studioTestEnvironment() : process.env), LUX_NODE_EXECUTABLE: process.execPath, LUX_WORKSPACE: root };
if (smoke) { env.LUX_STUDIO_SMOKE = '1'; delete env.LUX_STUDIO_MCP_TEST; }
else { delete env.LUX_STUDIO_SMOKE; delete env.LUX_STUDIO_MCP_TEST; }
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [resolve(root, 'apps/studio/dist/main.cjs')], { cwd: root, env, stdio: 'inherit', windowsHide: false });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
