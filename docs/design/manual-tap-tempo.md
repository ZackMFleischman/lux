# Manual and tap tempo design

LUX-153 adds one Studio tempo clock for deliberate musical timing. It does not infer tempo from audio and does not add Resolume host or export behavior.

## User result

The Studio transport shows a BPM field and a **Tap** button. A numeric control's existing **Animate** editor can select **Tempo**, choose a waveform and a cycle length in beats, and set amount and phase. Play, pause and reset affect the visual and tempo modulation together. A scene save retains the BPM, binding, manual base value and target identity.

The native demonstration uses the normal window and a 640 x 360 preview. One control runs a one-beat sine modulation. Changing 60 BPM to 120 BPM visibly doubles its rate. Four steady taps update BPM and align the beat. Pause freezes the value. Resume continues it. Reset returns beat phase to zero without changing BPM. A manual base edit remains effective under modulation. Save and reopen restore the BPM, binding and base, with a fresh beat phase of zero. An invalid source build leaves the last working preview, BPM, phase, binding and base unchanged.

## Persisted contracts

Add a strict tempo settings record:

```ts
type SceneTempoSettings = Readonly<{ bpm: number }>;
```

`bpm` is finite and ranges from 20 through 300. The default is 120. Scene versions 1 through 5 accept an optional top-level `tempo` field as input. `validateSceneDocument` normalizes a missing field into `{bpm: 120}` in the returned document. `createSceneDocument`, `acceptedDocument` and every subsequent save always emit the normalized `tempo` field. This is an additive migration and does not rewrite source, control snapshots, library links or scene versions. Tap history, sampled beat phase and clock anchors are runtime state and are never saved.

Add a third control-animation variant beside LFO and audio:

```ts
type TempoControlAnimationBinding = Readonly<{
  kind: 'tempo';
  nodePath: NodePath;
  definitionHash: string;
  schemaHash: string;
  controlId: string;
  shape: 'sine' | 'triangle' | 'saw' | 'square';
  beatsPerCycle: number;
  amount: number;
  phase: number;
  enabled: boolean;
}>;
```

`beatsPerCycle` is finite from 0.25 through 64 and defaults to 1 in the editor. `phase` is the existing normalized cycle offset from 0 through 1 and defaults to 0. `amount` keeps the existing nonnegative rule and editor default derived from the control range. Target identity, duplicate detection, issue retention and schema guards are unchanged. The audio and kick variants keep their own fields and behavior.

For a compatible enabled binding:

```text
cycle = modulo(beatPosition / beatsPerCycle + phase, 1)
effective = clamp(base + amount * waveform(shape, cycle), min, max)
```

This reuses the current waveform, amount and final clamp behavior. It never replaces or quantizes the saved manual base.

## Clock and tap semantics

One worker-owned tempo clock derives beat position from the existing `RuntimeClock.timeSeconds`. It creates no timer and performs no frame scheduling. Its state is `{bpm, anchorTimeSeconds, anchorBeat}`.

```text
beatPosition = anchorBeat + (timeSeconds - anchorTimeSeconds) * bpm / 60
beatPhase = modulo(beatPosition, 1)
```

Changing BPM manually snapshots the current beat position into the anchor before changing BPM. This keeps phase continuous. Play and pause already advance or freeze `timeSeconds`, so every tempo binding advances or freezes with the rendered visual. Reset keeps BPM, clears tap history, and sets the anchor to beat zero at reset time zero.

Tap interval measurement uses the worker's injected monotonic millisecond source, which continues while playback is paused. It does not use wall-clock time and does not schedule work. The first accepted tap starts a sequence, sets the shared anchor to beat zero at the current visual time, and leaves BPM unchanged. Later intervals from 200 through 2000 milliseconds are accepted. The clock keeps at most the four most recent accepted intervals and sets BPM to `60000 / mean(intervals)`. Every accepted tap reanchors beat zero. An interval shorter than 200 milliseconds is ignored without changing phase or history. An interval longer than 2000 milliseconds clears prior intervals and becomes a new first tap; it reanchors beat zero but leaves BPM unchanged. Nonfinite or backward monotonic samples fail before state changes.

Tapping while paused is supported. Valid tap intervals can update BPM, and each accepted tap leaves frozen beat phase at zero. Resume advances from that zero phase. A fresh runtime, successful rebuild, restart, or scene reopen starts beat zero with the retained BPM. No per-binding restart anchor is created; all tempo bindings share the same beat. The per-binding `phase` remains its saved offset.

## Runtime operations and ownership

Add guarded `lux.tempo.set` and `lux.tempo.tap` operations. Both carry `requestId`, `instanceId`, `expectedGeneration` and `expectedRevisionId`. `lux.tempo.set` also carries `bpm`. The worker owns admitted tempo state and returns `tempo: {bpm, beatPhase}` plus a monotonic `tempoSequence` in ready and status messages. Persisted `tempo.bpm` is part of `runtimeEditSignature`, control-edit tracking and unsaved-change detection. Sampled `beatPhase`, anchors and tap history are view or runtime data and are excluded from dirty-state and persistence signatures.

`tempoSequence` increments for every admitted tempo command, including a same-BPM set and an ignored short tap. Invalid, stale, wrong-generation and wrong-revision commands do not increment it. A set acknowledgement reports `tempoResult: 'applied' | 'same-bpm'`. A tap acknowledgement reports `tempoResult: 'accepted' | 'restarted' | 'ignored-short'`: **accepted** means a 200-2000 ms interval updated the mean and BPM; **restarted** means a first tap or long gap began a new interval sequence and rephased beat zero without changing BPM; **ignored-short** means an interval below 200 ms changed no tempo state except the acknowledgement sequence. An ignored short tap does not advance the prior accepted-tap timestamp, alter interval history or rephase the beat. These results let guarded UI, agent and test callers distinguish an admitted no-op from a lost or stale command.

The standalone client applies the same acknowledgement and sequence checks used for control animations. Duplicate, stale, wrong-generation and wrong-revision operations cannot mutate state. Tempo edits remain usable during a background Build, like controls and animations. Each command first applies to the incumbent. The replacement intent records the latest acknowledged BPM. Before promotion, a private candidate synchronization applies that BPM at beat zero and clears candidate tap history; it does not replay incumbent taps or live phase. Promotion waits for admitted tempo writes and this synchronization. A successful build therefore starts fresh phase zero at the latest BPM. Compilation, initialization or rendering failure leaves the incumbent's acknowledged BPM, live phase, bindings, base controls and pixels unchanged.

The Studio controller exposes `setTempoBpm(bpm)` and `tapTempo()`. The source session reads the current `{bpm}` when it creates a scene document. Open passes the saved setting into the replacement runtime. Runtime restart and valid rebuild retain BPM and start at beat zero, matching the new runtime's existing LFO restart behavior.

The local authoring bridge accepts methods `tempo.set` with `{instanceId, expectedGeneration, expectedRevisionId, bpm}` and `tempo.tap` with `{instanceId, expectedGeneration, expectedRevisionId}`. `dispatchRuntimeCommand` validates them and maps them to `lux.tempo.set` and `lux.tempo.tap`. The MCP adapter exposes `lux.studio.tempo.set` and `lux.studio.tempo.tap` with the same guarded inputs. They return the acknowledged result and fresh status, as the existing parameter and playback tools do.

The running app raises `studioCapabilities.protocolVersion` from 2 to 3 and adds `tempo: {manual: true, tap: true, bpm: {min: 20, max: 300}}`. Discovery lists both tempo tools but reports support from the connected running Studio capability, not adapter source alone. Each MCP tempo handler reads fresh status and rejects an older running app when protocol version is below 3 or the exact tempo capability is absent. It tells the caller to restart Studio from the matching checkout. The adapter never sends a tempo method optimistically to an older app. This capability says nothing about audio estimation, Resolume host tempo or export support.

## Interface

Place a compact BPM number field and **Tap** button beside the existing playback controls. The field uses the 20-300 bounds and has the accessible name `Tempo BPM`. The button has the accessible name `Tap tempo`. It stays usable while playback is paused. The displayed BPM updates only after an acknowledged manual change or accepted tap.

The control animation editor adds **Tempo** to its source choices. Tempo shows waveform, beats per cycle, amount and phase. LFO continues to show period, amount and phase. Audio and kick keep their existing controls. The tempo editor does not show **Restart animation**, because that would create a private phase; the transport reset and Tap button control the shared phase.

## File boundaries and serial integration

LUX-152 lands first. LUX-153 then rebases and extends its reviewed kick-aware animation union and evaluator. Tempo does not change audio sources, analyzer snapshots, kick detection, sensitivity, retrigger, envelope, attack or release.

- Add `packages/runtime-contracts/src/tempo.mjs` and `tempo.d.mts` for settings validation and types.
- Extend `packages/runtime-contracts/src/control-animation.mjs` and `.d.mts` with the tempo binding.
- Extend `packages/core/src/scene-document.ts` with optional tempo persistence for scene versions 1-5.
- Add `apps/studio/src/controls/tempo-clock.ts` as the deterministic derived clock.
- Extend `apps/studio/src/controls/control-animation.mjs`, both worker control-state adapters and `visual-worker.mjs` to evaluate shared beat position from frame time.
- Extend `apps/studio/src/runtime-operations.ts`, `service-client.ts` and `standalone-client.ts` with guarded tempo operations, acknowledgements, background-build synchronization and status.
- Extend the authoring session and app wiring to save and reopen BPM.
- Extend `apps/studio/src/capabilities.ts`, `agent-bridge.ts` and `scripts/studio-mcp.mjs` with protocol-versioned manual/tap discovery and dispatch. Update the Copilot mutation allowlist for the two MCP tools.
- Extend the transport UI and `ParameterInspector.tsx` only after the reviewed LUX-152 shared-file handoff.
- Update the shipped visual-creation skill because Tempo becomes an author-visible control-animation option. The coordinator owns installation and check after integration.

## Verification

Pure tests inject visual seconds and monotonic tap milliseconds. They cover bounds, mean-window eviction, short-tap ignore without timestamp advance, long-gap restart, paused tapping, manual phase continuity, reset, every acknowledgement result, all waveforms, beats-per-cycle and clamp behavior. Contract tests cover strict fields, duplicate target identity, incompatible target retention and normalized tempo on scene versions 1-5 with and without an input field. Runtime tests cover acknowledgement guards and sequences, dirty detection, save/reopen, concurrent tempo edits during replacement, latest-BPM candidate synchronization, restart, invalid build preservation and fresh phase zero. Agent and MCP tests cover both method schemas, protocol 3 discovery and older-running-app rejection. UI tests cover keyboard entry, Tap, source-specific fields, accessible names and dirty state. Independent source and UI review precede the serialized native demonstration. No test or demonstration may claim audio tempo inference, Resolume tempo, export parity, LUX-7 recovery or LUX-59 provenance.
