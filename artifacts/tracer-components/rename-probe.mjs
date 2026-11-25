import {mkdir,open,rename,rm,readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const root='C:/Users/zFlei/repos/lux/library';const folder=root+'/.rename-probe-'+randomUUID();const from=folder+'/staging',to=folder+'/revisions/1';const events=[];
try{
 await mkdir(from+'/source',{recursive:true});
 for(const f of ['overlay.ts','paths.ts','tracer-state.ts','renderer.ts','tracer-texture.ts','tracer-spline.ts']){const h=await open(from+'/source/'+f,'wx');try{await h.writeFile(await readFile('examples/components/wandering-tracers/'+f));await h.sync();}finally{await h.close();}}
 await mkdir(folder+'/revisions',{recursive:true});const start=Date.now();
 for(let attempt=0;attempt<10;attempt++){try{await rename(from,to);events.push({attempt,ms:Date.now()-start,result:'success'});break;}catch(e){events.push({attempt,ms:Date.now()-start,code:e.code});if(attempt<9)await new Promise(r=>setTimeout(r,100));}}
 console.log(JSON.stringify(events));await writeFile('artifacts/tracer-components/rename-probe.json',JSON.stringify(events,null,2));
}finally{if(!folder.startsWith(root+'/.rename-probe-'))throw Error('Unexpected cleanup target');await rm(folder,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
