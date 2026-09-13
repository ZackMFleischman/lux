import { useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Button } from '@mui/material';
import { assetLimits, validateAssetPath, type SourceAssets } from '../../../../packages/assets/src/index.mjs';
import { sourceAssets } from './source-equality.ts';
import type { SourceWorkspace } from './workspace.ts';

const createWorker = () => new Worker(new URL('./source-admission-worker.js',window.location.href),{type:'module'});
/** Imports originals as an unsaved source edit; rendering still needs explicit apply. */
export function AssetImport({workspace,readOnly=false}:{workspace:SourceWorkspace;readOnly?:boolean}) {
  const snapshot=useSyncExternalStore(workspace.subscribe,workspace.getSnapshot);
  const input=useRef<HTMLInputElement>(null),target=useRef<string|null>(null);
  const [reading,setReading]=useState(false),[error,setError]=useState('');
  const locked=readOnly||snapshot.busy||reading, assets=sourceAssets(snapshot.source);
  async function readFiles(files:File[]) {
    const before=workspace.getSnapshot(),next:Record<string,SourceAssets[string]>={...sourceAssets(before.source)};
    setReading(true);setError('');
    try {
      if(files.length>assetLimits.count)throw Error('Import at most four images');
      for(const file of files) {
        if(file.size>assetLimits.imageBytes)throw Error('Image exceeds the original-byte limit');
        const match=file.name.toLowerCase().match(/\.(bmp|png|jpe?g)$/);
        if(!match)throw Error('Choose a BMP, PNG or JPEG image');
        const extension=match[1]!,mediaType=extension==='bmp'?'image/bmp':extension==='png'?'image/png':'image/jpeg';
        const stem=file.name.slice(0,-extension.length-1).replace(/[^A-Za-z0-9_-]/g,'_')||'image';
        const path=target.current??`assets/${stem}.${extension}`;
        validateAssetPath(path);
        if(target.current===null&&Object.keys(next).some(key=>key.toLowerCase()===path.toLowerCase()))throw Error(`Image already exists: ${path}. Use Replace.`);
        const bytes=new Uint8Array(await file.arrayBuffer());
        if(bytes.byteLength!==file.size||bytes.byteLength>assetLimits.imageBytes)throw Error('Image changed during import or exceeds the byte limit');
        let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
        next[path]={mediaType,encoding:'base64',data:btoa(binary)};
      }
      await workspace.editAssetsAsync(next,before.version,createWorker);
    } catch(reason) {setError(String(reason instanceof Error?reason.message:reason));}
    finally {setReading(false);target.current=null;if(input.current)input.current.value='';}
  }
  return <section aria-label="Image assets">
    <Button disabled={locked} onClick={()=>{target.current=null;if(input.current){input.current.multiple=true;input.current.click();}}}>Import images</Button>
    <input ref={input} type="file" accept=".bmp,.png,.jpg,.jpeg" hidden aria-label="Choose image files" onChange={event=>{const files=Array.from(event.target.files??[]);if(files.length)void readFiles(files);}} />
    {Object.keys(assets).map(path=><div key={path}><span>{path}</span>
      <Button disabled={locked} aria-label={`Replace ${path}`} onClick={()=>{target.current=path;if(input.current){input.current.multiple=false;input.current.click();}}}>Replace</Button>
      <Button disabled={locked} aria-label={`Remove ${path}`} onClick={()=>{const before=workspace.getSnapshot(),next={...sourceAssets(before.source)};delete next[path];void workspace.editAssetsAsync(next,before.version,createWorker).catch(reason=>setError(String(reason)));}}>Remove</Button>
    </div>)}
    {reading&&<span role="status">Reading image…</span>}{snapshot.busy&&<span role="status">Validating images…</span>}
    {error&&<Alert severity="error">{error}</Alert>}
  </section>;
}
