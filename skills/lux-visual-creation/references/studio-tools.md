# Connect and operate Studio

## Connection

Use configured `lux.studio.*` tools when discovery confirms the intended profile and checkout. Tool search can discover a configured server; absence of those tools does not prove Lux lacks an adapter. For the user creative workflow, **start-lux** supplies either the installed app runtime or the selected branch checkout and its isolated profile; a configured development adapter is a different target. The desktop installation record is `%LOCALAPPDATA%/Programs/Lux/installation.json`. Its bundled Node can run `<workspace>/scripts/studio-desktop.mjs --status` to report live connection details, or `--start` when opening the app is requested. Use its returned MCP command; no port configuration is needed.

For a local coding agent with terminal access, locate the Lux checkout/build used to launch the current Studio. Use known launch context or inspect its process command line when needed; do not ask the user to reconfirm a path already established. Check that checkout for `scripts/studio-mcp.mjs`; do not assume a particular username, drive, or `.worktrees/tracer` directory exists. Launch that **adapter only**, with the project's installed Node version and dependencies:

```text
command: <absolute path to Node executable>
args: [<absolute Lux checkout>/scripts/studio-mcp.mjs]
cwd: <absolute Lux checkout>
env: { LUX_STUDIO_PROFILE: "<profile returned by start-lux>", LUX_STUDIO_SESSION_ID: "<known live session ID, when available>" }
transport: stdio
```

The checked project pins Node 24.12.0. Studio and its adapter must use the same `LUX_STUDIO_PROFILE` and checkout. Without an explicit profile, both derive `worktree-<hash>` from the physical checkout path. On Windows each profile owns `%APPDATA%/Lux/Studio/profiles/<profile>/agent-endpoint.json`, application data and the single-instance lock. The old shared endpoint is not used or migrated. Tests always generate a fresh `test-*` profile, even when launched from a creative environment. Keep tokens private; never hand-edit an endpoint or copy it to another host.

The adapter checks endpoint profile/checkout identity and binds to one process lifetime. It rejects endpoint replacement rather than following another Studio. A new temporary adapter must receive the previously selected `LUX_STUDIO_SESSION_ID`; reconnect to a replacement only after checking the intended new instance. `discover.runningStudio.studioSession` and live `status.studioSession` expose profile, checkout, session ID and PID without credentials. A remote/cloud agent cannot reach this local session merely by knowing its checkout path. If Studio is unavailable, use **start-lux** when startup was requested; do not select a test app or unrelated profile as a workaround.

Local failure logs are available through `status.diagnostics` and `discover.runningStudio.diagnostics`. Read the returned `path` with local filesystem tools; the prior file is `previousPath`. Each profile retains two files of at most 256 KiB under its `logs` directory. Records include timestamps, session/operation IDs, startup/compiler events and runtime faults. Scene requests, source/assets, endpoint credentials and audio device identities are excluded. Compiler diagnostics include logical source file, line/column, code and bounded messages. Code frames, source payloads, credentials, absolute paths and long opaque values are removed from text; local diagnostic explanations are retained. `writable: false` means diagnostics could not be persisted. Desktop `--status` also reports the path when Studio is closed. This describes the matching new build; an older running app may omit diagnostics.

`discover` reads local adapter-checkout files and compact Library manifests, and can succeed with Studio closed. The Library catalog contains names, descriptions, stable IDs, and revisions; component source remains deferred to `lux.library.read`. Discovery does not attest to the open app's build. Even the launching checkout can have changed since its last build. Pair the adapter with known launch/build evidence and actual `read`/`status`/operation results; when they disagree, preserve the source and report or investigate the version mismatch. A newer worktree's discovery does not upgrade the running app.

When no configured MCP client tool is available, a temporary `.mjs` script in the checkout can use the already-installed SDK. This skeleton establishes the connection and reads context; extend it to perform the authorized visual work. It is not necessary to persistently change Codex configuration.

```js
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve } from 'node:path';

const client = new Client({ name: 'lux-visual-creator', version: '1.0.0' });
const selectedSessionId = process.env.LUX_STUDIO_SESSION_ID; // Retain the previous live ID across temporary clients.
const call = async (name, args = {}) => {
  const result = await client.callTool(
    { name: `lux.studio.${name}`, arguments: args }, undefined,
    { timeout: 270000 } // A build with many large images can take minutes; Studio bounds each operation at 240 s.
  );
  if (result.isError) throw new Error(JSON.stringify(result.content));
  return result;
};
const json = result => JSON.parse(result.content.find(x => x.type === 'text').text);
try {
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [resolve('scripts/studio-mcp.mjs')], cwd: process.cwd(),
    env: { ...process.env, LUX_STUDIO_PROFILE: process.env.LUX_STUDIO_PROFILE,
      // Omit only for the initial read when no live session has been selected.
      ...(selectedSessionId ? { LUX_STUDIO_SESSION_ID: selectedSessionId } : {}) }
  }));
  const discovery = json(await call('discover'));
  const current = json(await call('read'));
  // Inspect discovery and current; derive the authorized replacement from current.source.
} finally {
  await client.close(); // closes this adapter connection, not the Studio window
}
```

Run from the verified checkout with its installed Node. Keep a script outside the repo if preferred, resolving SDK imports against the checkout explicitly; merely changing cwd does not change ESM package resolution for a script elsewhere. For captures, retain the `image` content block and display it through the agent's image tool, or write its decoded PNG to an artifact and inspect that image. Text-only JSON output is not visual inspection.

Launchers accept `--open <absolute or relative .lux-scene path>`: `node scripts/studio-creative.mjs --open <scene>` and `studio-desktop.mjs --start --open <scene>`. The scene opens right after start or reuse. A dirty draft is not discarded. On failure the current draft and preview are kept.

## Current tool shapes

Read live tool schemas if available; these are the checked adapter's contracts. All tool names below have the `lux.studio.` prefix.

| Tool | Arguments and result |
| --- | --- |
| `discover` | `{}` → adapter-checkout SDK source, example, shared types, imports, declared capabilities, and compact Library catalog without component source. No running-app handshake; can succeed with Studio closed. |
| `read` | `{}` → `{ source, document, draftVersion, ..., status }`. For Scene versions 1–6, `source` is the complete source bundle and `document` is null. For Scene 7, `document` is the complete authoritative multi-visual scene and `source` is only the selected editor view. |
| `build` | Exactly one of `{ expectedDraftVersion, source, libraryLinks?, story? }` or `{ expectedDraftVersion, document }` → `{ draftVersion, status }` after candidate promotion. The first form replaces one complete source bundle. The second replaces one complete Scene 7 document and cannot include source, libraryLinks, or Story v1 siblings. The accepted candidate starts playing by default. A later explicit Pause during the operation wins before promotion. |
| `save` | `{ path, expectedDraftVersion, overwrite?: false }` → saved scene name/token. `path` is an absolute `.lux-scene` path. Existing targets require explicit `overwrite: true`; no-overwrite uses exclusive creation and retains external-change protection. The saved document includes current controls and control animations. |
| `open` | `{ path, expectedDraftVersion, discardDirty?: false }` → opened scene name/token. `path` is an absolute `.lux-scene` path. Dirty source, controls, or library links require `discardDirty: true`. Invalid reads or failed candidate activation retain the existing draft and preview. |
| `status` | `{}` → snapshot containing `authoring`, which is null before a working runtime exists. |
| `capture` | `{}` → PNG image block plus JSON metadata. Captures the current completed frame; it does not advance paused playback. Agent results retain the 8 MiB encoded limit. |
| `playback` | `{ instanceId, expectedGeneration, action: 'play' | 'pause' | 'reset' }` → `{ applied, status }`. Reset preserves playing/paused state. |
| `tempo.set` | `{ instanceId, expectedGeneration, expectedRevisionId, bpm }` → acknowledged runtime state. BPM is 20–300; manual changes preserve current beat phase. Requires running Studio protocol 3 tempo capability. |
| `tempo.tap` | `{ instanceId, expectedGeneration, expectedRevisionId }` → acknowledged runtime state with `tempoResult: 'accepted' | 'restarted' | 'ignored-short'`. Requires running Studio protocol 3 tempo capability. |
| `parameters` | `{ instanceId, expectedGeneration, expectedRevisionId, expectedControlSchemaHash, values: { spikeHeight: 0.5 }, mode: 'live' }` → `{ applied, status }`. Use actual runtime `controlSchema` IDs/ranges and `controlSchemaHash`; the patch can change several keys atomically. Unknown keys and stale schemas are rejected. |
| `trigger` | `{ instanceId, expectedGeneration, expectedRevisionId, expectedControlSchemaHash, controlId, commandId, nodePath? }` → `{ applied, status }` with a completed-frame trigger receipt. Requires running `controlTriggers` capability. Use a fresh command ID per intentional action; retry uncertainty with the same ID and guards. Optional nodePath addresses an instance. |
| `animation` | `{ instanceId, expectedGeneration, expectedRevisionId, expectedControlSchemaHash, visualId?, nodePath, controlId, animation, restart? }` returns `{ applied, status }`. Uses existing numeric-control animation bindings: LFO, audio, kick, tempo or variation. Pass `animation: null` to remove. Requires the running app's `capabilities.controlAnimation.guardedBindings`; adapter discovery alone does not upgrade an older app. |
| `variation` | `{ instanceId, expectedGeneration, expectedRevisionId, expectedControlSchemaHash, nodePath, controlId, variation: { amount, distribution: 'random' | 'centered' | 'spread', enabled } | null }` → `{ applied, status }`. Status exposes the admitted `kind: 'variation'` binding in `authoring.controlAnimations`. Use an empty `nodePath` for a direct visual, or the canonical leaf path reported by composition status. Requires `capabilities.controlVariation.stableInstanceKeys`. |
| `restart` | `{ instanceId, expectedGeneration }` → replacement runtime status; source and controls retained. Use for recovery when needed, not every edit. |

Discovery can also expose local tools with the `lux.library.` prefix. The MCP initialization instructions and `discover.libraryCatalog` already contain stable IDs, names, descriptions, and revisions. Reuse that catalog for ordinary edits. `list {}` explicitly refreshes the same metadata after an external change. `read { id, revision? }` returns the authored source and pinned dependencies; omit revision for the current entry. The connected path accepts independent image/paths2d/shader-field leaves and SDK 0.4 compositions with an optional image input. `create { name, description, source, dependencies? }` validates and builds the candidate before explicitly adding revision 1 to the shared standard library. `update { id, expectedRevision, name, description, source, dependencies? }` validates a complete replacement and rejects a stale expected revision. Both mutation responses include a refreshed `libraryCatalog`. An invalid candidate or revision conflict leaves the prior library revision active. Ordinary `build`, `save`, source editing, and control changes never publish scene source to the library.

The Library panel is read-only for source. It lists the repository-shared standard entries, opens their source files, and shows the active storage path. An installed app made from the repository uses that same marked path when available; **Standalone fallback** identifies the app-data store used when the recorded repository is absent. Copying an agent request does not message an agent or insert source. A linked scene stores the last resolved revision and mounted source as an explicit fallback. Reopen resolves the latest library revision; if it fails to build, Studio keeps the saved working preview and reports the fallback. A running scene reports newer revisions and waits for Apply update. Fork copies the mounted source into the scene and unlinks that component.

Obtain `instanceId`, `generation`, `revisionId`, and `playback` from `status.authoring` (or a tool response's `status.authoring`). Map `generation` to `expectedGeneration` and `revisionId` to `expectedRevisionId`; do not invent them. Restart replaces the generation, so refresh guards afterward. For rejected stale guards, reread state and reconsider the action instead of forcing it against an unrelated runtime.

Trigger IDs are rows with `type: 'trigger'` in the accepted schema. They have no
entry in parameter values. A command's receipt is returned only after its event
has been consumed by one update and the frame completes. A paused trigger uses
zero delta and stays paused. Duplicate IDs for the same canonical target return
the original receipt; using that ID for another target rejects. Each generation
admits at most 16,384 IDs without eviction. Saturation rejects new commands until
an explicit runtime restart. Reset retains the ledger and never replays actions.
Rebuild/restart changes generation; do not automatically reissue an old action
under new guards. A timeout is uncertain, so retain the command ID for a same-
generation retry. Save/open, Looks and captured values contain no action history.

For a version 1–6 source edit, `structuredClone(current.source)` is a useful starting point. Modify only the intended entries in `.files`; preserve the remaining bundle. For Scene 7, start from `structuredClone(current.document)`, locate the intended row in `document.visuals`, and modify that row's source. Preserve every other visual, saved control cache, control animation, output setting, tempo field, and Story field. Never submit the selected `source` as though it were the whole Scene 7. Both build forms are atomic and version guarded. Legacy source bundles keep their existing source-format size limits. A Scene 7 document is limited to 32 MiB; its local bridge request is limited to 34 MiB. Read JSON has a 52 MiB bound for the document, one selected-source view and runtime metadata; the escaped MCP result is limited to 104 MiB. Typing through Playwright or streaming characters into the user's editor has different concurrency behavior and is not the creation path; token-by-token edit visualization is not exposed by the checked MCP API.

Current tools do not expose export or resolution changes. Number, boolean and enum visual-defined controls are available when reported by the running app parameterKinds capability; color controls are not yet supported. Do not claim a tool result performed those actions. Inspect updated discovery for newer capabilities before concluding they remain unavailable.

Studio's Inspector also supports local audio modulation through **Animate → Add Audio**. The user explicitly connects an input in the audio controls; all bindings share that analyzer and can select Level, Bass, Mids or Highs with independent amount, attack and release. Base control values remain editable. Scene files retain the logical input and binding settings, not device IDs or microphone permission; reopening requires an explicit connection. Disconnect before choosing another device; changing the shared analyzer configuration also disconnects the current input. Disconnect releases modulation back to the manual base. MCP can edit these bindings through `lux.studio.animation` when the running capability is present. With explicit user authorization and `capabilities.audioInputControl`, list `lux.studio.audio.inputs`, choose an exact current device ID, then call `lux.studio.audio.connect({ localDeviceId, configuration: { logicalInputId: 'primary-audio', analyzer } })`. Physical inputs reuse Studio's existing capture and permission flow. For reactive testing without music, select the listed **Test rhythm** input (`lux:test-rhythm`); it creates a local eight-second PCM loop with kicks, hats and changing tones through the same analyzer, spectrum and kick detector. It needs no microphone/capture permission and remains silent unless the user enables **Monitor** in Studio. `lux.studio.audio.disconnect({})` releases capture. `status.audioInput` reports availability and current band samples without device IDs or raw audio. Kick detection drives transient envelopes only. Manual/tap tempo is separate and never inferred from audio.

For a direct visual, read `status.authoring` and copy its `instanceId`, `generation`, `revisionId` and `controlSchemaHash` into the operation guards. Choose a numeric `controlId` from its schema; use `nodePath: []` and the root schema hash for both binding hashes. Composition targets use the canonical leaf path, definitionHash and schemaHash from `authoring.nodeControls.nodes`; use that leaf schemaHash for `expectedControlSchemaHash`. Scene v7 targets also require `visualId` and the selected root schema hashes from `authoring.visualStates`.

```js
// s = current status.authoring; choose a discovered numeric control.
const controlId = 'speed';
const analyzer = { version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 };
const input = {
  instanceId: s.instanceId, expectedGeneration: s.generation,
  expectedRevisionId: s.revisionId, expectedControlSchemaHash: s.controlSchemaHash,
  nodePath: [], controlId,
  animation: {
    kind: 'audio', nodePath: [], definitionHash: s.controlSchemaHash,
    schemaHash: s.controlSchemaHash, controlId, amount: 0.5, enabled: true,
    source: { kind: 'audio-band', logicalInputId: 'primary-audio', band: 'bass', analyzer },
    attackMs: 20, releaseMs: 200,
  },
};
```

Reuse the analyzer settings of an existing audio/kick binding if present; the example uses Studio's default analyzer. Changing those settings disconnects the input. Bands are `level`, `bass`, `mids`, or `highs`. Amount is a nonnegative peak offset from the base; attack/release are integer milliseconds 0-60000. A kick binding uses `kind: 'kick'`, `source: { kind: 'audio-kick', logicalInputId: 'primary-audio', analyzer }`, and adds `sensitivity` (0-1), `retriggerMs` (integer 0-2000), and `envelope` (`linear` or `exponential`). Pass the same guards and `animation: null` to remove. Bindings work with any numeric visual control; they add no audio input to the visual SDK. Physical connection is separate and requires explicit audio.connect.

A scene can link one **soundtrack** (a local MP3, WAV, OGG, M4A, AAC or FLAC file) from the transport-row Soundtrack control. It plays with Play, pauses with Pause, restarts with Reset, and follows the scene clock across rebuilds, re-seeking when drift exceeds 50 ms. The scene file stores a relative and an absolute path, a sha256, `offsetSeconds` (song position at scene time 0) and `volume`; it never stores audio bytes. Files up to 200 MiB that decode to at most 20 minutes and 1.5 GB of PCM are accepted. A missing, unreadable or changed file leaves the scene working and shows one combined relink warning. `status.soundtrack` (null when none) reports the file name, `state` (`loading`, `loaded`, `unavailable` or `error`), offset, volume, session mute, `playing`, `positionSeconds` and `driftSeconds`. It is read-only: no MCP tool links, changes or removes a soundtrack. Loading a Look removes the soundtrack. In Story scenes the song follows the global scene clock; Story beat seek, replay and loop do not move it. Visuals do not receive the soundtrack as an input; use **Animate → Add Audio** with an audio input for audio-reactive controls.

## Editor and scene commands

In the Source editor, Ctrl/Cmd+Enter builds and applies the complete edited source bundle to preview. Ctrl/Cmd+S saves the scene and Ctrl/Cmd+Shift+S opens Save as, including while focus is in Source. Studio automatically builds and plays the initial visual on normal startup. Successful later Build and scene Open operations start playback. While a Build compiles and initializes in the background, the previous preview remains visible and its controls and animations accept edits; the candidate receives the latest compatible acknowledged state before promotion. A Pause issued after the operation begins takes precedence, and an invalid candidate leaves the previous preview and edits intact. File Save and Save as use those same actions. Ctrl/Cmd+F opens editor search. Studio shows shortcut hints beside the matching commands. MCP `build` still performs the same complete-source replacement and is the supported agent edit path.

Ctrl/Cmd+Shift+M maximizes or restores the focused Studio panel, F11 toggles Preview fullscreen, and Ctrl/Cmd+Shift+I toggles Inspector. Panel shortcuts do not replace ordinary text-input behavior. Escape leaves fullscreen first and otherwise restores a maximized workspace with its prior panel focus.

Press ? (Shift+/) outside Source and other text fields to open the keyboard-shortcuts reference. The View menu also opens this reference. Escape closes it and restores focus. A maximized non-Preview panel keeps a visible Restore workspace control with the Ctrl/Cmd+Shift+M hint.

The Source panel's Import images, selected-image Replace and Remove commands change the draft; Build explicitly applies it. PNG/JPEG/BMP source assets also work in an offline Resolume export when the running app reports `assetExport: true`. File Export and Ctrl/Cmd+Shift+E use the same action to package the scene's original image bytes and required runtime for offline playback. An installed build that omits export keeps the command disabled and shows its unavailable reason. This is a UI workflow, not a new MCP export tool; creating a package does not install/register it or prove its behavior in Resolume. See [image assets](image-assets.md) before editing asset records.

The File, View, and Preview menus appear in that order. The Preview menu and the Preview panel header share the same capture state: use the camera button or Ctrl/Cmd+Shift+P to save the current completed output as a straight-alpha PNG, and use the record/stop button or Ctrl/Cmd+Shift+R to save or stop a video. Buttons have accessible labels and tooltips; recording and finishing state remain visible while the recorder completes. UI file saves accept the selected output through 3840×2160 and a bounded 40 MiB encoded PNG; the agent tool retains its separate 8 MiB encoded-result limit and directs larger output to the Preview UI. **Record video** asks for a `.webm` destination and records the presentation canvas at its selected output width and height, independent of Preview panel size, docking, display scaling, or fullscreen. Studio prefers VP9 WebM, falls back to VP8 or baseline WebM when the running Electron codec reports support, and writes bounded chunks to a temporary file before committing the chosen destination. **Stop recording** finalizes a finite-duration, seekable clip. A runtime or resolution replacement also stops and finalizes the fixed-size clip. Encoder, disk, or shutdown failures cancel the temporary file and leave an existing destination unchanged. Preview capture has no MCP save-to-disk or video-recording tool in this build.

### Saved looks in Studio

Use File → Looks… to save and recall a named working preview. A look includes the accepted source and assets, control values, control animation bindings, and preview resolution. Build edits before saving them in a look. Save as new creates a separate look; Update explicitly replaces the selected look. Loading confirms dirty work and retains the previous source and preview if activation fails. Library source is frozen in each look. Looks are profile-local; no dedicated Looks MCP command is shipped. Do not claim that an agent saved a look unless the actual UI operation succeeded.

Studio does not impose a fixed control-count ceiling. Discovery reports `maxParameterMetadataBytes` for schema metadata. The current native Resolume plug-in transport still accepts at most 32 exposed controls; export reports that compatibility limit explicitly without restricting Studio editing, animation, scene saves, or Preview capture.

Library create/update accept optional `dependencies` rows `{componentId, revision, mountPath}`. Library read accepts optional `revision`. Each dependency is pinned, resolved for validation and mounting, and stays a reference in stored composition source. Use independently published image/paths2d/shader-field leaves for generators and renderers.

## Typed parameter edits

Read status for the running app's `parameterKinds`, current `controlSchema`, instance/generation/revision and schema hash. Use the existing `lux.studio.parameters` tool for all persistent types: `values: { speed: 0.8, trails: true, palette: "warm" }`, with the current required guards and `mode: "live"`. Enum values are option IDs, never labels or indices. The authoritative schema rejects incorrect value types, unknown IDs and absent options. Inspect the applied response; a submitted patch is not evidence of a rendered frame. Re-read after a stale guard rather than replaying old intent against an unrelated visual. No tool per switch or option is needed. Source declaration changes still use complete guarded build and scene save/open.

## Offline frames and video (no Studio launch)

For QA strips, contact sheets and videos, use the warm headless render pool instead of launching an isolated Studio per capture:

```text
pnpm render render --src <source dir> --out <frame dir> --times 1,2.5,10        # or --range 0:72.5:24
pnpm render video  --src <source dir> --out clip.mp4 --range 0:72.5:24 --audio song.mp3 [--audio-start 0]
pnpm render status | stop
```

It compiles once per source content (cached), keeps N hidden render windows warm (default 3), renders at exact times with a true seek (no playback, reset or `startAt` tricks) and writes PNGs straight to disk. The pool exits after 20 idle minutes and never touches the user's Studio or profile. Output matches the Studio preview because it runs the same visual worker. Pass public control values with `--controls '{"id":value}'`. Story scenes are not supported offline yet; use Studio for them. This is a terminal workflow; the MCP `capture` tool still captures the live preview.

## Story playback

When the running app reports Story support for SDK0.2 root visuals, use
`lux.story.read` (`status`, `definition`, or `capabilities`) and the single
`lux.story.transport` action DTO. Source builds accept an optional complete
`story` definition: omission preserves it, null removes it. See
[Story playback](story-playback.md) for guards, sustained/manual behavior,
sequence occurrences, timed seeking, return-to-normal examples, and complete
Scene 7 multi-visual document builds.


### Audio spectrum in visual code

When the actual running app reports `capabilities.audioSpectrum` with `bins: 128`, SDK 0.2 visuals and SDK 0.4 component leaves receive optional readonly `frame.audioSpectrum` during `update(frame)`. Its fields are `available`, provider `generation` and `sequence`, `sampleRate`, `fftSize: 2048`, `scale: 'log'`, `minFrequency: 20`, `maxFrequency: sampleRate / 2`, and a frozen `magnitudes` array of exactly 128 numbers from 0 to 1. Each bucket holds the peak normalized linear amplitude from measured FFT bins overlapping its logarithmic interval; normalization uses the connected analyzer's min/max decibels. Low-frequency buckets can share an FFT bin because a 2048-point FFT has finite resolution. This is frequency magnitude data, not raw PCM, phase, a waveform or inferred BPM.

```ts
update(frame) {
  const spectrum = frame.audioSpectrum;
  if (spectrum?.available) {
    // Feed these measured heights to your line/bars or a data texture.
    for (let i = 0; i < spectrum.magnitudes.length; i++) {
      const amplitude = spectrum.magnitudes[i];
      const lowerHz = 20 * Math.pow(spectrum.maxFrequency / 20, i / 128);
      // Update the visual's own preallocated geometry/uniforms here.
    }
  }
}
```

Frames receive immutable snapshots. Stale provider sequences are ignored. Pause holds the last displayed spectrum; disconnect clears it even during a paused explicit draw. Reset supplies one zero frame before live samples resume. With no spectrum input, `available` is false, magnitudes are zero, and `sampleRate`/`maxFrequency` are 0. Older hosts can omit the optional field, so guard it. The same shared input and explicit connection remain in effect; this API requests no new permission, opens no device, and writes no audio samples into scenes. Adapter discovery describes source support; it does not upgrade an older running app. Inspect actual frames and audio status before claiming music response.
