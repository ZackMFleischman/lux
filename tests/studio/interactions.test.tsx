import test, { afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { StudioClient, StudioOperation, StudioSnapshot, RuntimeView } from '../../apps/studio/src/service-client.ts';
import type { WindowState } from '../../apps/studio/src/window-client.ts';

// jsdom models DOM events only. It starts no browser, Electron, canvas or GPU.
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://studio.test/' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'ShadowRoot', 'DocumentFragment', 'Event', 'KeyboardEvent', 'MouseEvent', 'getComputedStyle'] as const) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:dom.window.localStorage});
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true });
const { render: renderUI, screen, cleanup, waitFor, fireEvent, act, within } = await import('@testing-library/react');
const { CacheProvider } = await import('@emotion/react');
const { default: createCache } = await import('@emotion/cache');
const createStyleCache=()=>createCache({key:'studio-test',container:document.head,speedy:false});
let styleCache = createStyleCache();
const render = (ui: Parameters<typeof renderUI>[0]) => renderUI(<CacheProvider value={styleCache}>{ui}</CacheProvider>);
const { userEvent } = await import('@testing-library/user-event');
const { StudioApp } = await import('../../apps/studio/src/renderer.tsx');
const { createDisconnectedClient } = await import('../../apps/studio/src/service-client.ts');
const { useDiscardConfirmation } = await import('../../apps/studio/src/Confirmation.tsx');
afterEach(() => { cleanup(); styleCache.sheet.flush(); styleCache = createStyleCache(); });
after(() => dom.window.close());

test('RTL: frame bursts leave Performance responsive and applied controls publish immediately', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  try { const fixture = service();
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  const initialFrame = fixture.client.getSnapshot().authoring!.frameId!;
  await act(async () => {
    for (let frame = 100; frame <= 159; frame++) fixture.publish({ frameId: String(frame) });
  });
  assert.ok(screen.getByText(initialFrame));
  assert.equal(screen.queryByText('159'), null, 'worker observations must not synchronously render the full UI');
  const summary = screen.getByText('Performance');
  fireEvent.click(summary); assert.equal(summary.parentElement!.hasAttribute('open'), true);
  fireEvent.click(summary); assert.equal(summary.parentElement!.hasAttribute('open'), false);
  await act(async () => context.mock.timers.tick(100));
  assert.ok(screen.getByText('159'));
  await act(async () => { fixture.publish({ frameId: '160' }); fixture.publish({ intensity: 0.8 }); });
  assert.equal((screen.getByRole('slider', { name: 'Intensity' }) as HTMLInputElement).value, '0.8');
  assert.ok(screen.getByText('160'));
  } finally { context.mock.timers.reset(); }
});

test('RTL: discard confirmation is an accessible in-app dialog with safe cancel, Escape and explicit approval', async () => {
  const answers: boolean[] = [];
  function Fixture() { const confirmation = useDiscardConfirmation(); return <>{confirmation.dialog}<button onClick={() => void confirmation.confirm('open').then(answer => answers.push(answer))}>Choose another scene</button></>; }
  const user = userEvent.setup({ document }); render(<Fixture />);
  await user.click(screen.getByRole('button', { name: 'Choose another scene' }));
  assert.ok(screen.getByRole('dialog', { name: 'Discard unsaved changes?' }));
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  await waitFor(() => assert.deepEqual(answers, [false]));
  assert.equal(screen.queryByRole('dialog'), null);
  await user.click(screen.getByRole('button', { name: 'Choose another scene' }));
  await user.keyboard('{Escape}');
  await waitFor(() => assert.deepEqual(answers, [false, false]));
  assert.equal(screen.queryByRole('dialog'), null);
  await user.click(screen.getByRole('button', { name: 'Choose another scene' }));
  await user.click(screen.getByRole('button', { name: 'Discard and open' }));
  await waitFor(() => assert.deepEqual(answers, [false, false, true]));
});

test('RTL: code-defined controls expose independent values, numeric entry and defaults without Intensity', async () => {
  const fixture = service();
  const schema = [
    { id: 'spikeHeight', type: 'number' as const, label: 'Spike height', min: 0, max: 4, default: 1, step: 0.1, changeCost: 'live' as const },
    { id: 'noiseScale', type: 'number' as const, label: 'Noise scale', min: 1, max: 20, default: 5, changeCost: 'live' as const },
  ];
  fixture.publish({ sdkVersion: '0.2.0', intensity: undefined, controlSchema: schema, controlSchemaHash: 'a'.repeat(64), controls: { spikeHeight: 2, noiseScale: 7 }, controlSequence: 0 });
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  assert.equal(screen.queryByRole('slider', { name: 'Intensity' }), null);
  assert.equal(within(document.querySelector('.inspector')!).getAllByRole('slider').length, 2);
  for (const label of ['Spike height', 'Noise scale']) {
    const animate = screen.getByRole('button', { name: `Animate ${label}` }) as HTMLButtonElement;
    assert.equal(animate.disabled, false, 'scene controls support animation without a component target');
    assert.equal((screen.getByRole('button', { name: `Reset ${label} to default` }) as HTMLButtonElement).disabled, false);
  }
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Noise scale value' }), { target: { value: '12' } });
  fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Noise scale value' }), { key: 'Enter' });
  await waitFor(() => assert.equal(fixture.calls.length, 1));
  assert.deepEqual(fixture.calls[0]?.input, { requestId: fixture.calls[0]?.input.requestId, instanceId: '44ff55f0-8ea6-4fbf-89d5-665923f65cad', expectedGeneration: 2, expectedRevisionId: 'revision-2', expectedControlSchemaHash: 'a'.repeat(64), values: { noiseScale: 12 }, mode: 'live' });
  fireEvent.click(screen.getByRole('button', { name: 'Reset Spike height to default' }));
  await waitFor(() => assert.equal(fixture.calls.length, 2));
  assert.deepEqual((fixture.calls[1] as any).input.values, { spikeHeight: 1 });
});

test('RTL: a flat control can add the strict shared-audio binding',async()=>{
  const fixture=service(),priorAnimationFrame=globalThis.requestAnimationFrame,user=userEvent.setup({document});
  globalThis.requestAnimationFrame=callback=>{callback(0);return 0;};
  try{
    render(<StudioApp client={fixture.client} nowMs={1000}/>);
    fireEvent.click(screen.getByRole('button',{name:'Animate Intensity'}));
    fireEvent.click(screen.getByRole('button',{name:'Add Audio'}));
    await waitFor(()=>assert.equal(fixture.calls[0]?.name,'lux.node.animation.set'));
    const operation=fixture.calls[0];
    if(operation?.name!=='lux.node.animation.set')assert.fail('expected animation write');
    assert.deepEqual(operation.input.animation,{kind:'audio',nodePath:[],definitionHash:operation.input.expectedControlSchemaHash,
      schemaHash:operation.input.expectedControlSchemaHash,controlId:'intensity',source:{kind:'audio-band',logicalInputId:'primary-audio',band:'bass',
        analyzer:{version:1,fftSize:2048,minDecibels:-100,maxDecibels:-30}},amount:.1,attackMs:50,releaseMs:400,enabled:true});
    await user.click(screen.getByRole('combobox',{name:'Audio band'}));
    await user.click(screen.getByRole('option',{name:'Highs'}));
    await waitFor(()=>assert.equal(fixture.calls.length,2));
    assert.equal((fixture.calls[1] as any).input.animation.source.band,'highs');
    await user.keyboard('{Escape}');
    await waitFor(()=>assert.equal(screen.queryByRole('dialog',{name:'Animate Intensity'}),null));
  }finally{globalThis.requestAnimationFrame=priorAnimationFrame;}
});

test('RTL: a flat control can configure stable per-instance variation',async()=>{
  const fixture=service(),priorAnimationFrame=globalThis.requestAnimationFrame,user=userEvent.setup({document});
  globalThis.requestAnimationFrame=callback=>{callback(0);return 0;};
  try{
    render(<StudioApp client={fixture.client} nowMs={1000}/>);
    fireEvent.click(screen.getByRole('button',{name:'Animate Intensity'}));
    fireEvent.click(screen.getByRole('button',{name:'Vary instances'}));
    await waitFor(()=>assert.equal(fixture.calls[0]?.name,'lux.node.animation.set'));
    const variation=(fixture.calls[0] as any).input.animation;
    assert.equal(variation.kind,'variation');assert.equal(variation.distribution,'spread');assert.equal(variation.amount,.1);
    await user.click(screen.getByRole('combobox',{name:'Instance variation distribution'}));
    await user.click(screen.getByRole('option',{name:'Center-weighted'}));
    await waitFor(()=>assert.equal(fixture.calls.length,2));
    assert.equal((fixture.calls[1] as any).input.animation.distribution,'centered');
  }finally{globalThis.requestAnimationFrame=priorAnimationFrame;}
});

test('RTL: a flat control can add and tune the strict kick binding',async()=>{
  const fixture=service(),priorAnimationFrame=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=callback=>{callback(0);return 0;};
  try{
    render(<StudioApp client={fixture.client} nowMs={1000}/>);
    fireEvent.click(screen.getByRole('button',{name:'Animate Intensity'}));
    fireEvent.click(screen.getByRole('button',{name:'Add Kick'}));
    await waitFor(()=>assert.equal(fixture.calls.length,1));
    const animation=(fixture.calls[0] as any).input.animation;
    assert.deepEqual(animation,{kind:'kick',nodePath:[],definitionHash:(fixture.calls[0] as any).input.expectedControlSchemaHash,
      schemaHash:(fixture.calls[0] as any).input.expectedControlSchemaHash,controlId:'intensity',
      source:{kind:'audio-kick',logicalInputId:'primary-audio',analyzer:{version:1,fftSize:2048,minDecibels:-100,maxDecibels:-30}},
      amount:.1,attackMs:0,releaseMs:300,sensitivity:.5,retriggerMs:120,envelope:'exponential',enabled:true});
    const sensitivity=screen.getByRole('spinbutton',{name:'Kick sensitivity'});
    fireEvent.focus(sensitivity);fireEvent.change(sensitivity,{target:{value:'.8'}});fireEvent.blur(sensitivity);
    await waitFor(()=>assert.equal(fixture.calls.length,2));
    assert.equal((fixture.calls[1] as any).input.animation.sensitivity,.8);
    assert.ok(screen.getByRole('combobox',{name:'Kick envelope'}));
    assert.ok(screen.getByRole('spinbutton',{name:'Kick retrigger milliseconds'}));
    fireEvent.keyDown(screen.getByRole('dialog',{name:'Animate Intensity'}),{key:'Escape'});
    await waitFor(()=>assert.equal(screen.queryByRole('dialog',{name:'Animate Intensity'}),null));
  }finally{globalThis.requestAnimationFrame=priorAnimationFrame;}
});

test('RTL: audio configuration changes cancel an in-flight connection and ignore its stale completion',async()=>{
  const {AudioInputControl}=await import('../../apps/studio/src/audio/AudioInputControl.tsx');
  let resolveConnect!:()=>void;
  const calls:string[]=[];
  const provider={
    listInputs:async()=>[],subscribeDevices:()=>()=>{},
    connect:async()=>{calls.push('connect');await new Promise<void>(resolve=>{resolveConnect=resolve;});},
    disconnect:async()=>{calls.push('disconnect');},dispose:async()=>{},
    getSnapshot:()=>({generation:0,sequence:0,available:false,level:0,bass:0,mids:0,highs:0,kickSequence:0,kickStrength:0}),subscribe:()=>()=>{},
  } as any;
  const first={logicalInputId:'primary-audio' as const,analyzer:{version:1 as const,fftSize:2048 as const,minDecibels:-100,maxDecibels:-30}};
  const second={logicalInputId:'primary-audio' as const,analyzer:{version:1 as const,fftSize:2048 as const,minDecibels:-90,maxDecibels:-20}};
  const view=render(<AudioInputControl provider={provider} onError={()=>{}} configuration={first}/>);
  fireEvent.click(screen.getByRole('button',{name:'Connect audio'}));
  await waitFor(()=>assert.deepEqual(calls,['connect']));
  view.rerender(<CacheProvider value={styleCache}><AudioInputControl provider={provider} onError={()=>{}} configuration={second}/></CacheProvider>);
  await waitFor(()=>assert.deepEqual(calls,['connect','disconnect']));
  resolveConnect();
  await act(async()=>{});
  assert.ok(screen.getByRole('status',{name:'Audio input status'}));
  assert.match(screen.getByRole('status').textContent??'',/Disconnected|Unavailable/);
});

test('RTL: a failed default connection keeps the prelisted CABLE input available for an exact retry',async()=>{
  const {AudioInputControl}=await import('../../apps/studio/src/audio/AudioInputControl.tsx');
  const calls:string[]=[],errors:string[]=[];
  const provider={
    listInputs:async()=>{calls.push('list');return [{id:'cable',label:'CABLE Output (VB-Audio Virtual Cable)'}];},
    subscribeDevices:()=>()=>{},connect:async(_configuration:any,id?:string)=>{calls.push(`connect:${id}`);if(!id)throw Error('default input failed');},disconnect:async()=>{},dispose:async()=>{},
    getSnapshot:()=>({generation:0,sequence:0,available:false,level:0,bass:0,mids:0,highs:0,kickSequence:0,kickStrength:0}),subscribe:()=>()=>{},
  } as any;
  const user=userEvent.setup({document});localStorage.clear();
  render(<AudioInputControl provider={provider} onError={error=>errors.push(error)}/>);
  await waitFor(()=>assert.deepEqual(calls,['list']));
  await user.click(await screen.findByRole('button',{name:'Connect'}));
  await waitFor(()=>assert.match(errors.at(-1)??'',/default input failed/));
  await user.click(screen.getByRole('combobox',{name:'Audio input device'}));
  await user.click(screen.getByRole('option',{name:'CABLE Output (VB-Audio Virtual Cable)'}));
  await user.click(screen.getByRole('button',{name:'Connect'}));
  await waitFor(()=>assert.deepEqual(calls,['list','connect:undefined','connect:cable']));
  assert.equal(screen.getByRole('status').textContent,'Connected');
});

test('RTL: a missing saved audio input blocks connection until the user chooses an available device',async()=>{
  const {AudioInputControl}=await import('../../apps/studio/src/audio/AudioInputControl.tsx');
  const calls:string[]=[],errors:string[]=[];
  const provider={
    listInputs:async()=>[{id:'cable',label:'CABLE Output (VB-Audio Virtual Cable)'}],subscribeDevices:()=>()=>{},
    connect:async(_configuration:any,id?:string)=>{calls.push(`connect:${id}`);},disconnect:async()=>{},dispose:async()=>{},
    getSnapshot:()=>({generation:0,sequence:0,available:false,level:0,bass:0,mids:0,highs:0,kickSequence:0,kickStrength:0}),subscribe:()=>()=>{},
  } as any;
  const user=userEvent.setup({document});localStorage.setItem('lux.audio.primary-device','missing-device');
  render(<AudioInputControl provider={provider} onError={error=>errors.push(error)}/>);
  await screen.findByRole('button',{name:'Connect'});
  await user.click(screen.getByRole('combobox',{name:'Audio input device'}));
  assert.ok(screen.getByRole('option',{name:'Previously selected input (unavailable)'}));
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button',{name:'Connect'}));
  await waitFor(()=>assert.match(errors.at(-1)??'',/previously selected audio input is unavailable/i));
  assert.deepEqual(calls,[]);
  await user.click(screen.getByRole('combobox',{name:'Audio input device'}));
  await user.click(screen.getByRole('option',{name:'CABLE Output (VB-Audio Virtual Cable)'}));
  await user.click(screen.getByRole('button',{name:'Connect'}));
  await waitFor(()=>assert.deepEqual(calls,['connect:cable']));
  localStorage.clear();
});

test('RTL: an audio device change refreshes inputs and unmount removes the listener',async()=>{
  const {AudioInputControl}=await import('../../apps/studio/src/audio/AudioInputControl.tsx');
  let listener:(()=>void)|undefined,unsubscribed=false,lists=0;
  const provider={
    listInputs:async()=>++lists===1?[]:[{id:'cable',label:'CABLE Output (VB-Audio Virtual Cable)'}],
    subscribeDevices:(next:()=>void)=>{listener=next;return()=>{unsubscribed=true;};},connect:async()=>{},disconnect:async()=>{},dispose:async()=>{},
    getSnapshot:()=>({generation:0,sequence:0,available:false,level:0,bass:0,mids:0,highs:0,kickSequence:0,kickStrength:0}),subscribe:()=>()=>{},
  } as any;
  localStorage.clear();const view=render(<AudioInputControl provider={provider} onError={()=>{}}/>);
  await waitFor(()=>assert.equal(lists,1));
  await act(async()=>listener?.());
  await waitFor(()=>assert.equal(lists,2));
  const user=userEvent.setup({document});await user.click(screen.getByRole('combobox',{name:'Audio input device'}));
  assert.ok(screen.getByRole('option',{name:'CABLE Output (VB-Audio Virtual Cable)'}));
  view.unmount();assert.equal(unsubscribed,true);
});

test('RTL: direct component selection edits flat controls and keeps empty-path animation identity', async () => {
  const {useState}=await import('react');
  const {GraphPanel,nodeKey}=await import('../../apps/studio/src/GraphPanel.tsx');
  const {InspectorBreadcrumb}=await import('../../apps/studio/src/InspectorBreadcrumb.tsx');
  const {ParameterInspector}=await import('../../apps/studio/src/controls/ParameterInspector.tsx');
  const {StudioController}=await import('../../apps/studio/src/service-client.ts');
  const fixture=service(),runtime=fixture.client.getSnapshot().authoring!,controller=new StudioController(fixture.client);
  const initial=JSON.stringify(runtime),priorAnimationFrame=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=callback=>{callback(0);return 0;};
  try {
    function Fixture(){const [path,setPath]=useState<import('../../packages/runtime-contracts/src/graph.ts').NodePath|null>(null);return <>
      <GraphPanel runtime={runtime} selected={path?nodeKey(path):null} onSelect={setPath}/>
      <InspectorBreadcrumb runtime={runtime} path={path??undefined} onSelect={setPath}/>
      <ParameterInspector runtime={runtime} available client={fixture.client} controller={controller} onError={()=>{}} nodePath={path??undefined}/>
    </>;}
    render(<Fixture/>);
    const visual=screen.getByRole('button',{name:/^Visual Source Image Final output/});
    fireEvent.click(visual);
    assert.equal(visual.getAttribute('aria-pressed'),'true');
    assert.ok(screen.getByRole('button',{name:'Controls for Visual'}));
    assert.equal(screen.queryByRole('button',{name:'View inside'}),null);
    fireEvent.change(screen.getByRole('spinbutton',{name:'Intensity value'}),{target:{value:'.7'}});
    fireEvent.keyDown(screen.getByRole('spinbutton',{name:'Intensity value'}),{key:'Enter'});
    await waitFor(()=>assert.equal(fixture.calls[0]?.name,'lux.parameters.set'));
    assert.equal('nodePath' in fixture.calls[0]!.input,false);
    fireEvent.click(screen.getByRole('button',{name:'Animate Intensity'}));
    fireEvent.click(screen.getByRole('button',{name:'Add LFO'}));
    await waitFor(()=>assert.equal(fixture.calls[1]?.name,'lux.node.animation.set'));
    const animation=fixture.calls[1];
    if(animation?.name==='lux.node.animation.set'){
      assert.deepEqual(animation.input.nodePath,[]);
      assert.equal(animation.input.animation?.definitionHash,animation.input.animation?.schemaHash);
    }
    assert.equal(JSON.stringify(runtime),initial);
    assert.equal(runtime.nodeControls,undefined);
    assert.equal(runtime.composition,undefined);
    fireEvent.click(screen.getAllByRole('button',{name:'Scene controls'})[0]!);
    assert.equal(visual.getAttribute('aria-pressed'),'false');
  } finally {globalThis.requestAnimationFrame=priorAnimationFrame;}
});

test('RTL: control descriptions appear on hover and keyboard focus without creating empty help', async () => {
  const fixture = service();
  fixture.publish({ sdkVersion: '0.2.0', intensity: undefined, controlSchema: [
    { id: 'samplingRadius', type: 'number' as const, label: 'Source sampling radius', description: 'Expands the area sampled from the source image before mirroring.', min: 0, max: 4, default: 1, changeCost: 'live' as const },
    { id: 'spiralTwist', type: 'number' as const, label: 'Spiral twist', min: -4, max: 4, default: 0, changeCost: 'live' as const },
  ], controlSchemaHash: 'd'.repeat(64), controls: { samplingRadius: 1, spiralTwist: 0 }, controlSequence: 0 });
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  const described = screen.getByText('Source sampling radius');
  fireEvent.mouseOver(described);
  const tooltip = await screen.findByRole('tooltip', { name: /Expands the area sampled/ });
  assert.ok(tooltip.querySelector('.MuiTooltip-tooltipPlacementLeft'), 'help must open toward Preview');
  await waitFor(() => assert.equal(getComputedStyle(tooltip.querySelector('.MuiTooltip-tooltip')!).fontSize, '12px'));
  fireEvent.change(screen.getByRole('slider', { name: 'Source sampling radius' }), { target: { value: '2' } });
  await waitFor(() => assert.deepEqual((fixture.calls[0] as any).input.values, { samplingRadius: 2 }));
  fireEvent.mouseOut(described);
  fireEvent.focus(described);
  assert.ok(await screen.findByRole('tooltip', { name: /Expands the area sampled/ }));
  assert.equal(document.querySelectorAll('[role="tooltip"]').length, 1);
  assert.equal(screen.getByText('Spiral twist').getAttribute('tabindex'), null);
});

test('RTL: duplicate component labels show and announce their public aliases', () => {
  const fixture = service();
  fixture.publish({ sdkVersion: '0.4.0', intensity: undefined, controlSchema: [
    { id: 'segmentsA', type: 'number' as const, label: 'Segments', min: 2, max: 16, default: 6, changeCost: 'live' as const },
    { id: 'segmentsB', type: 'number' as const, label: 'Segments', min: 2, max: 16, default: 6, changeCost: 'live' as const },
  ], controlSchemaHash: 'c'.repeat(64), controls: { segmentsA: 6, segmentsB: 6 }, controlSequence: 0 });
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  assert.ok(screen.getByText('segmentsA · Segments'));
  assert.ok(screen.getByText('segmentsB · Segments'));
  assert.ok(screen.getByRole('slider', { name: 'segmentsA · Segments' }));
  assert.ok(screen.getByRole('spinbutton', { name: 'segmentsB · Segments value' }));
});

test('RTL: grouped controls use independent keyboard disclosures and preserve live values while collapsed', async () => {
  const fixture = service();
  fixture.publish({ sdkVersion: '0.2.0', intensity: undefined, controlSchema: [
    { id: 'exposure', type: 'number' as const, label: 'Exposure', min: 0, max: 2, default: 1, changeCost: 'live' as const },
    { id: 'speed', type: 'number' as const, label: 'Speed', group: 'Motion', min: 0, max: 4, default: 1, changeCost: 'live' as const },
    { id: 'phase', type: 'number' as const, label: 'Phase', group: 'Motion', min: 0, max: 1, default: 0, changeCost: 'live' as const },
    { id: 'segments', type: 'number' as const, label: 'Segments', group: 'Kaleidoscope', min: 2, max: 16, default: 6, changeCost: 'live' as const },
  ], controlSchemaHash: 'e'.repeat(64), controls: { exposure: 1, speed: 1, phase: 0, segments: 6 }, controlSequence: 0 });
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  const motion = screen.getByText('Motion').closest('summary') as HTMLElement;
  const kaleidoscope = screen.getByText('Kaleidoscope').closest('summary') as HTMLElement;
  assert.ok(motion); assert.ok(kaleidoscope); assert.equal(motion.tabIndex, 0);
  const motionDetails = motion.closest('details')!;
  const kaleidoscopeDetails = kaleidoscope.closest('details')!;
  assert.equal(motionDetails.open, true); assert.equal(kaleidoscopeDetails.open, true);
  assert.deepEqual([...document.querySelectorAll('.parameter-row')].map(row => row.getAttribute('data-control-id')), ['exposure', 'speed', 'phase', 'segments']);
  fireEvent.click(motion);
  assert.equal(motionDetails.open, false); assert.equal(kaleidoscopeDetails.open, true);
  await act(async () => fixture.publish({ controls: { exposure: 1, speed: 3, phase: 0, segments: 6 }, playback: 'playing' }));
  fireEvent.click(motion);
  assert.equal((screen.getByRole('slider', { name: 'Speed' }) as HTMLInputElement).value, '3');
  assert.ok(screen.getByRole('button', { name: 'Pause' }), 'collapsing a group must not change playback');
  assert.ok(screen.getByRole('slider', { name: 'Exposure' }), 'ungrouped controls remain available');
});

test('RTL: an empty authored schema has no invented control', () => {
  const fixture = service();
  fixture.publish({ sdkVersion: '0.2.0', intensity: undefined, controlSchema: [], controlSchemaHash: 'b'.repeat(64), controls: {}, controlSequence: 0 });
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  assert.equal(within(document.querySelector('.inspector')!).queryByRole('slider'), null);
  assert.ok(screen.getByText('This visual defines no live controls.'));
});

test('RTL: typing and pending control writes mark unsaved intent before acknowledgement', async () => {
  const fixture = service(); let dirty = 0; const writes: Promise<unknown>[] = [];
  let complete!: () => void;
  fixture.client.invoke = () => new Promise(resolve => { complete = () => resolve({}); });
  render(<StudioApp client={fixture.client} nowMs={1000} controlEdits={{ changed: () => { dirty++; }, track: write => { writes.push(write); } }} />);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Intensity value' }), { target: { value: '0.7' } });
  assert.equal(dirty, 1, 'unsubmitted visible input must protect close');
  fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Intensity value' }), { key: 'Enter' });
  assert.equal(dirty, 2); assert.equal(writes.length, 1, 'save can await the actual write');
  await act(async () => { complete(); await Promise.all(writes); });
});

test('RTL: merely focusing numeric input cannot overwrite a later agent parameter change', async () => {
  const fixture = service(); render(<StudioApp client={fixture.client} nowMs={1000} />);
  const input = screen.getByRole('spinbutton', { name: 'Intensity value' }) as HTMLInputElement;
  fireEvent.focus(input);
  await act(async () => fixture.publish({ intensity: 0.2 }));
  assert.equal(input.value, '0.2');
  fireEvent.blur(input);
  assert.equal(fixture.calls.length, 0);
});

function service() {
  let snapshot: StudioSnapshot = {
    connection: 'connected', message: null, receivedAtMs: 1000,
    authoring: { instanceId: '44ff55f0-8ea6-4fbf-89d5-665923f65cad', generation: 2,
      revisionId: 'revision-2', sceneName: 'Test fixture', authority: 'studio', playback: 'paused', clockEpoch: 1,
      frameId: '10', intensity: 0.5, output: { width: 1920, height: 1080 }, fault: null },
    host: null, jobs: [], visualFps: null, uiFps: null,
  };
  const calls: StudioOperation[] = [], listeners = new Set<() => void>();
  let fail = false;
  const client: StudioClient = {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    invoke: async operation => { calls.push(operation); if (fail) throw Error('Runtime unavailable. Retry after reconnecting.'); return { accepted: true }; },
  };
  return { client, calls, fail: () => { fail = true; }, publish: (values: Partial<RuntimeView>) => {
    snapshot = { ...snapshot, authoring: { ...snapshot.authoring!, ...values } as RuntimeView };
    for (const listener of listeners) listener();
  }, update: () => {
    snapshot = { ...snapshot, authoring: { ...snapshot.authoring!, generation: 3, playback: 'playing' } };
    for (const listener of listeners) listener();
  } };
}

test('RTL: disconnected controls refuse input while workspace remains operable', async () => {
  const user = userEvent.setup({ document });
  render(<StudioApp client={createDisconnectedClient()} nowMs={1000} />);
  assert.equal((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled, true);
  assert.equal(within(document.querySelector('.inspector')!).queryByRole('slider'), null);
  await user.click(screen.getByRole('button', { name: 'Maximize' }));
  assert.ok(screen.getByRole('button', { name: 'Restore workspace' }));
  assert.ok(screen.getByRole('heading', { name: 'Awaiting runtime' }));
  await user.keyboard('{Escape}');
  assert.ok(screen.getByRole('button', { name: 'Maximize' }));
});

test('RTL: playback and intensity invoke guarded shared operations and wait for applied state', async () => {
  const fixture = service(), user = userEvent.setup({ document });
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  await user.click(screen.getByRole('button', { name: 'Play' }));
  await waitFor(() => assert.equal(fixture.calls.length, 1));
  assert.equal(fixture.calls[0]?.name, 'lux.playback');
  assert.equal(fixture.calls[0]?.input.expectedGeneration, 2);
  assert.equal(screen.queryByRole('button', { name: 'Pause' }), null);
  fireEvent.change(screen.getByRole('slider', { name: 'Intensity' }), { target: { value: '0.8' } });
  await waitFor(() => assert.equal(fixture.calls.length, 2));
  const write = fixture.calls[1];
  assert.equal(write?.name, 'lux.parameters.set');
  if (write?.name === 'lux.parameters.set') assert.deepEqual(write.input.values, { intensity: 0.8 });
  assert.equal(document.querySelector('[data-control-id="intensity"]')?.getAttribute('data-applied-value'), '0.5');
  await act(async () => fixture.update());
  await user.click(screen.getByRole('button', { name: 'Pause' }));
  await waitFor(() => assert.equal(fixture.calls.length, 3));
  assert.equal(fixture.calls[2]?.input.expectedGeneration, 3);
});

test('RTL: failed runtime command shows actionable error without a successful-state claim', async () => {
  const fixture = service(), user = userEvent.setup({ document }); fixture.fail();
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  await user.click(screen.getByRole('button', { name: 'More playback actions' }));
  await user.click(screen.getByRole('menuitem', { name: 'Restart runtime' }));
  await waitFor(() => assert.match(screen.getByRole('alert').textContent ?? '', /Runtime unavailable/));
  assert.equal(screen.queryByText('Request accepted. Awaiting applied runtime status.'), null);
  assert.ok(screen.getByText('revision-2'));
  await act(async () => fixture.publish({ generation: 3, revisionId: 'revision-3', fault: null }));
  assert.ok(!screen.queryByRole('alert'), 'A new working runtime clears the previous command error');
});

test('RTL: pending playback preserves button styling and ignores duplicate transport commands', async () => {
  const fixture = service(), user = userEvent.setup({ document });
  let finishPlay!: () => void, finishIntensity!: () => void;
  fixture.client.invoke = operation => {
    fixture.calls.push(operation);
    return new Promise(resolve => {
      if (operation.name === 'lux.playback') finishPlay = () => resolve({});
      else finishIntensity = () => resolve({});
    });
  };
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  await user.click(screen.getByRole('button', { name: 'Play' }));
  fireEvent.change(screen.getByRole('slider', { name: 'Intensity' }), { target: { value: '0.8' } });
  await waitFor(() => assert.equal(fixture.calls.length, 2));
  assert.ok(screen.getByRole('button', { name: 'Play' }));
  await act(async () => finishIntensity());
  assert.equal((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled, false);
  await user.click(screen.getByRole('button', { name: 'More playback actions' }));
  assert.notEqual(screen.getByRole('menuitem', { name: 'Restart runtime' }).getAttribute('aria-disabled'), 'true');
  fireEvent.click(screen.getByRole('menuitem', { name: 'Restart runtime' }));
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  assert.equal(fixture.calls.length, 2);
  await act(async () => finishPlay());
  assert.equal((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled, false);
  assert.ok(screen.getByRole('button', { name: 'Play' }));
  await act(async () => fixture.update());
  assert.ok(screen.getByRole('button', { name: 'Pause' }));
});

test('RTL: intensity writes do not disable transport or insert a success alert', async () => {
  const fixture = service(); let finish!: () => void;
  fixture.client.invoke = operation => { fixture.calls.push(operation); return new Promise(resolve => { finish = () => resolve({}); }); };
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  fireEvent.change(screen.getByRole('slider', { name: 'Intensity' }), { target: { value: '0.8' } });
  await waitFor(() => assert.equal(fixture.calls.length, 1));
  for (const name of ['Play', 'Reset', 'More playback actions']) assert.equal((screen.getByRole('button', { name }) as HTMLButtonElement).disabled, false);
  assert.equal(screen.queryByText('Sending request…'), null);
  await act(async () => finish());
  assert.equal(screen.queryByText('Request accepted. Awaiting applied runtime status.'), null);
  assert.equal(screen.queryByRole('alert'), null);
});

test('RTL: delayed applied values never pull a slider away from the latest input', async () => {
  const fixture = service();
  const pending: Array<() => void> = [];
  fixture.client.invoke = operation => {
    fixture.calls.push(operation);
    return new Promise(resolve => pending.push(() => {
      if (operation.name === 'lux.parameters.set') fixture.publish(operation.input.values);
      resolve({});
    }));
  };
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  const slider = screen.getByRole('slider', { name: 'Intensity' }) as HTMLInputElement;
  fireEvent.change(slider, { target: { value: '0.6' } });
  fireEvent.change(slider, { target: { value: '0.8' } });
  assert.equal(slider.value, '0.8');
  assert.equal(fixture.calls.length, 1, 'controller coalesces pending writes');
  await act(async () => pending.shift()!());
  assert.equal(document.querySelector('[data-control-id="intensity"]')?.getAttribute('data-applied-value'), '0.6');
  assert.equal(slider.value, '0.8', 'old acknowledgement must not overwrite newer input');
  assert.equal(fixture.calls.length, 2);
  fireEvent.change(slider, { target: { value: '0.9' } });
  await act(async () => pending.shift()!());
  assert.equal(slider.value, '0.9');
  await act(async () => pending.shift()!());
  assert.equal(slider.value, '0.9');
  assert.equal(document.querySelector('[data-control-id="intensity"]')?.getAttribute('data-applied-value'), '0.9');
  await act(async () => fixture.publish({ intensity: 0.25 }));
  assert.equal(slider.value, '0.25', 'external changes still apply after local input settles');
});

test('RTL: rejected slider input restores confirmed value and replacement ignores old completion', async () => {
  const fixture = service();
  let reject!: (reason: Error) => void;
  fixture.client.invoke = operation => { fixture.calls.push(operation); return new Promise((_resolve, fail) => { reject = fail; }); };
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  let slider = screen.getByRole('slider', { name: 'Intensity' }) as HTMLInputElement;
  fireEvent.change(slider, { target: { value: '0.8' } });
  await act(async () => reject(Error('Parameter rejected')));
  assert.equal(slider.value, '0.5');
  assert.match(screen.getByRole('alert').textContent ?? '', /Parameter rejected/);
  fireEvent.change(slider, { target: { value: '0.9' } });
  await act(async () => fixture.publish({ revisionId: 'new-revision', intensity: 0.2 }));
  slider = screen.getByRole('slider', { name: 'Intensity' }) as HTMLInputElement;
  assert.equal(slider.value, '0.2');
  await act(async () => reject(Error('Old revision rejected')));
  assert.equal(slider.value, '0.2');
  assert.equal(screen.queryByText('Old revision rejected'), null);
});

test('RTL: a replaced runtime has an independent input queue while old writes are pending', async () => {
  const fixture = service();
  const pending: Array<{ resolve(): void; reject(reason: Error): void }> = [];
  fixture.client.invoke = operation => {
    fixture.calls.push(operation);
    return new Promise((resolve, reject) => pending.push({ resolve: () => {
      if (operation.name === 'lux.parameters.set') fixture.publish(operation.input.values);
      resolve({});
    }, reject }));
  };
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  let slider = screen.getByRole('slider', { name: 'Intensity' }) as HTMLInputElement;
  fireEvent.change(slider, { target: { value: '0.8' } });
  await act(async () => fixture.publish({ revisionId: 'new-revision', intensity: 0.2 }));
  slider = screen.getByRole('slider', { name: 'Intensity' }) as HTMLInputElement;
  fireEvent.change(slider, { target: { value: '0.4' } });
  assert.equal(fixture.calls.length, 2, 'new runtime input cannot queue behind the obsolete target');
  await act(async () => pending[1]!.resolve());
  assert.equal(slider.value, '0.4');
  await act(async () => pending[0]!.reject(Error('Obsolete revision')));
  assert.equal(slider.value, '0.4');
  assert.equal(screen.queryByRole('alert'), null);
});

test('RTL: Escape exits native fullscreen even before its state notification arrives', async () => {
  const values: boolean[] = [];
  const windows = { getState: async () => ({ detached: false, fullscreen: false }), subscribe: () => () => {},
    popout: async () => {}, dock: async () => {}, fullscreen: async (value: boolean) => { values.push(value); } };
  render(<StudioApp client={createDisconnectedClient()} windows={windows} nowMs={1000} />);
  await userEvent.setup({ document }).keyboard('{Escape}');
  assert.deepEqual(values, [false]);
});

test('RTL: fullscreen shows only preview, ignores stale initial state, and exits on first Escape', async () => {
  let notify!: (state: WindowState) => void, initial!: (state: WindowState) => void;
  const windows = {
    getState: () => new Promise<WindowState>(resolve => { initial = resolve; }),
    subscribe: (listener: (state: WindowState) => void) => { notify = listener; return () => {}; },
    popout: async () => {}, dock: async () => {},
    fullscreen: async (fullscreen: boolean) => { notify({ detached: false, fullscreen }); },
  };
  const { container } = render(<StudioApp client={service().client} windows={windows} nowMs={1000} />);
  const surface = container.querySelector('.preview-surface');
  await act(async () => { fireEvent.keyDown(window, { key: 'F11' }); await Promise.resolve(); });
  assert.ok(container.querySelector('.studio-preview-fullscreen'));
  assert.equal(screen.queryByRole('button', { name: 'Play' }), null);
  assert.equal(screen.queryByRole('slider'), null);
  assert.ok(screen.getByText('Press Escape to exit fullscreen'));
  await act(async () => { initial({ detached: false, fullscreen: false }); await Promise.resolve(); });
  assert.ok(container.querySelector('.studio-preview-fullscreen'));
  await act(async () => { fireEvent.keyDown(window, { key: 'F11', repeat: true }); await Promise.resolve(); });
  assert.ok(container.querySelector('.studio-preview-fullscreen'), 'repeat does not toggle fullscreen');
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 3600)); });
  assert.equal(screen.queryByText('Press Escape to exit fullscreen'), null);
  await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }); await Promise.resolve(); });
  assert.equal(container.querySelector('.studio-preview-fullscreen'), null);
  assert.ok(screen.getByRole('button', { name: 'Fullscreen' }));
  assert.equal(container.querySelector('.preview-surface'), surface);
});


test('RTL: unavailable popout is absent while fullscreen remains available', async () => {
  const windows = { getState: async () => ({ detached: false, fullscreen: false }), subscribe: () => () => {},
    dock: async () => {}, fullscreen: async () => {} };
  render(<StudioApp client={service().client} windows={windows} nowMs={1000} />);
  assert.equal(screen.queryByRole('button', { name: 'Pop out' }), null);
  assert.equal((screen.getByRole('button', { name: 'Fullscreen' }) as HTMLButtonElement).disabled, false);
});

test('RTL: global authoring shortcuts dispatch one shared action and suppress repeats', async () => {
  const calls: string[] = [];
  const action = (name: string, disabled = false) => ({ disabled, run: () => { calls.push(name); } });
  render(<StudioApp client={createDisconnectedClient()} nowMs={1000} shortcutActions={{
    save: action('save'), 'save-as': action('save-as'), export: action('export'), build: action('build'),
    'save-frame': action('frame', true), 'toggle-recording': action('record'),
  }} />);
  for (const event of [
    { key: 's', ctrlKey: true }, { key: 's', ctrlKey: true, shiftKey: true },
    { key: 'e', ctrlKey: true, shiftKey: true }, { key: 'Enter', ctrlKey: true },
    { key: 'p', ctrlKey: true, shiftKey: true }, { key: 'r', ctrlKey: true, shiftKey: true },
  ]) fireEvent.keyDown(window, event);
  fireEvent.keyDown(window, { key: 'r', ctrlKey: true, shiftKey: true, repeat: true });
  const handled = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
  handled.preventDefault(); window.dispatchEvent(handled);
  const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog'); document.body.append(dialog);
  fireEvent.keyDown(window, { key: 's', ctrlKey: true, shiftKey: true });
  dialog.remove();
  assert.deepEqual(calls, ['save', 'save-as', 'export', 'build', 'record']);
});

test('RTL: question mark opens the shortcut reference without intercepting text entry or repeats', async () => {
  render(<StudioApp client={createDisconnectedClient()} nowMs={1000} />);
  const input = document.createElement('input'); document.body.append(input); input.focus();
  const questionMark = new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true, cancelable: true });
  input.dispatchEvent(questionMark);
  assert.equal(questionMark.defaultPrevented, false, 'question-mark typing remains available to text inputs');
  assert.equal(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' }), null);
  input.remove();
  const fullscreen = screen.getByRole('button', { name: 'Fullscreen' });
  await act(async () => { fullscreen.focus(); });
  await act(async () => { fireEvent.keyDown(window, { key: '?', shiftKey: true }); });
  const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
  assert.ok(within(dialog).getByText('Build preview'));
  assert.ok(within(dialog).getByText('Ctrl+Enter'));
  assert.ok(within(dialog).getByText('Shift+/'));
  const repeatedQuestionMark = new KeyboardEvent('keydown', { key: '?', shiftKey: true, repeat: true, bubbles: true, cancelable: true });
  await act(async () => { window.dispatchEvent(repeatedQuestionMark); });
  assert.equal(repeatedQuestionMark.defaultPrevented, false, 'repeated question mark is not intercepted');
  assert.equal(screen.getAllByRole('dialog', { name: 'Keyboard shortcuts' }).length, 1);
});
