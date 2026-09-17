import { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { DEFAULT_OUTPUT } from '../../../packages/runtime-contracts/src/index.ts';
import { PreviewBinding } from './presentation.ts';
import type { PresentationPort } from './presentation.ts';
import type { RuntimeView } from './service-client.ts';

export function Preview({ runtime, port, moved, onDock, onError }: {
  runtime: RuntimeView | null; port?: PresentationPort; moved: boolean; onDock: () => void; onError: (error: string) => void;
}) {
  const target = useRef<HTMLDivElement>(null);
  const portRef = useRef(port);
  portRef.current = port;
  const bindingRef = useRef<PreviewBinding | null>(null);
  if (!bindingRef.current) bindingRef.current = new PreviewBinding({ attach: request => {
    if (!portRef.current) return Promise.reject(Error('Presentation service unavailable'));
    return portRef.current.attach(request);
  } });
  const [state, setState] = useState<'waiting' | 'attaching' | 'attached' | 'failed'>('waiting');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!runtime || !port || moved || !target.current) { setState('waiting'); return; }
    let active = true;
    const binding = bindingRef.current!;
    setState('attaching'); setError(null);
    void binding.move(target.current, { instanceId: runtime.instanceId, generation: runtime.generation })
      .then(() => { if (active) setState('attached'); })
      .catch(reason => { if (active) { setState('failed'); setError(String(reason)); } });
    return () => {
      active = false;
      // Only the consumer lease is released. Runtime lifetime belongs to core.
      void binding.close().catch(reason => { onError(`Preview consumer detach failed: ${String(reason)}`); });
    };
  }, [runtime?.instanceId, runtime?.generation, port, moved, onError]);
  const output = runtime?.output ?? DEFAULT_OUTPUT;
  return <div className="preview-area">
    <div className="preview-surface" ref={target} aria-label="Final authoring output" data-output-width={output.width} data-output-height={output.height}>
      {state !== 'attached' && <div className="preview-empty">
        <div className="preview-mark" aria-hidden="true">L</div>
        <h1>{moved ? 'Preview in separate window' : state === 'attaching' ? 'Attaching preview' : state === 'failed' ? 'Preview unavailable' : 'Awaiting runtime'}</h1>
        <p>{moved ? 'Your authoring instance stays with the service.' : error ?? 'Completed output will appear here when the authoring service connects.'}</p>
        {moved ? <Button onClick={onDock}>Return preview here</Button> : <span className="empty-caption">FINAL OUTPUT · FIT TO VIEW</span>}
      </div>}
    </div>
    <div className="preview-caption"><span>{runtime ? 'Output' : 'Reference output'} <b>{output.width} × {output.height}</b></span><span>Fit · render scale 1.0</span></div>
  </div>;
}
