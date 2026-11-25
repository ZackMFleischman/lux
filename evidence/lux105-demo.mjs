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

  const problems = page.getByRole('button', { name: 'Problems: 0. Open Jobs and diagnostics', exact: true });
  await problems.focus(); assert.equal(await problems.evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Enter');
  await page.locator('.studio-dock-grid .studio-pane-jobs').waitFor();
  assert.ok(await page.locator('.dv-tab').filter({ hasText: /^Jobs$/ }).count());
  report.checks.push('Keyboard Enter on a footer item reopens the closed Jobs pane');

  const editor = page.getByRole('textbox', { name: 'TypeScript source visual.ts', exact: true });
  const original = await editor.innerText();
  await closeJobs();
  await editor.fill(`${original}\n%%% invalid LUX105 candidate`);
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.getByRole('button', { name: 'Build status: Build failed. Open Jobs and diagnostics', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Problems: 1. Open Jobs and diagnostics', exact: true }).waitFor();
  assert.equal(await page.locator('.studio-dock-grid .studio-pane-jobs').count(), 0);
  assert.ok(await page.locator('.preview-surface canvas').count(), 'failed candidate preserves the working preview');
  await assertStable(baseline);
  const failed = join(output, 'failed-build-closed-details.png'); await page.screenshot({ path: failed }); report.screenshots.push(failed);
  await page.getByRole('button', { name: 'Build status: Build failed. Open Jobs and diagnostics', exact: true }).focus();
  await page.keyboard.press('Enter'); await page.locator('.studio-dock-grid .studio-pane-jobs').waitFor();
  report.checks.push('Failed build stays visible with Jobs closed, preserves preview, and opens details from the keyboard');

  await editor.fill(original);
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.getByRole('button', { name: 'Build status: Build ready. Open Jobs and diagnostics', exact: true }).waitFor();
  const faulting = original.replace('update(frame) { level.value', "update(frame) { if (frame.controls.intensity > 0.9) throw Error('LUX105 runtime failure'); level.value");
  assert.notEqual(faulting, original);
  await editor.fill(faulting);
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.getByRole('button', { name: 'Build status: Build ready. Open Jobs and diagnostics', exact: true }).waitFor();
  await closeJobs();
  const slider = page.getByRole('slider', { name: 'Intensity', exact: true });
  await slider.focus(); await page.keyboard.press('End');
  await page.getByRole('button', { name: 'Runtime status: Failed. Open Jobs and diagnostics', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Problems: 1. Open Jobs and diagnostics', exact: true }).waitFor();
  assert.equal(await page.locator('.studio-dock-grid .studio-pane-jobs').count(), 0);
  await assertStable(baseline);
  const runtimeFailure = join(output, 'runtime-failure-closed-details.png'); await page.screenshot({ path: runtimeFailure }); report.screenshots.push(runtimeFailure);
  await page.getByRole('button', { name: 'Runtime status: Failed. Open Jobs and diagnostics', exact: true }).focus();
  await page.keyboard.press('Enter'); await page.locator('.studio-dock-grid .studio-pane-jobs').waitFor();
  assert.match(await page.locator('.studio-pane-jobs').innerText(), /LUX105 runtime failure/);
  const details = join(output, 'runtime-failure-details.png'); await page.screenshot({ path: details }); report.screenshots.push(details);
  report.checks.push('Runtime failure stays visible with Jobs closed and keyboard navigation reveals its exact detail');
  client=new Client({name:'lux105-combined-qa',version:'1.0.0'});
  await client.connect(new StdioClientTransport({command:process.execPath,args:[join(root,'scripts/studio-mcp.mjs')],cwd:root,env:{...env,LUX_STUDIO_SESSION_ID:endpoint.sessionId}}));
  const call=async(name,args={})=>{const result=await client.callTool({name:'lux.studio.'+name,arguments:args},undefined,{timeout:90000});assert.equal(result.isError,undefined,JSON.stringify(result));return JSON.parse(result.content.find(x=>x.type==='text').text);};
  const draft=await call('read');await call('build',{expectedDraftVersion:draft.draftVersion,source:nestedPrismaticCompositionSource()});
  assert.equal(await page.locator('.preview-panel').getByText('Error: LUX105 runtime failure',{exact:true}).count(),0,'Successful replacement clears stale command error');await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('menuitem',{name:'Graph',exact:true}).click();await page.getByRole('menu').waitFor({state:'detached'});
  await page.getByRole('button',{name:/Double mirror 1/}).click();
  await page.locator('.inspector').getByRole('spinbutton',{name:'firstSegments · Mirror segments value',exact:true}).waitFor({state:'visible'});
  await page.getByRole('button',{name:'Open component',exact:true}).click();
  await page.getByRole('navigation',{name:'Component breadcrumb'}).waitFor({state:'visible'});
  const nestedShot=join(output,'combined-nested-controls.png');await page.screenshot({path:nestedShot});report.screenshots.push(nestedShot);report.checks.push('Combined standard View opens nested Graph; selected composite control is visible in shared Disclosure; child breadcrumb opens');
  assert.deepEqual(report.errors, []);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(820,700));await page.waitForFunction(()=>innerWidth===820&&innerHeight===700);await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});await page.waitForTimeout(1000);report.narrowGeometry=await page.evaluate(()=>({innerWidth,innerHeight,scrollX,scrollY,document:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},elements:[...document.querySelectorAll(".studio,.studio-dock-shell,.studio-dock-grid,.status-bar")].map(n=>({class:n.className,box:n.getBoundingClientRect().toJSON(),scrollWidth:n.scrollWidth,scrollHeight:n.scrollHeight}))}));console.log(JSON.stringify({narrow:report.narrowGeometry}));assert.ok(report.narrowGeometry.document.w<=report.narrowGeometry.innerWidth);const narrow=join(output,'narrow-status.png');await page.screenshot({path:narrow});report.screenshots.push(narrow);report.footer = baseline; report.ok = true;
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




