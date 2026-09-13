import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { decodeBmp, decodeCanonicalBase64 } from '../../../../packages/assets/src/index.mjs';

type Asset = { mediaType: string; encoding: string; data: string };
type Pixels = { width: number; height: number; data: Uint8Array };
function useImage(asset: Asset) {
  return useMemo(() => {
    try {
      if (asset.mediaType !== 'image/bmp' || asset.encoding !== 'base64') throw Error('Unsupported image format');
      const bytes = decodeCanonicalBase64(asset.data);
      return { pixels: decodeBmp(bytes), byteLength: bytes.byteLength, error: '' };
    } catch { return { pixels: null, byteLength: 0, error: 'Image unavailable: invalid BMP data.' }; }
  }, [asset.mediaType, asset.encoding, asset.data]);
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
    {unavailable && <span className="asset-unavailable">{thumbnail ? 'BMP' : 'Image unavailable on this display.'}</span>}</>;
}
export function AssetItem({ path, asset, selected, dirty, onSelect }: {
  path: string; asset: Asset; selected: boolean; dirty: boolean; onSelect(): void;
}) {
  const image = useImage(asset);
  return <Button className="asset-file" title={path} aria-label={`View ${path}`} aria-current={selected ? 'page' : undefined} onClick={onSelect}>
    {image.pixels ? <ImageCanvas pixels={image.pixels} thumbnail label="" /> : <span className="asset-unavailable">BMP</span>}
    <span className="asset-file-details"><span className="file-path">{path}</span>
      <span className="asset-metadata">{image.pixels ? `${image.pixels.width} × ${image.pixels.height} · ${image.byteLength} bytes` : 'Image unavailable'}</span></span>
    {dirty && <span aria-label="Unsaved asset">*</span>}
  </Button>;
}
export function AssetPreview({ path, asset }: { path: string; asset: Asset }) {
  const image = useImage(asset);
  return <section className="asset-preview" aria-label="Asset preview">
    <h3>{path}</h3>
    {image.pixels ? <><p className="asset-metadata">{image.pixels.width} × {image.pixels.height} · {image.byteLength} bytes · BMP · sRGB</p>
      <div className="asset-image-area"><ImageCanvas pixels={image.pixels} label={`Image preview: ${path}`} /></div></>
      : <p role="status">{image.error}</p>}
  </section>;
}
