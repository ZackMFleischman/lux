import {readFileSync,writeFileSync} from 'node:fs';for(const p of ['apps/studio/src/studio.css','tests/studio/interactions.test.tsx']){writeFileSync(p,readFileSync(p,'utf8').replaceAll('\r\n','\n').trimEnd()+'\n');}
const p='artifacts/story-timeline-ui/native.mjs';let s=readFileSync(p,'utf8');s=s.replace("await initialScale.focus();await page.keyboard.press('Home');", "await page.waitForFunction(()=>document.querySelector('input[aria-label=\"Preview resolution scale\"]')?.disabled===false);await initialScale.focus();await page.keyboard.press('Home');");s=s.replace("await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent?.trim()==='Build');return b&&!b.disabled;},undefined,{timeout:90000});", "await page.waitForFunction(()=>{const el=document.querySelector('input[aria-label=\"Preview resolution scale\"]');return el&&!el.disabled&&el.value==='360';},undefined,{timeout:90000});");
s=s.replace("await scale.focus();await page.keyboard.press('Home');", "assert.equal(await scale.inputValue(),'360');");
s=s.replace(" report.runtime=await call('status');report.ok=true;",` if(process.argv[2]?.startsWith('final')){
 await page.setViewportSize({width:1440,height:960});
 const rows=page.getByRole('list',{name:'Story sequence'}).getByRole('button');
 const before=(await call('status')).authoring.storySchedule;
 await rows.nth(1).click();assert.equal(await rows.nth(1).getAttribute('aria-pressed'),'true');
 assert.equal((await call('status')).authoring.storySchedule.committed.activationId,before.committed.activationId);
 await page.screenshot({path:join(out,'selected-manual.png')});report.checks.push('Pointer selection does not move the active occurrence');
 await rows.nth(8).focus();await page.keyboard.press('Enter');assert.equal(await rows.nth(8).getAttribute('aria-pressed'),'true');
 const lastBox=await rows.nth(8).boundingBox(),ribbonBox=await page.locator('.story-ribbon').boundingBox();assert.ok(lastBox.x>=ribbonBox.x&&lastBox.x+lastBox.width<=ribbonBox.x+ribbonBox.width+2);report.checks.push('Keyboard focus reveals and selects the final occurrence');
 await page.getByRole('button',{name:/Start here: Arrival — occurrence 9 of 9/}).click();await wait(s=>s.storySchedule?.sequence.occurrenceId==='pass-9','start selected');
 if(await page.getByRole('button',{name:'Pause story',exact:true}).isVisible())await page.getByRole('button',{name:'Pause story',exact:true}).click();await wait(s=>s.storySchedule?.phase==='paused','pause selected');
 const scrub=page.getByRole('slider',{name:'Local time for Arrival'});await scrub.focus();await page.keyboard.press('End');await wait(s=>s.storySchedule?.committed.frame.localTimeSeconds>=3.9,'keyboard seek');report.checks.push('Start selected occurrence and keyboard local seek');
 await page.getByRole('button',{name:'Replay Arrival',exact:true}).click();await wait(s=>s.storySchedule?.committed.frame.localTimeSeconds<1,'replay');
 await page.getByRole('button',{name:'Loop Arrival',exact:true}).click();await wait(s=>s.storySchedule?.loop===true,'loop');report.checks.push('Replay and loop');
 await page.getByRole('button',{name:'Launch Orbital drift and tidal distortion',exact:true}).click();await wait(s=>s.storySchedule?.committed.frame.beatId==='hold'&&s.storySchedule?.sequence.state==='detached','launch sustained');assert.equal(await page.getByRole('slider',{name:/Local time/}).count(),0);
 await page.screenshot({path:join(out,'sustained.png')});report.checks.push('Manual launch detaches without a fabricated sustained scrub');
 await page.setViewportSize({width:780,height:720});await page.screenshot({path:join(out,'narrow.png')});
 const panelOverflow=await page.locator('.story-panel').evaluate(e=>e.scrollWidth>e.clientWidth+1);assert.equal(panelOverflow,false);report.checks.push('Narrow panel contains horizontal scrolling inside the sequence and beat strip');
 await page.getByRole('button',{name:'Return to normal',exact:true}).click();await wait(s=>s.storySchedule?.committed.frame.state==='normal','return normal');report.checks.push('Return to normal');
 }
 report.runtime=await call('status');report.ok=true;`);
writeFileSync(p,s);
