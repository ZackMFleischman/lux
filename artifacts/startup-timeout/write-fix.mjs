import fs from 'node:fs';const p='apps/studio/src/visual-worker.mjs';let s=fs.readFileSync(p,'utf8');
s=s.replace('let initializationProbe, material, componentBridge, compositionBridge, authoredCleanup, cleanupPromise, activeOperation;', 'let initializationProbe, material, componentBridge, compositionBridge, authoredCleanup, cleanupPromise, activeOperation;\nlet legacyRenders=Promise.resolve();');
s=s.replace('try{await componentBridge?.drain();if(device)', 'try{await legacyRenders;await componentBridge?.drain();if(device)');
s=s.replace('  await renderResult;\n  requireRunning();', '  await renderResult;\n  // Authors may omit returning context.renderer.render(). The frame still owns\n  // every queued render and must wait for asynchronous pipeline preparation.\n  await legacyRenders;\n  requireRunning();');
const old=`    visual=await create(freeze({...context,renderer:freeze({render:(scene,camera)=>{
      renderer.setRenderTarget(outputTarget);
      try{renderer.render(scene,camera);}finally{renderer.setRenderTarget(null);}
      presentation.render(renderer);
    }})}));`;
const neu=`    const compiledScenes=new WeakSet();
    visual=await create(freeze({...context,renderer:freeze({render:(scene,camera)=>{
      legacyRenders=legacyRenders.then(async()=>{
        requireRunning();renderer.setRenderTarget(outputTarget);
        try{
          // Driver pipeline creation must yield to the execution-loop heartbeat.
          // The composition path already uses the same first-scene preparation.
          if(!compiledScenes.has(scene)){await renderer.compileAsync(scene,camera);compiledScenes.add(scene);}
          requireRunning();renderer.render(scene,camera);
        }finally{renderer.setRenderTarget(null);}
        presentation.render(renderer);
      });
      // A visual can ignore the returned promise. draw() still observes failure.
      legacyRenders.catch(()=>{});
      return legacyRenders;
    }})}));`;
if(!s.includes(old))throw Error('missing render block');s=s.replace(old,neu);fs.writeFileSync(p,s);
