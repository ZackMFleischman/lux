import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { decodeBmp, decodeCanonicalBase64 } from '../../../../packages/assets/src/index.mjs';

type Asset = { mediaType: string; encoding: string; data: string };
type Pixels = { width: number; height: number; data: Uint8Array };
type Preview = {pixels:Pixels|null;byteLength:number;error:string};
const previews=new WeakMap<Asset,Promise<Preview>>();
function loadPreview(asset:Asset):Promise<Preview> {
  const cached=previews.get(asset);if(cached)return cached;
  const result=new Promise<Preview>(resolve=>{
    let worker:Worker|undefined,timer:ReturnType<typeof setTimeout>|undefined;
    const finish=(result:Preview)=>{clearTimeout(timer);worker?.terminate();resolve(result);};
    const failed=()=>finish({pixels:null,byteLength:0,error:'Image unavailable: unsupported or invalid image.'});
    try {
      worker=new Worker(new URL('./image-preview-worker.js',window.location.href),{type:'module'});
      timer=setTimeout(failed,2000);worker.onerror=failed;worker.onmessageerror=failed;
      worker.onmessage=event=>{
        const result=event.data,p=result?.pixels;
        if(result?.ok!==true||!p||!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.width>512||p.height<1||p.height>512||!(p.data instanceof Uint8Array)||p.data.length!==p.width*p.height*4)return failed();
        finish({pixels:p,byteLength:result.byteLength,error:''});
      };
      worker.postMessage({asset});
    } catch {failed();}
  });previews.set(asset,result);return result;
}
function useImage(asset: Asset) {
  const [decoded,setDecoded]=useState<{asset:Asset;image:Preview}|null>(null);
  useLayoutEffect(()=>{let current=true;if(asset.mediaType!=='image/bmp')void loadPreview(asset).then(image=>{if(current)setDecoded({asset,image});});return()=>{current=false;};},[asset]);
  const legacy=useMemo(() => {
    if(asset.mediaType!=='image/bmp')return null;
    try {
      if (asset.mediaType !== 'image/bmp' || asset.encoding !== 'base64') throw Error('Unsupported image format');
      const bytes = decodeCanonicalBase64(asset.data);
      return { pixels: decodeBmp(bytes), byteLength: bytes.byteLength, error: '' };
    } catch { return { pixels: null, byteLength: 0, error: 'Image unavailable: invalid BMP data.' }; }
  }, [asset.mediaType, asset.encoding, asset.data]);
  return legacy??(decoded?.asset===asset?decoded.image:{pixels:null,byteLength:0,error:'Loading image…'});
}
/** Presentation only: no URLs, codecs, runtime or image-transfer resources. */
function ImageCanvas({ pixels, label, thumbnail = false }: { pixels: Pixels; label: string; thumbnail?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null), [unavailable, setUnavailable] = useState(false);
  useLayoutEffect(() => {
    try {
      const context = canvas.current?.getContext('2d');
      if (!context) throw Error('Canvas unavailable');
      const image = context.createImageData(pixels.width, pixels.height);
      image.data.set(pixels.data); context.putImageData(image, 0, 0); setUnavailable(false);
    } catch { setUnavailable(true); }
  }, [pixels]);
  return <><canvas ref={canvas} width={pixels.width} height={pixels.height} hidden={unavailable}
    className={thumbnail ? 'asset-thumbnail' : 'asset-image'} role={thumbnail ? undefined : 'img'}
    aria-hidden={thumbnail || undefined} aria-label={thumbnail ? undefined : label} />
    {unavailable && <span className="asset-unavailable">{thumbnail ? 'Image' : 'Image unavailable on this display.'}</span>}</>;
}
export function AssetItem({ path, asset, selected, dirty, onSelect }: {
  path: string; asset: Asset; selected: boolean; dirty: boolean; onSelect(): void;
}) {
  const image = useImage(asset);
  return <Button className="asset-file" title={path} aria-label={`View ${path}`} aria-current={selected ? 'page' : undefined} onClick={onSelect}>
    {image.pixels ? <ImageCanvas pixels={image.pixels} thumbnail label="" /> : <span className="asset-unavailable">Image</span>}
    <span className="asset-file-details"><span className="file-path">{path}</span>
      <span className="asset-metadata">{image.pixels ? `${image.pixels.width} × ${image.pixels.height} · ${image.byteLength} bytes` : 'Image unavailable'}</span></span>
    {dirty && <span aria-label="Unsaved asset">*</span>}
  </Button>;
}
export function AssetPreview({ path, asset }: { path: string; asset: Asset }) {
  const image = useImage(asset);
  return <section className="asset-preview" aria-label="Asset preview">
    <h3>{path}</h3>
    {image.pixels ? <><p className="asset-metadata">{image.pixels.width} × {image.pixels.height} · {image.byteLength} bytes · {asset.mediaType.slice(6).toUpperCase()} · sRGB</p>
      <div className="asset-image-area"><ImageCanvas pixels={image.pixels} label={`Image preview: ${path}`} /></div></>
      : <p role="status">{image.error}</p>}
  </section>;
}
