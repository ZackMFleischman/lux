import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { nestedPrismaticCompositionSource } from '../tests/studio/fixtures/nested-prismatic-composition/source-bundle.mjs';
import { _electron } from 'playwright';
import { studioTestEnvironment, resolveStudioSession } from '../scripts/studio-session.mjs';
import { installedElectron } from '../scripts/studio-electron.mjs';

const root = resolve(import.meta.dirname, '..');
const expected=process.argv[2]; assert.match(expected??'',/^[a-f0-9]{40}$/);
for (const args of [['rev-parse','HEAD'],['diff','HEAD','--exit-code']]) {const r=spawnSync('git',['-C',root,'-c','core.fsmonitor=false','-c',`safe.directory=${root.replaceAll('\\','/')}`,...args],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0);if(args[0]==='rev-parse')assert.equal(r.stdout.trim(),expected);}
const output = join(import.meta.dirname, 'lux105', `run-${Date.now()}`);
await mkdir(output, { recursive: true });
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
const testSession = resolveStudioSession({ workspace: root, env });
delete env.ELECTRON_RUN_AS_NODE;
const report = { ok: false, candidate: expected, testSession, checks: [], screenshots: [], errors: [] };
let app, page, ownedPid, client;
try {
  app = await _electron.launch({ executablePath: installedElectron(root), args: [join(root, 'apps/studio/dist/main.cjs')], cwd: root, env, chromiumSandbox: true });
  report.launcherPid = app.process().pid; ownedPid = await app.evaluate(() => process.pid); report.ownedPid = ownedPid;
  page = await app.firstWindow(); page.setDefaultTimeout(90000);
  let endpoint; for(let i=0;i<100;i++){try{endpoint=JSON.parse(await readFile(testSession.endpointPath,'utf8'));if(endpoint.pid===ownedPid)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.equal(endpoint.pid,ownedPid);assert.equal(endpoint.workspace,root.toLowerCase());assert.equal(endpoint.profile,testSession.profile);report.endpoint={pid:endpoint.pid,workspace:endpoint.workspace,profile:endpoint.profile,sessionId:endpoint.sessionId};
  page.on('pageerror', error => report.errors.push(error.message));
  async function closeJobs() {
    const tab=page.locator('.dv-tab').filter({hasText:/^Jobs$/});
    await tab.locator('.dv-default-tab-action').click();
    await page.locator('.studio-dock-grid .studio-pane-jobs').waitFor({state:'detached'});
  }
  const footerBox = async () => page.locator('.status-bar').boundingBox();
  const assertStable = async baseline => assert.deepEqual(await footerBox(), baseline, 'footer geometry stays fixed');
  await page.getByRole('button',{name:'View',exact:true}).click();
  await page.getByRole('menuitem',{name:'Layouts…',exact:true}).click();
  await page.getByRole('button', { name: 'Reset desktop layout', exact: true }).click();
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'detached'});
  const baseline = await footerBox(); assert.ok(baseline && baseline.height === 24);
  await closeJobs();
  const spinnerSeen=page.locator('.status-build[aria-busy="true"] .status-spinner').waitFor({timeout:10000});
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await spinnerSeen; report.checks.push('Actual pending build shows footer spinner');
  const busyShot=join(output,'build-progress.png');await page.screenshot({path:busyShot});report.screenshots.push(busyShot);
  await page.getByRole('button', { name: 'Build status: Build ready. Open Jobs and diagnostics', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('.playback-state')?.textContent === 'paused');
  await assertStable(baseline);
  const success = join(output, 'successful-build.png'); await page.screenshot({ path: success }); report.screenshots.push(success);
  report.checks.push('Successful build reports Build ready with a stable footer');

  const canvas = await page.locator('.preview-surface canvas').elementHandle();
  await page.getByRole('button',{name:'Maximize',exact:true}).click();
  await page.getByRole('button',{name:'Restore workspace',exact:true}).waitFor();
  const maximized=join(output,'maximized-status.png');await page.screenshot({path:maximized});report.screenshots.push(maximized);
  await page.getByRole('button',{name:'Problems: 0. Open Jobs and diagnostics',exact:true}).focus();await page.keyboard.press('Enter');
  await page.locator('.studio-dock-grid').waitFor({state:'visible'});
  await page.locator('.studio-dock-grid .studio-pane-jobs').waitFor({state:'visible'});
  assert.equal(await page.locator('.studio-dock-grid').evaluate(n=>n.hidden),false);
  const keyboard=join(output,'maximized-keyboard-details.png');await page.screenshot({path:keyboard});report.screenshots.push(keyboard);
  await closeJobs();
  await page.getByRole('button',{name:'Maximize',exact:true}).click();
  await page.getByRole('button',{name:'Build status: Build ready. Open Jobs and diagnostics',exact:true}).click();
  await page.locator('.studio-dock-grid .studio-pane-jobs').waitFor({state:'visible'});
  assert.equal(await page.locator('.studio-dock-grid').evaluate(n=>n.hidden),false);
  assert.ok(await canvas.evaluate(n=>n.isConnected),'Preview canvas remains owned and connected');
  assert.deepEqual(await footerBox(),baseline);
  const pointer=join(output,'maximized-pointer-details.png');await page.screenshot({path:pointer});report.screenshots.push(pointer);
  report.checks.push('Keyboard and pointer status actions restore maximized workspace and visibly focus Jobs without replacing Preview');report.ok=true;
} catch (error) {
  report.failure = error.stack || String(error);
  if (page && !page.isClosed()) { const failure = join(output, 'failure.png'); await page.screenshot({ path: failure }).catch(() => {}); report.screenshots.push(failure); }
  process.exitCode = 1;
} finally {
  await client?.close().catch(()=>{});
  if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
  await new Promise(resolve => setTimeout(resolve, 500));
  try { process.kill(ownedPid, 0); report.ownedProcessExited = false; } catch { report.ownedProcessExited = true; }
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));





