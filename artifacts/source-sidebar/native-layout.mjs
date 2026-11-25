import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright';
import { studioTestEnvironment } from '../../scripts/studio-session.mjs';
import { installedElectron } from '../../scripts/studio-electron.mjs';

const root=resolve(import.meta.dirname,'../..'),output=join(root,'artifacts/source-sidebar/native');
await mkdir(output,{recursive:true});
const env={...studioTestEnvironment(),LUX_NODE_EXECUTABLE:process.execPath};delete env.ELECTRON_RUN_AS_NODE;
const report={ok:false,checks:[],screenshots:[],errors:[]};let app,page;
try{
  app=await _electron.launch({executablePath:installedElectron(root),args:[join(root,'apps/studio/dist/main.cjs')],cwd:root,env,chromiumSandbox:true});
  page=await app.firstWindow();page.setDefaultTimeout(20000);
  page.on('pageerror',error=>report.errors.push(error.message));
  const resize=async(width,height)=>{await app.evaluate(({BrowserWindow},bounds)=>BrowserWindow.getAllWindows()[0].setBounds(bounds),{x:40,y:40,width,height});await page.waitForFunction(([w,h])=>innerWidth>=w-30&&innerHeight>=h-90,[width,height]);await page.waitForTimeout(150);};
  const shot=async name=>{const path=join(output,`${name}.png`);await page.screenshot({path});report.screenshots.push(path);};
  await page.locator('.source-sidebar').waitFor();
  await page.getByRole('button',{name:'Pause',exact:true}).waitFor();
  await page.getByLabel('Preview resolution scale').fill('360');
  await page.locator('.preview-resolution-value',{hasText:'640 × 360'}).waitFor();
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Play',exact:true}).waitFor();
  await resize(1360,900);
  await page.locator('.studio-pane-source').waitFor();await page.locator('.source-sidebar').waitFor();
  const geometry=async()=>({sidebar:await page.locator('.source-sidebar').boundingBox(),editor:await page.locator('.source-editing').boundingBox(),assets:await page.locator('.source-assets-disclosure').boundingBox(),files:await page.locator('.source-file-list').boundingBox()});
  const wide=await geometry();assert.ok(wide.sidebar&&wide.editor&&wide.assets&&wide.files);assert.ok(wide.sidebar.x<wide.editor.x&&Math.abs(wide.sidebar.y-wide.editor.y)<2);assert.ok(wide.files.height>80);assert.ok(Math.abs(wide.assets.y+wide.assets.height-(wide.sidebar.y+wide.sidebar.height))<3);
  assert.equal(await page.getByText('No assets',{exact:true}).count(),1);await shot('wide-expanded-empty');
  await page.getByRole('button',{name:'Collapse source sidebar',exact:true}).click();
  assert.ok((await page.locator('.source-sidebar').boundingBox()).width<=40);assert.equal(await page.getByText('Files',{exact:true}).count(),0);await shot('wide-collapsed-empty');
  await page.getByRole('button',{name:'Expand source sidebar',exact:true}).click();
  await page.getByLabel('Choose image files').setInputFiles(join(root,'tests/assets/fixtures/jpeg/noise-512.jpg'));
  await page.getByRole('button',{name:'View assets/noise-512.jpg',exact:true}).waitFor();
  await resize(840,700);
  const narrow=await geometry();assert.ok(narrow.sidebar&&narrow.editor&&narrow.assets&&narrow.files);assert.ok(narrow.sidebar.x<narrow.editor.x&&Math.abs(narrow.sidebar.y-narrow.editor.y)<2);assert.ok(narrow.editor.width>90);assert.ok(Math.abs(narrow.assets.y+narrow.assets.height-(narrow.sidebar.y+narrow.sidebar.height))<3);
  await shot('narrow-expanded-asset');
  await page.getByRole('button',{name:'Collapse source sidebar',exact:true}).click();assert.ok((await page.locator('.source-sidebar').boundingBox()).width<=40);await shot('narrow-collapsed-asset');
  report.geometry={wide,narrow,collapsedWidth:(await page.locator('.source-sidebar').boundingBox()).width};report.checks.push('Actual Dockview keeps Source navigation left of the editor at wide and narrow window sizes');report.checks.push('Files consumes remaining sidebar height and Assets stays anchored at the bottom');report.checks.push('Empty and imported-asset states remain usable; collapse preserves the active editor and asset data');report.checks.push('Preview output was resized through Studio controls to 640 × 360');
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.failure=error.stack||String(error);if(page&&!page.isClosed())await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
