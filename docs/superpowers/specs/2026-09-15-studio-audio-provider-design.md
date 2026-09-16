# Studio Audio Provider Design

## User result

The user selects one Studio audio input. Bass drives one control and Highs drives another. Both bindings share one analyzer, preserve editable manual base values, survive save and reopen, and release their contribution smoothly after disconnect. A failed visual replacement keeps the accepted preview and its audio response.

This first slice excludes MIDI, kick detection, beat or tempo estimation, host FFT, recording, broad signal wiring, and image-chain signal nodes.

## Existing owners and boundaries

- `packages/runtime-contracts/src/control-animation.mjs` strictly validates the current nine-field LFO record and rejects duplicate `nodePath` plus `controlId` targets.
- `apps/studio/src/controls/control-animation.mjs` owns target normalization and effective control evaluation.
- `apps/studio/src/controls/worker-control-state.mjs` and `worker-composition-state.mjs` adapt that evaluator to flat and composition controls.
- `apps/studio/src/standalone-client.ts` owns runtime replacement, accepted-preview retention, worker identity, animation commands, and candidate promotion.
- `apps/studio/src/visual-worker.mjs` serializes worker messages and rejects mismatched runtime identities before applying state.
- `packages/core/src/scene-document.ts` and `apps/studio/src/source/authoring-session.ts` persist and restore `controlAnimations`.
- `apps/studio/src/main.ts` currently denies every Electron permission. Its `trusted` check already requires an owned window, the sender's main frame, and the generated Studio page URL.
- LUX-150 will add `apps/studio/src/visual-model.ts`; its reviewed API will provide guarded flat or graph control lookup while preserving `{nodePath, definitionHash, schemaHash, controlId}`. LUX-150 currently owns `ParameterInspector.tsx`.

The provider and analyzer foundation can be implemented in new `apps/studio/src/audio/` files without changing these shared owners. Schema, runtime transport, persistence, and UI integration wait for the root code gate.

## Binding and persisted source

Keep the current LFO object exact. Add a separately validated audio variant to the same one-binding-per-target collection:

```ts
type AudioBand = 'level' | 'bass' | 'mids' | 'highs';

type AudioAnalyzerConfig = Readonly<{
  version: 1;
  fftSize: 2048;
  minDecibels: number;
  maxDecibels: number;
}>;

type AudioControlBinding = Readonly<{
  kind: 'audio';
  nodePath: NodePath;
  definitionHash: string;
  schemaHash: string;
  controlId: string;
  source: Readonly<{
    kind: 'audio-band';
    logicalInputId: string;
    band: AudioBand;
    analyzer: AudioAnalyzerConfig;
  }>;
  amount: number;
  attackMs: number;
  releaseMs: number;
  enabled: boolean;
}>;
```

The first slice accepts the single literal logical input ID `primary-audio`. `fftSize` is exactly `2048`. `minDecibels` is finite in `[-120, -40]`; `maxDecibels` is finite in `[-80, 0]`; and `maxDecibels - minDecibels` is at least `10`. The analyzer always sets `smoothingTimeConstant` to `0`; binding attack and release are the only smoothing owners. Source records are strict plain data with no extra fields.

`logicalInputId` and analyzer settings are portable scene data. The physical `deviceId` is a profile-local preference and never enters a scene, worker message, binding, diagnostic, or screenshot. Repeating the same logical input and analyzer settings in each binding avoids a new scene-level source graph. Every admitted scene has at most one active audio configuration. Bass and Highs must name that exact configuration and share its one analyzer. A valid binding with a different configuration remains persisted but unavailable with a specific issue; normalization never retargets it.

Legacy LFO records retain their exact fields, ranges, error behavior, identity guards, timing continuity, and save format. The union validator rejects mixed duplicate targets. An unavailable or incompatible audio target remains stored and disabled with a specific issue instead of being retargeted.

## Provider and analyzer

New Studio-owned modules expose a narrow injected interface:

```ts
type AudioBandSnapshot = Readonly<{
  generation: number;
  sequence: number;
  available: boolean;
  level: number;
  bass: number;
  mids: number;
  highs: number;
}>;

type AudioInputConfiguration = Readonly<{
  logicalInputId: 'primary-audio';
  analyzer: AudioAnalyzerConfig;
}>;

type StudioAudioProvider = Readonly<{
  connect(input: AudioInputConfiguration, localDeviceId?: string): Promise<void>;
  disconnect(): Promise<void>;
  getSnapshot(): AudioBandSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): Promise<void>;
}>;
```

`localDeviceId`, when supplied, is a nonempty string of at most 512 UTF-16 code units. It is validated only at the capture boundary and is never copied into portable data.

The provider owns exactly one active `{logicalInputId, analyzer, localDeviceId}` configuration. It has no keyed registry. An explicit `connect` acquires the `MediaStream`, `AudioContext`, `MediaStreamAudioSourceNode`, and `AnalyserNode`. A repeated connect to the exact active configuration is a no-op. An explicit connect to a different configuration cleans up the old capture before it requests the new one. `disconnect` and `dispose` own cleanup. Subscriptions only start and stop animation-frame sampling of an already connected analyzer; subscribing never acquires a device, and removing the last subscriber never releases it.

Each `connect`, `disconnect`, or `dispose` increments an operation generation. Every asynchronous completion checks that generation before publishing or installing resources. A stale stream immediately stops its tracks. A stale context closes. A stale animation callback cannot publish. Cleanup is idempotent.

The analyzer uses an FFT size of 2048 and forces Web Audio smoothing to zero. It derives Level from time-domain RMS and derives Bass, Mids, and Highs from RMS frequency magnitudes over fixed ranges of 20-250 Hz, 250-2000 Hz, and 2000 Hz to Nyquist. Each frequency-bin decibel value converts to linear amplitude. The configured minimum maps to zero, the configured maximum maps to one, and intermediate amplitudes normalize across that linear range before the band RMS. Attack and release do not occur in the analyzer; each binding owns its smoothing response.

An unexpected track `ended` event or failed/closed audio context increments the operation generation, publishes one unavailable all-zero snapshot, and performs the same idempotent owned cleanup as disconnect. Capture remains disconnected until another explicit Connect action.

## Permission boundary

One audio permission broker is installed once on the Electron `Session`; it is not reinstalled by `createWindow`. It coordinates the preload bridge and the session permission handlers.

An explicit click on Connect calls the preload port to create a fresh arm for the current main Studio `webContents`. The arm has a five-second monotonic deadline. The renderer then calls `getUserMedia` with `video: false` and the local selected device constraint. The first permission request attempt consumes the arm whether it is allowed or denied. A request is allowed only when all conditions hold:

- the `webContents` is the current main Studio window;
- the requesting document is the exact generated Studio page and security origin;
- `isMainFrame` is true;
- the permission is `media` and the request contains audio only;
- the fresh arm is unexpired and has not been consumed by another request attempt.

During the one allowed attempt, exact matching permission checks may pass. After renderer acquisition succeeds, a token-matched activation marks the capture active. Active state may satisfy exact checks for that capture, but it never authorizes a second permission request; every new request needs another explicit fresh arm. Renderer failure calls token-matched cancel. Expiry, navigation, renderer process loss, main-window close, explicit disconnect, and app quit revoke the arm and active state. Subframes, preview windows, null `webContents` checks, workers or service workers, other pages, video, unknown media types, and every unrelated permission remain denied. The current blanket-deny behavior remains the fallback.

The selected physical device ID lives only in profile-scoped renderer preferences. Device enumeration occurs only after an explicit successful audio permission flow. Labels and IDs are not persisted in scenes.

## Runtime transport and modulation

The Studio shell samples only while the connected analyzer has subscribers. It publishes one bounded snapshot per animation frame at most. `StandaloneClient` forwards snapshots to every active accepted or replacement visual worker. Each message carries the runtime `instanceId`, runtime `generation`, provider `generation`, and increasing sample `sequence`.

Each worker transport permits one in-flight audio snapshot and one coalesced latest snapshot. A new provider snapshot overwrites the queued latest value while an acknowledgement is outstanding. The visual worker accepts only matching runtime identity and a newer provider generation or a strictly newer sequence in the same generation, updates its target cache, and acknowledges without drawing. The client sends the coalesced latest value after the matching acknowledgement. Candidate initialization includes the latest bounded snapshot. A stalled worker therefore retains at most two snapshots and cannot create an unbounded message queue. Stale acknowledgements, provider samples, and replacement messages cannot affect a promoted runtime. Audio messages never trigger a render, enter `RuntimeView`, affect edit signatures or persistence, enter `composition-profile.mjs`, or become image graph nodes.

The existing control-animation evaluator remains the single owner of effective control values. For an enabled audio binding it:

1. reads the latest selected normalized band or uses zero when unavailable;
2. computes `deltaMs = clamp((frameTimeSeconds - priorFrameTimeSeconds) * 1000, 0, 60000)` on rendered scene frames;
3. selects `tauMs = attackMs` while the target is above the filtered value and `releaseMs` otherwise;
4. uses the target immediately when `tauMs` is zero, else applies `alpha = -expm1(-deltaMs / tauMs)` and `filtered += (target - filtered) * alpha`;
5. computes `manualBase + amount * filtered`;
6. clamps with the target control definition.

`attackMs` and `releaseMs` are finite integers in `[0, 60000]`. Changing the manual control changes the base immediately without resetting the filter. Pause produces no advancing scene frames, so the filtered contribution freezes. Disconnect while paused replaces the cached target with zero; release begins on resumed rendered frames. Playback reset clears the filtered contribution to zero and resets its frame-time anchor. A newer provider generation resets accepted sample sequence and the target cache, but retains the current filtered contribution so disconnect and reconnect remain smooth. Older generations and non-increasing sequences are ignored. Disconnect publishes unavailable/zero before resources close, so every running contribution approaches zero with release and the manual base remains.

## UI and ownership

The first UI adds a compact Studio-level audio input selector and status outside `ParameterInspector`. It offers Connect, Disconnect, and the available local input choices after permission. It reports denied, unavailable, connected, and disconnected states without exposing device IDs.

The binding editor adds Audio beside the existing LFO choice and reuses the row's target identity and save operation. Its fields are band, amount, attack, and release. LUX-150 owns the current `ParameterInspector` edit; this slice supplies the binding contract and editor component, and integrates only after LUX-150's reviewed commit and the root ownership gate.

## Verification

Test-first CPU coverage will prove:

- every legacy LFO record still round-trips exactly and malformed legacy records remain rejected;
- audio admission is strict, duplicate targets across variants fail, and incompatible target hashes remain disabled with an issue;
- deterministic time and frequency fixtures produce independent Level, Bass, Mids, and Highs values;
- two bindings with one source configuration share one analyzer and cleanup occurs once;
- stale acquisition and animation completions stop or close their resources and cannot publish;
- the Electron allow/deny matrix enforces main-window, top-frame, exact-page, audio-only, explicit-arm behavior;
- attack and release use deterministic elapsed time, manual base edits remain live, and disconnect converges to base;
- one stalled worker retains one in-flight and one latest snapshot, acknowledgements drain the latest value, and audio traffic causes no draw;
- save/reopen retains logical input, analyzer settings, binding settings, and target identity while excluding device ID;
- failed runtime replacement retains the accepted preview and current audio behavior.

Fixture tests establish deterministic logic only. Actual input, Studio interaction, screenshots, save/reopen, failed replacement, and disconnect require the isolated Studio reservation. They remain separate from CPU evidence.
