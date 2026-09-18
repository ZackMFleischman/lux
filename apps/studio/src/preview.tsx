import { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { DEFAULT_OUTPUT } from '../../../packages/runtime-contracts/src/index.ts';
import { PreviewBinding } from './presentation.ts';
import type { PresentationPort } from './presentation.ts';
import type { RuntimeView } from './service-client.ts';
import type { ControlValues } from '../../../packages/runtime-contracts/src/parameters.mjs';
import { attachPreviewCameraController, cameraControllerBinding } from './preview-camera-controller.ts';
import type { PreviewCameraController } from './preview-camera-controller.ts';
import './preview-camera-controller.css';

export function Preview({ runtime, port, moved, onDock, onError, onCameraParameters }: {
  runtime: RuntimeView | null; port?: PresentationPort; moved: boolean; onDock: () => void; onError: (error: string) => void;
  onCameraParameters?: (values: ControlValues) => Promise<unknown>;
}) {
  const target = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;
  const cameraWriteRef = useRef(onCameraParameters);
  cameraWriteRef.current = onCameraParameters;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const cameraRef = useRef<PreviewCameraController | null>(null);
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
  const cameraBinding = cameraControllerBinding(runtime);
  useEffect(() => {
    cameraRef.current?.dispose();
    cameraRef.current = null;
    if (!cameraBinding || state !== 'attached' || moved || !target.current || !cameraWriteRef.current) return;
    const control = attachPreviewCameraController(target.current, {
      getRuntime: () => runtimeRef.current,
      write: values => cameraWriteRef.current!(values),
      onError: reason => errorRef.current(reason instanceof Error ? reason.message : String(reason)),
    });
    cameraRef.current = control;
    return () => {
      control?.dispose();
      if (cameraRef.current === control) cameraRef.current = null;
    };
  }, [cameraBinding?.key, state, moved]);
  const output = runtime?.output ?? DEFAULT_OUTPUT;
  return <div className="preview-area">
    <div className={`preview-surface${cameraBinding && state === 'attached' && !moved ? ' camera-controller-active' : ''}`} ref={target}
      aria-label="Final authoring output" data-output-width={output.width} data-output-height={output.height}
      data-camera-controller={cameraBinding && state === 'attached' && !moved ? 'enabled' : undefined}>
      {state !== 'attached' && <div className="preview-empty">
        <div className="preview-mark" aria-hidden="true">L</div>
        <h1>{moved ? 'Preview in separate window' : state === 'attaching' ? 'Attaching preview' : state === 'failed' ? 'Preview unavailable' : 'Awaiting runtime'}</h1>
        <p>{moved ? 'Your authoring instance stays with the service.' : error ?? 'Completed output will appear here when the authoring service connects.'}</p>
        {moved ? <Button onClick={onDock}>Return preview here</Button> : <span className="empty-caption">FINAL OUTPUT · FIT TO VIEW</span>}
      </div>}
      {cameraBinding && state === 'attached' && !moved && <Button className="preview-camera-reset" size="small" variant="outlined"
        aria-label="Reset Camera" title="Left drag: orbit · Shift-left or right drag: pan · Wheel: dolly · Alt-left drag: roll"
        data-camera-controller-ignore onClick={() => void cameraRef.current?.reset()}>Reset Camera</Button>}
    </div>
    <div className="preview-caption"><span>{runtime ? 'Output' : 'Reference output'} <b>{output.width} × {output.height}</b></span><span>Fit · render scale 1.0</span></div>
  </div>;
}
