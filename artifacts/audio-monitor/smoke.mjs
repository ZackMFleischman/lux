import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {_electron} from 'playwright';
const root=resolve(process.argv[2]);
const {installedElectron}=await import(pathToFileURL(join(root,'scripts/studio-electron.mjs')));
const {studioTestEnvironment}=await import(pathToFileURL(join(root,'scripts/studio-session.mjs')));
const output=resolve('artifacts/audio-monitor');
await mkdir(output,{recursive:true});
let app,child;
try {
 app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env:{...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath},chromiumSandbox:true});
 child=app.process();const page=await app.firstWindow();page.setDefaultTimeout(15000);await page.setViewportSize({width:1360,height:900});
 const device=page.getByRole('combobox',{name:'Audio input device',exact:true});await device.click();
 await page.getByRole('option',{name:/CABLE Output \(VB-Audio Virtual Cable\)/i}).click();
 await page.getByRole('button',{name:'Connect',exact:true}).click();await page.getByLabel('Audio input Connected',{exact:true}).waitFor();
 const monitor=page.getByRole('button',{name:/Monitor/});assert.equal(await monitor.getAttribute('aria-pressed'),'false');
 await monitor.click();assert.equal(await monitor.getAttribute('aria-pressed'),'true');
 await page.screenshot({path:join(output,'monitor-on.png')});
 await monitor.click();assert.equal(await monitor.getAttribute('aria-pressed'),'false');
 await monitor.click();await page.getByRole('button',{name:'Disconnect',exact:true}).click();
 await page.getByLabel('Audio input Disconnected',{exact:true}).waitFor();assert.equal(await monitor.count(),0);
 await writeFile(join(output,'result.json'),JSON.stringify({ok:true,root,pid:child.pid,checks:['CABLE connected','Monitor off by default','Monitor on/off','Disconnect disables monitoring']},null,2));
} finally {if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});console.log(JSON.stringify({pid:child.pid,exitCode:child.exitCode}));}}

