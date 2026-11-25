import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {_electron} from 'playwright';
import {installedElectron} from '../scripts/studio-electron.mjs';
import {studioTestEnvironment} from '../scripts/studio-session.mjs';

const root=resolve(import.meta.dirname,'..'),out=join(root,'artifacts','preview-fps',`run-${Date.now()}`);await mkdir(out,{recursive:true});const report={ok:false};let app;
try{app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env:{...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath}});const page=await app.firstWindow();page.setDefaultTimeout(30000);await page.getByRole('button',{name:'Build',exact:true}).waitFor();await page.getByText('Build ready',{exact:true}).waitFor();const scale=page.getByRole('slider',{name:'Preview resolution scale'});await scale.fill('360');await page.locator('.preview-resolution-value').waitFor();report.pausedFps=await page.locator('.preview-fps').innerText();await page.screenshot({path:join(out,'preview-fps-paused-640x360.png')});report.ok=true;}catch(error){report.error=String(error.stack??error);process.exitCode=1;}finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}await writeFile(join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,...report}));}
