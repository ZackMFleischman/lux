import test, { afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { StudioClient, StudioOperation, StudioSnapshot, RuntimeView } from '../../apps/studio/src/service-client.ts';
import type { WindowState } from '../../apps/studio/src/window-client.ts';
import { image, meta as componentMetadata } from '../runtime/nested-graph-fixtures.ts';

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

test('RTL: Boolean and dropdown controls expose typed values, descriptions and defaults without animation', async () => {
  const fixture = service();
  const schema = [
    { id: 'trail', type: 'boolean', label: 'Trail', default: false, description: 'Keep earlier frames visible.', changeCost: 'live' },
    { id: 'direction', type: 'enum', label: 'Direction', default: 'forward', presentation: 'dropdown', options: [
      { id: 'forward', label: 'Forward' }, { id: 'reverse', label: 'Reverse', description: 'Move back through the path.' },
    ], changeCost: 'live' },
  ] as any;
  fixture.publish({ sdkVersion: '0.2.0', intensity: undefined, controlSchema: schema, controlSchemaHash: 'c'.repeat(64), controls: { trail: true, direction: 'reverse' }, controlSequence: 0 } as any);
  const user = userEvent.setup({ document });
  render(<StudioApp client={fixture.client} nowMs={1000} />);

  const trail = screen.getByRole('switch', { name: 'Trail' }) as HTMLInputElement;
  assert.equal(trail.checked, true);
  assert.equal(screen.queryByRole('button', { name: 'Animate Trail' }), null);
  assert.equal(screen.queryByRole('button', { name: 'Animate Direction' }), null);
  assert.equal(screen.getByText('Trail').getAttribute('tabindex'), '0', 'descriptions stay keyboard reachable');

  await user.click(trail);
  await waitFor(() => assert.deepEqual((fixture.calls[0] as any).input.values, { trail: false }));
  await user.click(screen.getByRole('combobox', { name: 'Direction value' }));
  const reverse=screen.getByRole('option',{name:'Reverse'});fireEvent.focus(reverse);
  assert.ok(await screen.findByRole('tooltip',{name:/Move back through the path/}));
  await act(async()=>{fireEvent.blur(reverse);await new Promise(resolve=>setTimeout(resolve,300));});
  await user.click(screen.getByRole('option', { name: 'Forward' }));
  await waitFor(() => assert.deepEqual((fixture.calls[1] as any).input.values, { direction: 'forward' }));
  await user.click(screen.getByRole('button', { name: 'Reset Trail to default' }));
  await waitFor(() => assert.deepEqual((fixture.calls[2] as any).input.values, { trail: false }));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 500)); });
});


test('RTL: trigger actions use one native button, isolate pending state and never mark persistent edits', async () => {
  const fixture=service(),pending:{resolve(value:unknown):void}[]=[],dirty:string[]=[];
  fixture.client.invoke=operation=>{fixture.calls.push(operation);return new Promise(resolve=>pending.push({resolve}));};
  fixture.publish({sdkVersion:'0.2.0',intensity:undefined,controlSchema:[
    {id:'regenerate',type:'trigger',label:'Regenerate flock',description:'Create a fresh flock arrangement.',changeCost:'live'},
    {id:'shufflePalette',type:'trigger',label:'Shuffle palette',changeCost:'live'},
  ] as any,controlSchemaHash:'3'.repeat(64),controls:{},controlSequence:0} as any);
  const user=userEvent.setup({document});
  render(<StudioApp client={fixture.client} nowMs={1000} controlEdits={{changed:()=>dirty.push('changed'),track:()=>dirty.push('track')}}/>);

  const regenerate=screen.getByRole('button',{name:'Run Regenerate flock'});
  const shuffle=screen.getByRole('button',{name:'Run Shuffle palette'});
  assert.equal(screen.queryByRole('button',{name:'Reset Regenerate flock to default'}),null);
  assert.equal(screen.queryByRole('button',{name:'Animate Regenerate flock'}),null);
  const regenerateLabel=screen.getByText('Regenerate flock');await act(async()=>regenerateLabel.focus());
  assert.equal(document.activeElement,regenerateLabel);
  assert.ok(await screen.findByRole('tooltip',{name:/Create a fresh flock arrangement/}));
  await act(async()=>{fireEvent.blur(screen.getByText('Regenerate flock'));await new Promise(resolve=>setTimeout(resolve,300));});

  await user.click(regenerate);
  await waitFor(()=>assert.equal(pending.length,1));
  assert.equal(document.activeElement,regenerate,'pending must preserve the action focus');
  assert.equal(regenerate.getAttribute('aria-busy'),'true');
  assert.equal(regenerate.getAttribute('aria-disabled'),'true');
  assert.equal((shuffle as HTMLButtonElement).disabled,false,'another trigger remains available');
  assert.deepEqual(dirty,[],'commands never enter ControlEdits persistence tracking');
  const first=(fixture.calls[0] as any).input.commandId;
  assert.match(first,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  await user.click(regenerate);await user.keyboard('{Enter}');await user.keyboard('[Space]');
  assert.equal(fixture.calls.length,1,'pending pointer and keyboard activation cannot duplicate the command');
  await act(async()=>pending[0]!.resolve({result:'applied'}));
  await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Run Regenerate flock'})));
  assert.equal(screen.queryByRole('status'),null,'an applied command has no optimistic or persistent success UI');

  regenerate.focus();await user.keyboard('{Enter}');await waitFor(()=>assert.equal(pending.length,2));
  await act(async()=>pending[1]!.resolve({result:'applied'}));
  await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Run Regenerate flock'})));
  regenerate.focus();await user.keyboard('[Space]');await waitFor(()=>assert.equal(pending.length,3));
  assert.equal(fixture.calls.length,3,'pointer, Enter and Space each dispatch exactly once');
  assert.notEqual((fixture.calls[1] as any).input.commandId,first);
  assert.notEqual((fixture.calls[2] as any).input.commandId,(fixture.calls[1] as any).input.commandId);
  await act(async()=>pending[2]!.resolve({result:'applied'}));
  await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Run Regenerate flock'})));
  await user.click(screen.getByRole('button',{name:'Run Regenerate flock'}));await waitFor(()=>assert.equal(pending.length,4));
  await act(async()=>fixture.update());
  const replacement=screen.getByRole('button',{name:'Run Regenerate flock'});
  assert.equal(replacement.getAttribute('aria-busy'),null,'a replaced runtime cancels obsolete pending UI');
  await act(async()=>pending[3]!.resolve({result:'applied'}));
  assert.equal(screen.getByRole('button',{name:'Run Regenerate flock'}),replacement);
  assert.deepEqual(dirty,[]);
});

test('RTL: a trigger visibly requires the selected source to be the active Story visual', async () => {
  const fixture=service();
  fixture.publish({sdkVersion:'0.2.0',intensity:undefined,controlSchema:[
    {id:'regenerate',type:'trigger',label:'Regenerate flock',changeCost:'live'},
  ] as any,controlSchemaHash:'5'.repeat(64),controls:{},controlSequence:0,selectedVisualId:'ambient',
    storySchedule:{committed:{visualId:'lead',activationId:3}} as any} as any);
  const {ParameterInspector}=await import('../../apps/studio/src/controls/ParameterInspector.tsx'),{StudioController}=await import('../../apps/studio/src/service-client.ts');
  const controller=new StudioController(fixture.client),view=render(<ParameterInspector runtime={fixture.client.getSnapshot().authoring} available client={fixture.client} controller={controller} onError={()=>{}}/>);

  let action=screen.getByRole('button',{name:'Run Regenerate flock'}) as HTMLButtonElement;
  assert.equal(action.disabled,true);
  const explanation=screen.getByText('Triggers require the active Story visual (lead). Select that source to run this action.');
  assert.equal(action.getAttribute('aria-describedby'),explanation.id);
  fireEvent.click(action);
  assert.equal(fixture.calls.length,0);

  fixture.publish({selectedVisualId:'lead'});
  view.rerender(<CacheProvider value={styleCache}><ParameterInspector runtime={fixture.client.getSnapshot().authoring} available client={fixture.client} controller={controller} onError={()=>{}}/></CacheProvider>);
  action=screen.getByRole('button',{name:'Run Regenerate flock'}) as HTMLButtonElement;
  assert.equal(action.disabled,false);
  assert.equal(screen.queryByText('Triggers require the active Story visual (lead). Select that source to run this action.'),null);
});

test('RTL: an uncertain trigger failure retries manually with the same command ID', async () => {
  const fixture=service(),outcomes:{resolve(value:unknown):void;reject(error:unknown):void}[]=[],errors:(string|null)[]=[];
  fixture.client.invoke=operation=>{fixture.calls.push(operation);return new Promise((resolve,reject)=>outcomes.push({resolve,reject}));};
  fixture.publish({sdkVersion:'0.2.0',intensity:undefined,controlSchema:[
    {id:'burst',type:'trigger',label:'Burst particles',changeCost:'live'},
  ] as any,controlSchemaHash:'4'.repeat(64),controls:{},controlSequence:0} as any);
  const {ParameterInspector}=await import('../../apps/studio/src/controls/ParameterInspector.tsx'),{StudioController}=await import('../../apps/studio/src/service-client.ts');
  const user=userEvent.setup({document});
  render(<ParameterInspector runtime={fixture.client.getSnapshot().authoring} available client={fixture.client} controller={new StudioController(fixture.client)} onError={error=>errors.push(error)}/>);

  await user.click(screen.getByRole('button',{name:'Run Burst particles'}));
  await waitFor(()=>assert.equal(outcomes.length,1));
  const uncertainId=(fixture.calls[0] as any).input.commandId;
  await act(async()=>outcomes[0]!.reject(Object.assign(Error('Receipt timed out.'),{code:'TRIGGER_TIMEOUT'})));
  const retry=await screen.findByRole('button',{name:'Retry Burst particles'});
  assert.equal(fixture.calls.length,1,'timeout never auto-retries');
  assert.match(errors.at(-1)??'',/Receipt timed out/);
  await user.click(retry);await waitFor(()=>assert.equal(outcomes.length,2));
  assert.equal((fixture.calls[1] as any).input.commandId,uncertainId,'manual retry preserves idempotency identity');
  await act(async()=>outcomes[1]!.resolve({result:'applied'}));
  await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Run Burst particles'})));

  await user.click(screen.getByRole('button',{name:'Run Burst particles'}));await waitFor(()=>assert.equal(outcomes.length,3));
  const rejectedId=(fixture.calls[2] as any).input.commandId;
  await act(async()=>outcomes[2]!.reject(Object.assign(Error('Trigger rejected.'),{code:'TRIGGER_REJECTED'})));
  const runAgain=await screen.findByRole('button',{name:'Run Burst particles'});
  await user.click(runAgain);await waitFor(()=>assert.equal(outcomes.length,4));
  assert.notEqual((fixture.calls[3] as any).input.commandId,rejectedId,'a definite failure starts a fresh activation');
  await act(async()=>outcomes[3]!.resolve({result:'applied'}));
});

test('RTL: a selected component trigger targets its canonical node without a persisted value', async () => {
  const fixture=service(),leafMetadata=componentMetadata({},{image},{reseed:{type:'trigger',label:'Reseed component'}}),trigger=leafMetadata.controls[0]!;
  const errors:(string|null)[]=[];
  const rootHash='a'.repeat(64),leafHash='b'.repeat(64),schemaHash='c'.repeat(64),nodeId='11111111-1111-4111-8111-111111111111';
  const rootMetadata=componentMetadata({},{image});
  fixture.publish({sdkVersion:'0.4.0',intensity:undefined,controlSchema:[],controlSchemaHash:'d'.repeat(64),controls:{},controlSequence:0,
    composition:{version:2,declaration:{definitions:{leaf:'./leaf.ts'},nodes:[{id:nodeId,definition:'leaf'}],edges:[],output:{nodeId,portId:'image'},expose:[]},definitionNames:{leaf:leafHash},graph:{version:2,rootDefinitionHash:rootHash,outputPort:'image'},definitions:{
      [rootHash]:{kind:'graph',metadata:rootMetadata,body:{nodes:[{id:nodeId,definitionHash:leafHash,controlDefaults:{}}],edges:[],inputBindings:{},outputBindings:{image:{nodeId,portId:'image'}},controlBindings:{}}},
      [leafHash]:{kind:'code',metadata:leafMetadata},
    },publicControls:[],publicControlBindings:{},nodes:[{nodePath:[nodeId],definitionHash:leafHash,schema:[trigger],schemaHash}]},
    nodeControls:{sourceHash:'revision-2',nodes:[{nodePath:[nodeId],definitionHash:leafHash,schema:[trigger],schemaHash,values:{}}]},
  } as any);
  const {ParameterInspector}=await import('../../apps/studio/src/controls/ParameterInspector.tsx'),{StudioController}=await import('../../apps/studio/src/service-client.ts');
  render(<ParameterInspector runtime={fixture.client.getSnapshot().authoring} available client={fixture.client} controller={new StudioController(fixture.client)} onError={error=>errors.push(error)} nodePath={[nodeId] as any}/>);
  const action=screen.getByRole('button',{name:'Run Reseed component'});fireEvent.click(action);
  await waitFor(()=>assert.ok(fixture.calls.length||errors.some(Boolean)));
  assert.deepEqual(errors.filter(Boolean),[]);
  assert.equal(fixture.calls[0]?.name,'lux.node.trigger.fire');
  assert.deepEqual((fixture.calls[0] as any).input.nodePath,[nodeId]);
  assert.equal((fixture.calls[0] as any).input.controlId,'reseed');
  assert.deepEqual(fixture.client.getSnapshot().authoring?.nodeControls?.nodes[0]?.values,{});
});
function storyStatus(overrides:Record<string,unknown>={}){
  const beats=[{id:'arrival',label:'Arrival',timing:{kind:'timed',durationSeconds:10}},{id:'hold',label:'Hold',timing:{kind:'sustained'}}];
  const sequence=[{id:'arrival-a',beatId:'arrival',follow:{kind:'after',seconds:4}},{id:'hold-a',beatId:'hold',follow:{kind:'manual'}},{id:'hold-b',beatId:'hold',follow:{kind:'after',seconds:5}}];
  return {definition:{version:1,beats,sequence},storyHash:'a'.repeat(64),storyRevision:4,
    frame:{state:'normal',storyEpoch:1},phase:'paused',autoAdvance:false,loop:false,effectiveAdvancing:false,
    sequence:{state:'detached',occurrenceId:null,index:null,nextOccurrenceId:null,dwellElapsedSeconds:0,dwellRemainingSeconds:null,awaitingCue:false},
    resumeCandidates:[],disabledReasons:{},...overrides} as any;
}
function storySchedule(overrides:Record<string,unknown>={}){
  const definition={version:2,normalVisualId:'lead',crossfadeSeconds:.35,
    beats:[{id:'arrival',label:'Arrival',timing:{kind:'timed',durationSeconds:10},visualId:'ambient'},{id:'hold',label:'Hold',timing:{kind:'sustained'},visualId:'lead'}],
    sequence:[{id:'arrival-a',beatId:'arrival',follow:{kind:'manual'},visualId:'ambient'}]};
  const committed={slotId:'slot-in',visualId:'ambient',beatId:'arrival',occurrenceId:'arrival-a',activationId:3,storyEpoch:2,
    frame:{state:'active',storyEpoch:2,beatId:'arrival',activationId:3,occurrenceId:'arrival-a',elapsedSeconds:2,localTimeSeconds:2,progress:.2}};
  return {instanceId:'instance',generation:2,scheduleHash:'b'.repeat(64),capsuleHash:'c'.repeat(64),definition,storyHash:'a'.repeat(64),storyRevision:5,
    visualCapabilities:[{visualId:'lead',storyCapability:{version:1,beats:[{id:'hold',kind:'sustained',seek:'none'}]}},{visualId:'ambient',storyCapability:{version:1,beats:[{id:'arrival',kind:'timed',seek:'direct'}]}}],
    phase:'running',autoAdvance:true,loop:false,effectiveAdvancing:true,committed,outgoing:null,incoming:null,crossfadeProgress:null,pendingPreparation:null,dueNext:null,preparationFailure:null,
    sequence:{state:'attached',occurrenceId:'arrival-a',index:0,nextOccurrenceId:null,dwellElapsedSeconds:0,dwellRemainingSeconds:null,awaitingCue:true},disabledReasons:{},resources:{slots:2,slotStates:{preparing:0,ready:0,active:1,retiring:0,unsettled:0},pendingCreates:0,storyTargetBytes:1,assetLeases:0,assetLeaseBytes:0,assetStagingJobs:0,assetStagingBytes:0,pendingImports:0,ownedModuleURLs:0,pendingCallbacks:0,gpuSubmissions:0,readbackGrants:0,readbackBytes:0},...overrides} as any;
}

test('RTL: Story v2 exposes source-specific capabilities, overlap and preparation state',async()=>{
  const outgoing={slotId:'slot-out',visualId:'lead',beatId:'hold',occurrenceId:null,activationId:2,storyEpoch:1,frame:{state:'active',storyEpoch:1,beatId:'hold',activationId:2,occurrenceId:null,elapsedSeconds:5,localTimeSeconds:null,progress:null}};
  const status=storySchedule({outgoing,crossfadeProgress:.4,disabledReasons:{launch:{code:'STORY_CAPACITY',message:'Wait for a Story slot to retire.'}}});
  const {StoryPanel}=await import('../../apps/studio/src/story/StoryPanel.tsx');
  const view=render(<StoryPanel status={status} available controller={{storyTransport:async()=>({})} as any} onError={()=>{}}/>);
  assert.ok(screen.getByText('Source ambient'));assert.ok(screen.getByText(/Transitioning from source lead to ambient · 40%/));
  assert.ok(screen.getByText(/source ambient · timed/));assert.ok(screen.getByText(/source lead · sustained/));assert.ok(screen.getByText('Wait for a Story slot to retire.'));
  assert.equal((screen.getByRole('button',{name:'Launch Arrival'}) as HTMLButtonElement).disabled,true);
  view.rerender(<CacheProvider value={styleCache}><StoryPanel status={storySchedule({committed:null,pendingPreparation:{token:'prepare-1',phase:'preparing',visualId:'ambient',beatId:'arrival',occurrenceId:'arrival-a',commandId:null,cancelled:false}})} available controller={{storyTransport:async()=>({})} as any} onError={()=>{}}/></CacheProvider>);
  assert.ok(screen.getByText('Preparing ambient'));assert.ok(screen.getByText('Preparing source ambient.'));
});

test('RTL: Story v2 reports a failed next-source preparation while keeping the committed preview active',async()=>{
  const status=storySchedule({preparationFailure:{visualId:'lead',beatId:'hold',occurrenceId:null,code:'STORY_PREPARATION_FAILED',message:'Shader compilation failed.'}});
  const {StoryPanel}=await import('../../apps/studio/src/story/StoryPanel.tsx');
  render(<StoryPanel status={status} available controller={{storyTransport:async()=>({})} as any} onError={()=>{}}/>);

  assert.ok(screen.getByRole('alert').textContent?.includes('Could not prepare source lead for Hold. Shader compilation failed.'));
  assert.ok(screen.getByText('Source ambient'),'the committed source remains the active preview status');
  assert.ok(screen.getByText('2.0s active'));
  assert.equal(screen.queryByRole('button',{name:/Retry/}),null,'preparation failure does not invent a retry command');
  assert.ok(screen.getByRole('button',{name:'Launch Hold'}),'the normal launch action remains the explicit retry path');
});

test('RTL: Story ribbon keeps selection separate from the attached occurrence and shows sustained dwell',async()=>{
  const status=storyStatus({frame:{state:'active',storyEpoch:2,beatId:'hold',activationId:3,occurrenceId:'hold-a',elapsedSeconds:12,localTimeSeconds:null,progress:null},
    phase:'running',autoAdvance:true,effectiveAdvancing:true,
    sequence:{state:'attached',occurrenceId:'hold-a',index:1,nextOccurrenceId:'hold-b',dwellElapsedSeconds:0,dwellRemainingSeconds:null,awaitingCue:true}});
  const calls:any[]=[];const controller={storyTransport:async(...args:any[])=>{calls.push(args);return {};}} as any;
  const {StoryPanel}=await import('../../apps/studio/src/story/StoryPanel.tsx');
  render(<StoryPanel status={status} available controller={controller} onError={()=>{}}/>);
  const ribbon=screen.getByRole('list',{name:'Story sequence'}),rows=within(ribbon).getAllByRole('button');
  assert.equal(rows.length,3);assert.equal(rows[1]!.getAttribute('aria-current'),'step');assert.equal(rows[1]!.getAttribute('aria-pressed'),'true');
  fireEvent.click(rows[2]!);
  assert.equal(rows[2]!.getAttribute('aria-pressed'),'true','selection moves without moving output');
  assert.equal(rows[1]!.getAttribute('aria-current'),'step','the transport cursor remains on the attached occurrence');
  assert.equal(calls.length,0);assert.ok(screen.getAllByText('Awaiting cue').length>=2);assert.ok(screen.getByText('Staying on beat'));
  assert.ok(screen.getByText('Auto-advance'),'the sequence switch has a visible label');
  const announcement=document.querySelector('.story-transition[aria-live="polite"]')!;assert.ok(announcement);assert.doesNotMatch(announcement.textContent??'',/12\.0s active/,'advancing elapsed time stays outside the live transition announcement');assert.ok(screen.getByText('12.0s active'));
  assert.equal(screen.queryByRole('slider',{name:/Local time/}),null,'sustained beats have no fabricated local timeline');
  assert.ok(screen.getByRole('button',{name:/Start here: Hold — occurrence 3 of 3/}));
  assert.ok(screen.getByRole('button',{name:'Return to normal'}));
});

test('RTL: Story ribbon shows scheduled dwell progress independently of a sustained beat',async()=>{
  const status=storyStatus({frame:{state:'active',storyEpoch:2,beatId:'hold',activationId:3,occurrenceId:'hold-b',elapsedSeconds:20,localTimeSeconds:null,progress:null},
    phase:'running',autoAdvance:true,effectiveAdvancing:true,
    sequence:{state:'attached',occurrenceId:'hold-b',index:2,nextOccurrenceId:null,dwellElapsedSeconds:2,dwellRemainingSeconds:3,awaitingCue:false}});
  const {StoryPanel}=await import('../../apps/studio/src/story/StoryPanel.tsx');
  render(<StoryPanel status={status} available controller={{storyTransport:async()=>({})} as any} onError={()=>{}}/>);
  const progress=screen.getByRole('progressbar',{name:'Dwell for Hold — occurrence 3 of 3'});
  assert.equal(progress.getAttribute('aria-valuenow'),'40');assert.ok(screen.getByText('3.0s remaining'));assert.ok(screen.getByText('Staying on beat'));
});
test('RTL: uncertain Story transport exposes an explicit exact retry',async()=>{
  const status=storyStatus(),calls:any[]=[],pending:{resolve(value:unknown):void;reject(error:unknown):void}[]=[];
  const controller={storyTransport:(...args:any[])=>{calls.push(args);return new Promise((resolve,reject)=>pending.push({resolve,reject}));}} as any;
  const {StoryPanel}=await import('../../apps/studio/src/story/StoryPanel.tsx');
  render(<StoryPanel status={status} available controller={controller} onError={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Start story'}));await waitFor(()=>assert.equal(calls.length,1));
  await act(async()=>pending[0]!.reject(Object.assign(Error('Story receipt timed out.'),{code:'STORY_TIMEOUT'})));
  assert.equal(calls.length,1,'an uncertain command is never retried automatically');
  fireEvent.click(await screen.findByRole('button',{name:'Retry start story'}));await waitFor(()=>assert.equal(calls.length,2));
  assert.deepEqual(calls[1],calls[0],'explicit retry preserves action, command ID and expected revision');
  await act(async()=>pending[1]!.resolve({receipt:{},currentStatus:status}));
});
test('RTL: timed Story scrub admits one seek and replaces the queued target with the latest position',async()=>{
  let status=storyStatus({storyRevision:7,frame:{state:'active',storyEpoch:2,beatId:'arrival',activationId:4,occurrenceId:null,elapsedSeconds:2,localTimeSeconds:2,progress:.2},phase:'running'});
  const calls:any[]=[],pending:{resolve(value:unknown):void;reject(error:unknown):void}[]=[];
  const controller={storyTransport:(...args:any[])=>{calls.push(args);return new Promise((resolve,reject)=>pending.push({resolve,reject}));}} as any;
  const errors:string[]=[];const {StoryPanel}=await import('../../apps/studio/src/story/StoryPanel.tsx');
  render(<StoryPanel status={status} available controller={controller} onError={error=>errors.push(error)}/>);
  const slider=screen.getByRole('slider',{name:'Local time for Arrival'}) as HTMLInputElement;
  const local=document.querySelector('.story-local-time')!,beats=document.querySelector('.story-beats')!;assert.ok(local.compareDocumentPosition(beats)&Node.DOCUMENT_POSITION_FOLLOWING,'active timed controls precede the full Beats list');
  fireEvent.change(slider,{target:{value:'3'}});fireEvent.change(slider,{target:{value:'6'}});fireEvent.change(slider,{target:{value:'8'}});
  await waitFor(()=>assert.equal(calls.length,1));assert.deepEqual(calls[0]![0],{action:'seek',localTimeSeconds:3});assert.equal(calls[0]![2],7);
  status=storyStatus({...status,storyRevision:8,frame:{...status.frame,localTimeSeconds:3,progress:.3}});
  await act(async()=>pending[0]!.resolve({result:'applied',commandId:calls[0]![1],action:calls[0]![0],storyRevision:8,frameId:'11',timeSeconds:2,story:status.frame,currentStatus:status}));
  await waitFor(()=>assert.equal(calls.length,2));assert.deepEqual(calls[1]![0],{action:'seek',localTimeSeconds:8});assert.equal(calls[1]![2],8);
  fireEvent.pointerDown(slider,{pointerId:1});fireEvent.change(slider,{target:{value:'9'}});fireEvent.keyDown(slider,{key:'Escape'});
  fireEvent.change(slider,{target:{value:'7'}});fireEvent.pointerUp(slider,{pointerId:1});
  status=storyStatus({...status,storyRevision:9,frame:{...status.frame,localTimeSeconds:8,progress:.8}});
  await act(async()=>pending[1]!.resolve({result:'applied',commandId:calls[1]![1],action:calls[1]![0],storyRevision:9,frameId:'12',timeSeconds:2,story:status.frame,currentStatus:status}));
  await act(async()=>{});assert.equal(calls.length,2,'Escape clears the unsent target');assert.equal(slider.value,'8');assert.deepEqual(errors,[]);
});
test('RTL: an acknowledgement from an earlier Story activation cannot overwrite the current scrub',async()=>{
  const first=storyStatus({storyRevision:7,frame:{state:'active',storyEpoch:2,beatId:'arrival',activationId:4,occurrenceId:null,elapsedSeconds:2,localTimeSeconds:2,progress:.2},phase:'running'});
  const second=storyStatus({storyRevision:8,frame:{state:'active',storyEpoch:2,beatId:'arrival',activationId:5,occurrenceId:null,elapsedSeconds:6,localTimeSeconds:6,progress:.6},phase:'running'});
  const calls:any[]=[],pending:{resolve(value:unknown):void}[]=[];
  const controller={storyTransport:(...args:any[])=>{calls.push(args);return new Promise(resolve=>pending.push({resolve}));}} as any;
  const {StoryPanel}=await import('../../apps/studio/src/story/StoryPanel.tsx');
  const view=render(<StoryPanel status={first} available controller={controller} onError={()=>{}}/>);
  fireEvent.change(screen.getByRole('slider',{name:'Local time for Arrival'}),{target:{value:'3'}});
  await waitFor(()=>assert.equal(calls.length,1));
  view.rerender(<CacheProvider value={styleCache}><StoryPanel status={second} available controller={controller} onError={()=>{}}/></CacheProvider>);
  const current=screen.getByRole('slider',{name:'Local time for Arrival'}) as HTMLInputElement;
  assert.equal(current.value,'6');
  const acknowledged=storyStatus({...first,storyRevision:9,frame:{...first.frame,localTimeSeconds:3,progress:.3}});
  await act(async()=>pending[0]!.resolve({receipt:{},currentStatus:acknowledged}));
  assert.equal(current.value,'6','the old activation acknowledgement cannot replace the new activation position');
  fireEvent.change(current,{target:{value:'7'}});await waitFor(()=>assert.equal(calls.length,2));
  assert.deepEqual(calls[1]![0],{action:'seek',localTimeSeconds:7});assert.equal(calls[1]![2],8);
});
test('RTL: a rejected seek reconciles a newer revision on the same Story activation',async()=>{
  const first=storyStatus({storyRevision:7,frame:{state:'active',storyEpoch:2,beatId:'arrival',activationId:4,occurrenceId:null,elapsedSeconds:2,localTimeSeconds:2,progress:.2},phase:'running'});
  const newer=storyStatus({storyRevision:8,frame:{state:'active',storyEpoch:2,beatId:'arrival',activationId:4,occurrenceId:null,elapsedSeconds:6,localTimeSeconds:6,progress:.6},phase:'paused'});
  const calls:any[]=[],pending:{resolve(value:unknown):void;reject(error:unknown):void}[]=[];
  const controller={storyTransport:(...args:any[])=>{calls.push(args);return new Promise((resolve,reject)=>pending.push({resolve,reject}));}} as any,errors:string[]=[];
  const {StoryPanel}=await import('../../apps/studio/src/story/StoryPanel.tsx');
  const view=render(<StoryPanel status={first} available controller={controller} onError={error=>errors.push(error)}/>);
  fireEvent.change(screen.getByRole('slider',{name:'Local time for Arrival'}),{target:{value:'3'}});await waitFor(()=>assert.equal(calls.length,1));
  view.rerender(<CacheProvider value={styleCache}><StoryPanel status={newer} available controller={controller} onError={error=>errors.push(error)}/></CacheProvider>);
  await act(async()=>pending[0]!.reject(Object.assign(Error('Story changed.'),{code:'STORY_CHANGED'})));
  const slider=screen.getByRole('slider',{name:'Local time for Arrival'}) as HTMLInputElement;
  assert.equal(slider.value,'6','a failed stale seek restores the latest authoritative position');
  fireEvent.change(slider,{target:{value:'7'}});await waitFor(()=>assert.equal(calls.length,2));
  assert.deepEqual(calls[1]![0],{action:'seek',localTimeSeconds:7});assert.equal(calls[1]![2],8,'the next seek uses the latest rendered revision');
  assert.deepEqual(errors,['Story changed.']);
});
test('RTL: a sub-10ms timed Story beat retains a usable local-time step and readable position',async()=>{
  const tiny=storyStatus({definition:{version:1,beats:[{id:'spark',label:'Spark',timing:{kind:'timed',durationSeconds:.005}}],sequence:[]},frame:{state:'active',storyEpoch:2,beatId:'spark',activationId:1,occurrenceId:null,elapsedSeconds:.0025,localTimeSeconds:.0025,progress:.5}});
  const calls:any[]=[],controller={storyTransport:(...args:any[])=>{calls.push(args);return new Promise(()=>{});}} as any;
  const {StoryPanel}=await import('../../apps/studio/src/story/StoryPanel.tsx');render(<StoryPanel status={tiny} available controller={controller} onError={()=>{}}/>);
  const slider=screen.getByRole('slider',{name:'Local time for Spark'}) as HTMLInputElement;
  assert.equal(slider.max,'0.005');assert.equal(slider.step,'0.00005');assert.ok(screen.getByText('2.5ms / 5ms'));
  fireEvent.change(slider,{target:{value:'.003'}});await waitFor(()=>assert.equal(calls.length,1));assert.deepEqual(calls[0]![0],{action:'seek',localTimeSeconds:.003});
});
test('RTL: segmented enum uses one roving tab stop and keyboard selection by stable option ID', async () => {
  const fixture = service();
  fixture.publish({ sdkVersion: '0.2.0', intensity: undefined, controlSchema: [{
    id: 'pattern', type: 'enum', label: 'Pattern', default: 'dots', presentation: 'segmented',
    options: [{ id: 'dots', label: 'Dots' }, { id: 'lines', label: 'Lines' }, { id: 'grid', label: 'A very long grid label', description: 'A regular grid.' }], changeCost: 'live',
  }] as any, controlSchemaHash: 'd'.repeat(64), controls: { pattern: 'lines' }, controlSequence: 0 } as any);
  render(<StudioApp client={fixture.client} nowMs={1000} />);

  const group = screen.getByRole('group', { name: 'Pattern value' });
  const choices = within(group).getAllByRole('button') as HTMLButtonElement[];
  assert.deepEqual(choices.map(choice => choice.tabIndex), [-1, 0, -1]);
  choices[1]!.focus();
  fireEvent.keyDown(choices[1]!, { key: 'End' });
  assert.equal(document.activeElement, choices[2]);
  assert.ok(await screen.findByRole('tooltip',{name:/A regular grid/}));
  assert.ok(screen.getByRole('button',{name:'A very long grid label',description:/A regular grid/}));
  fireEvent.keyDown(choices[2]!, { key: 'Enter' });
  await waitFor(() => assert.deepEqual((fixture.calls[0] as any).input.values, { pattern: 'grid' }));
  await act(async () => {});
  assert.ok(screen.getByRole('button',{name:'A very long grid label'}));
  await act(async()=>{fireEvent.blur(choices[2]!);await new Promise(resolve=>setTimeout(resolve,300));});
});

test('RTL: radio enum exposes a radiogroup and arrow keys select the next stable option ID', async () => {
  const fixture = service();
  fixture.publish({ sdkVersion: '0.2.0', intensity: undefined, controlSchema: [{
    id: 'quality', type: 'enum', label: 'Quality', default: 'balanced', presentation: 'radio',
    options: [{ id: 'fast', label: 'Fast' }, { id: 'balanced', label: 'Balanced' }, { id: 'fine', label: 'Fine', description: 'Use the highest detail.' }], changeCost: 'live',
  }] as any, controlSchemaHash: 'e'.repeat(64), controls: { quality: 'balanced' }, controlSequence: 0 } as any);
  render(<StudioApp client={fixture.client} nowMs={1000} />);

  const group = screen.getByRole('radiogroup', { name: 'Quality value' });
  const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
  assert.deepEqual(radios.map(radio => radio.tabIndex), [-1, 0, -1]);
  fireEvent.focus(radios[1]!);
  fireEvent.keyDown(radios[1]!, { key: 'ArrowRight' });
  assert.ok(await screen.findByRole('tooltip',{name:/Use the highest detail/}));
  assert.ok(screen.getByRole('radio',{name:'Fine',description:/Use the highest detail/}));
  await waitFor(() => assert.deepEqual((fixture.calls[0] as any).input.values, { quality: 'fine' }));
  await act(async () => {});
  assert.equal(document.activeElement, radios[2]);
  await act(async()=>{fireEvent.blur(radios[2]!);await new Promise(resolve=>setTimeout(resolve,300));});
});

test('RTL: an older Boolean acknowledgement cannot revert a newer local edit', async () => {
  const fixture = service(), pending: { resolve(value: unknown): void }[] = [];
  fixture.client.invoke = operation => { fixture.calls.push(operation); return new Promise(resolve => pending.push({ resolve })); };
  const schema = [{ id: 'trail', type: 'boolean', label: 'Trail', default: false, changeCost: 'live' }] as any;
  fixture.publish({ sdkVersion: '0.2.0', intensity: undefined, controlSchema: schema, controlSchemaHash: 'f'.repeat(64), controls: { trail: true }, controlSequence: 0 } as any);
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  const trail = screen.getByRole('switch', { name: 'Trail' }) as HTMLInputElement;

  fireEvent.click(trail);
  await waitFor(() => assert.equal(pending.length, 1));
  fireEvent.click(trail);
  assert.equal(trail.checked, true);
  await act(async () => { fixture.publish({ controls: { trail: false }, controlSequence: 1 } as any); pending[0]!.resolve({ accepted: true }); });
  await waitFor(() => assert.equal(pending.length, 2));
  assert.equal(trail.checked, true, 'the first applied value must not overwrite the second pending intent');
  await act(async () => { fixture.publish({ controls: { trail: true }, controlSequence: 2 } as any); pending[1]!.resolve({ accepted: true }); });
  assert.equal(trail.checked, true);
});

for(const presentation of ['segmented','radio'] as const)test(`RTL: an older acknowledgement preserves a newer ${presentation} enum selection and roving tab stop`,async()=>{
  const fixture=service(),pending:{resolve(value:unknown):void}[]=[];
  fixture.client.invoke=operation=>{fixture.calls.push(operation);return new Promise(resolve=>pending.push({resolve}));};
  fixture.publish({sdkVersion:'0.2.0',intensity:undefined,controlSchema:[{id:'pattern',type:'enum',label:'Pattern',default:'lines',presentation,
    options:[{id:'dots',label:'Dots'},{id:'lines',label:'Lines'},{id:'grid',label:'Grid'}],changeCost:'live'}] as any,
    controlSchemaHash:'1'.repeat(64),controls:{pattern:'lines'},controlSequence:0} as any);
  render(<StudioApp client={fixture.client} nowMs={1000}/>);
  const group=screen.getByRole(presentation==='radio'?'radiogroup':'group',{name:'Pattern value'}),role=presentation==='radio'?'radio':'button';
  const options=within(group).getAllByRole(role) as HTMLInputElement[];

  fireEvent.focus(options[2]!);fireEvent.click(options[2]!);await waitFor(()=>assert.equal(pending.length,1));
  fireEvent.focus(options[0]!);fireEvent.click(options[0]!);
  const selected=(element:HTMLInputElement)=>presentation==='radio'?element.checked:element.getAttribute('aria-pressed')==='true';
  assert.equal(selected(options[0]!),true);assert.deepEqual(options.map(option=>option.tabIndex),[0,-1,-1]);
  await act(async()=>{fixture.publish({controls:{pattern:'grid'},controlSequence:1} as any);pending[0]!.resolve({accepted:true});});
  await waitFor(()=>assert.equal(pending.length,2));
  assert.equal(selected(options[0]!),true,'the first applied value must not overwrite the second pending enum intent');
  assert.deepEqual(options.map(option=>option.tabIndex),[0,-1,-1],'the old acknowledgement must not move the roving tab stop');
  await act(async()=>{fixture.publish({controls:{pattern:'dots'},controlSequence:2} as any);pending[1]!.resolve({accepted:true});});
});

for(const presentation of ['segmented','radio'] as const)test(`RTL: a rejected ${presentation} enum edit restores its confirmed selection and roving tab stop`,async()=>{
  const fixture=service();fixture.fail();
  fixture.publish({sdkVersion:'0.2.0',intensity:undefined,controlSchema:[{id:'pattern',type:'enum',label:'Pattern',default:'lines',presentation,
    options:[{id:'dots',label:'Dots'},{id:'lines',label:'Lines'},{id:'grid',label:'Grid'}],changeCost:'live'}] as any,
    controlSchemaHash:'2'.repeat(64),controls:{pattern:'lines'},controlSequence:0} as any);
  const {ParameterInspector}=await import('../../apps/studio/src/controls/ParameterInspector.tsx'),{StudioController}=await import('../../apps/studio/src/service-client.ts');
  render(<ParameterInspector runtime={fixture.client.getSnapshot().authoring} available client={fixture.client} controller={new StudioController(fixture.client)} onError={()=>{}}/>);
  const group=screen.getByRole(presentation==='radio'?'radiogroup':'group',{name:'Pattern value'}),role=presentation==='radio'?'radio':'button';
  const options=within(group).getAllByRole(role) as HTMLInputElement[],selected=(element:HTMLInputElement)=>presentation==='radio'?element.checked:element.getAttribute('aria-pressed')==='true';

  fireEvent.focus(options[2]!);fireEvent.click(options[2]!);
  await waitFor(()=>assert.equal(selected(options[1]!),true));
  assert.deepEqual((fixture.calls[0] as any).input.values,{pattern:'grid'});
  assert.deepEqual(options.map(option=>option.tabIndex),[-1,0,-1]);
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
    getMonitoring:()=>false,setMonitoring:async(value:boolean)=>value,
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
    getMonitoring:()=>false,setMonitoring:async(value:boolean)=>value,
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
    getMonitoring:()=>false,setMonitoring:async(value:boolean)=>value,
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
    getMonitoring:()=>false,setMonitoring:async(value:boolean)=>value,
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
  assert.ok(tooltip.querySelector('.control-description-tooltip'),'description tooltip keeps its product styling hook');
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

test('RTL: Inspector filtering matches control and group names without changing values', () => {
  const fixture = service();
  fixture.publish({ sdkVersion: '0.2.0', intensity: undefined, controlSchema: [
    { id: 'perchDuration', type: 'number' as const, label: 'Perch duration', group: 'Bird Personality', min: 1, max: 90, default: 10, changeCost: 'live' as const },
    { id: 'sociability', type: 'number' as const, label: 'Sociability', group: 'Bird Personality', min: 0, max: 1, default: .5, changeCost: 'live' as const },
    { id: 'wingSpeed', type: 'number' as const, label: 'Wing speed', group: 'Bird Flight', min: 0, max: 8, default: 1, changeCost: 'live' as const },
    { id: 'plumage', type: 'number' as const, label: 'Plumage palette', group: 'Bird Appearance', min: 0, max: 1, default: .5, changeCost: 'live' as const },
  ], controlSchemaHash: 'f'.repeat(64), controls: { perchDuration: 10, sociability: .5, wingSpeed: 1, plumage: .5 }, controlSequence: 0 });
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  const filter = screen.getByRole('textbox', { name: 'Filter controls' });
  const personality = screen.getByText('Bird Personality').closest('details')!;
  fireEvent.click(screen.getByText('Bird Personality').closest('summary')!);
  assert.equal(personality.open, false);
  fireEvent.change(filter, { target: { value: 'flight' } });
  assert.ok(screen.getByText('Bird Flight'));
  assert.ok(screen.getByRole('slider', { name: 'Wing speed' }));
  assert.equal(screen.queryByText('Bird Personality'), null);
  assert.equal(screen.queryByRole('slider', { name: 'Perch duration' }), null);
  fireEvent.change(filter, { target: { value: 'soci' } });
  assert.ok(screen.getByText('Bird Personality'));
  assert.equal(screen.getByText('Bird Personality').closest('details')!.open, true);
  assert.ok(screen.getByRole('slider', { name: 'Sociability' }));
  assert.equal(screen.queryByRole('slider', { name: 'Perch duration' }), null);
  fireEvent.change(filter, { target: { value: 'missing' } });
  assert.ok(screen.getByText('No controls match “missing”.'));
  fireEvent.change(filter, { target: { value: '' } });
  assert.equal(document.querySelectorAll('.parameter-group').length, 3);
  assert.equal(personality.open, false);
  assert.deepEqual(fixture.client.getSnapshot().authoring?.controls, { perchDuration: 10, sociability: .5, wingSpeed: 1, plumage: .5 });
});

test('RTL: Inspector group actions clear filters and apply to every group without changing values', () => {
  const fixture = service();
  fixture.publish({ sdkVersion: '0.2.0', intensity: undefined, controlSchema: [
    { id: 'perchDuration', type: 'number' as const, label: 'Perch duration', group: 'Bird Personality', min: 1, max: 90, default: 10, changeCost: 'live' as const },
    { id: 'wingSpeed', type: 'number' as const, label: 'Wing speed', group: 'Bird Flight', min: 0, max: 8, default: 1, changeCost: 'live' as const },
  ], controlSchemaHash: 'g'.repeat(64), controls: { perchDuration: 10, wingSpeed: 1 }, controlSequence: 0 });
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  const filter = screen.getByRole('textbox', { name: 'Filter controls' });
  fireEvent.change(filter, { target: { value: 'flight' } });
  fireEvent.click(screen.getByRole('button', { name: 'Collapse all control groups' }));
  assert.equal((filter as HTMLInputElement).value, '');
  assert.ok([...document.querySelectorAll<HTMLDetailsElement>('.parameter-group')].every(group => !group.open));
  fireEvent.click(screen.getByRole('button', { name: 'Expand all control groups' }));
  assert.ok([...document.querySelectorAll<HTMLDetailsElement>('.parameter-group')].every(group => group.open));
  assert.deepEqual(fixture.client.getSnapshot().authoring?.controls, { perchDuration: 10, wingSpeed: 1 });
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

test('RTL: sequence timing is visible before launch and selection does not alter transport',async()=>{
  const calls:any[]=[];
  const {StoryPanel}=await import('../../apps/studio/src/story/StoryPanel.tsx');
  render(<StoryPanel status={storyStatus()} available controller={{storyTransport:async(...args:any[])=>{calls.push(args);return {};}} as any} onError={()=>{}}/>);
  const rows=within(screen.getByRole('list',{name:'Story sequence'})).getAllByRole('listitem');
  assert.match(rows[0]!.textContent??'',/4\.0s/,'show scheduled dwell, not the 10s local beat duration');
  assert.match(rows[1]!.textContent??'',/Manual cue/,'manual waits are explicit before activation');
  assert.match(rows[2]!.textContent??'',/5\.0s/);
  fireEvent.click(within(rows[2]!).getByRole('button'));
  assert.equal(calls.length,0);
  fireEvent.click(screen.getByRole('button',{name:/Start here: Hold — occurrence 3 of 3/}));
  await waitFor(()=>assert.equal(calls.length,1));
  assert.deepEqual(calls[0][0],{action:'start',occurrenceId:'hold-b'});
});
