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

`discover` reads local adapter-checkout files and can succeed with Studio closed. It does not attest to the open app's build. Even the launching checkout can have changed since its last build. Pair the adapter with known launch/build evidence and actual `read`/`status`/operation results; when they disagree, preserve the source and report or investigate the version mismatch. A newer worktree's discovery does not upgrade the running app.

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
    { timeout: 75000 }
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

## Current tool shapes

Read live tool schemas if available; these are the checked adapter's contracts. All tool names below have the `lux.studio.` prefix.

| Tool | Arguments and result |
| --- | --- |
| `discover` | `{}` → adapter-checkout SDK source, example, shared types, imports, declared capabilities. No running-app handshake; can succeed with Studio closed. |
| `read` | `{}` → `{ source, draftVersion, ..., status }`. Complete source; don't truncate assets/files when storing it for an edit. |
| `build` | `{ expectedDraftVersion, source, libraryLinks?: [{ componentId, mountPath }] }` → `{ draftVersion, status }` after resolving linked component source and candidate promotion. The accepted candidate starts playing by default. A later explicit Pause during the operation wins before promotion. This is a complete replacement. Preserve current links from `read.libraryLinks` unless the requested edit changes them. |
| `save` | `{ path, expectedDraftVersion, overwrite?: false }` → saved scene name/token. `path` is an absolute `.lux-scene` path. Existing targets require explicit `overwrite: true`; no-overwrite uses exclusive creation and retains external-change protection. The saved document includes current controls and control animations. |
| `open` | `{ path, expectedDraftVersion, discardDirty?: false }` → opened scene name/token. `path` is an absolute `.lux-scene` path. Dirty source, controls, or library links require `discardDirty: true`. Invalid reads or failed candidate activation retain the existing draft and preview. |
| `status` | `{}` → snapshot containing `authoring`, which is null before a working runtime exists. |
| `capture` | `{}` → PNG image block plus JSON metadata. Captures the current completed frame; it does not advance paused playback. Agent results retain the 8 MiB encoded limit. |
| `playback` | `{ instanceId, expectedGeneration, action: 'play' | 'pause' | 'reset' }` → `{ applied, status }`. Reset preserves playing/paused state. |
| `parameters` | `{ instanceId, expectedGeneration, expectedRevisionId, expectedControlSchemaHash, values: { spikeHeight: 0.5 }, mode: 'live' }` → `{ applied, status }`. Use actual runtime `controlSchema` IDs/ranges and `controlSchemaHash`; the patch can change several keys atomically. Unknown keys and stale schemas are rejected. |
| `restart` | `{ instanceId, expectedGeneration }` → replacement runtime status; source and controls retained. Use for recovery when needed, not every edit. |

Discovery can also expose local tools with the `lux.library.` prefix. `list {}` returns stable IDs, names, descriptions, and revisions. `read { id }` returns the complete current SDK 0.4 component source. The first connected path accepts zero-input image-source components. `create { name, description, source }` validates and builds the candidate before explicitly adding revision 1 to the shared standard library. `update { id, expectedRevision, name, description, source }` validates a complete replacement and rejects a stale expected revision. An invalid candidate or revision conflict leaves the prior library revision active. Ordinary `build`, `save`, source editing, and control changes never publish scene source to the library.

The Library panel is read-only for source. It lists the repository-shared standard entries, opens their source files, and shows the active storage path. An installed app made from the repository uses that same marked path when available; **Standalone fallback** identifies the app-data store used when the recorded repository is absent. Copying an agent request does not message an agent or insert source. A linked scene stores the last resolved revision and mounted source as an explicit fallback. Reopen resolves the latest library revision; if it fails to build, Studio keeps the saved working preview and reports the fallback. A running scene reports newer revisions and waits for Apply update. Fork copies the mounted source into the scene and unlinks that component.

Obtain `instanceId`, `generation`, `revisionId`, and `playback` from `status.authoring` (or a tool response's `status.authoring`). Map `generation` to `expectedGeneration` and `revisionId` to `expectedRevisionId`; do not invent them. Restart replaces the generation, so refresh guards afterward. For rejected stale guards, reread state and reconsider the action instead of forcing it against an unrelated runtime.

For source edits, `structuredClone(current.source)` is a useful starting point. Modify only the intended entries in `.files`; preserve the remaining bundle. A complete-source build is atomic and version guarded. Typing through Playwright or streaming characters into the user's editor has different concurrency behavior and is not the creation path; token-by-token edit visualization is not exposed by the checked MCP API.

Current tools do not expose export, resolution changes or audio inputs. Numeric visual-defined controls are available; color/Boolean/enum controls are not yet supported. Do not claim a tool result performed those actions. Inspect updated discovery for newer capabilities before concluding they remain unavailable.

## Editor and scene commands

In the Source editor, Ctrl/Cmd+S builds and applies the complete edited source bundle to preview; it does not save a single file or the scene to disk. Studio automatically builds and plays the initial visual on normal startup. Successful later Build and scene Open operations start playback. While a Build compiles and initializes in the background, the previous preview remains visible and its controls and animations accept edits; the candidate receives the latest compatible acknowledged state before promotion. A Pause issued after the operation begins takes precedence, and an invalid candidate leaves the previous preview and edits intact. Ctrl/Cmd+Shift+S saves the scene. File Save and Save as remain explicit protected scene commands. Ctrl/Cmd+F opens editor search; shortcut hints are not permanently displayed. MCP `build` still performs the same complete-source replacement and is the supported agent edit path.

The Source panel's Import images, selected-image Replace and Remove commands change the draft; Build explicitly applies it. PNG/JPEG/BMP source assets also work in an offline Resolume export when the running app reports `assetExport: true`. File Export packages the scene's original image bytes and required runtime for offline playback. This is a UI workflow, not a new MCP export tool; creating a package does not install/register it or prove its behavior in Resolume. See [image assets](image-assets.md) before editing asset records.

The File, View, and Preview menus appear in that order. The Preview menu and the Preview panel header share the same capture state: use the camera button to save the current completed output as a straight-alpha PNG, and use the record/stop button to save a video. Buttons have accessible labels and tooltips; recording and finishing state remain visible while the recorder completes. UI file saves accept the selected output through 3840×2160 and a bounded 40 MiB encoded PNG; the agent tool retains its separate 8 MiB encoded-result limit and directs larger output to the Preview UI. **Record video** asks for a `.webm` destination and records the presentation canvas at its selected output width and height, independent of Preview panel size, docking, display scaling, or fullscreen. Studio prefers VP9 WebM, falls back to VP8 or baseline WebM when the running Electron codec reports support, and writes bounded chunks to a temporary file before committing the chosen destination. **Stop recording** finalizes a finite-duration, seekable clip. A runtime or resolution replacement also stops and finalizes the fixed-size clip. Encoder, disk, or shutdown failures cancel the temporary file and leave an existing destination unchanged. Preview capture has no MCP save-to-disk or video-recording tool in this build.

### Saved looks in Studio

Use File → Looks… to save and recall a named working preview. A look includes the accepted source and assets, control values, control animation bindings, and preview resolution. Build edits before saving them in a look. Save as new creates a separate look; Update explicitly replaces the selected look. Loading confirms dirty work and retains the previous source and preview if activation fails. Library source is frozen in each look. Looks are profile-local; no dedicated Looks MCP command is shipped. Do not claim that an agent saved a look unless the actual UI operation succeeded.

Studio does not impose a fixed control-count ceiling. Discovery reports `maxParameterMetadataBytes` for schema metadata. The current native Resolume plug-in transport still accepts at most 32 exposed controls; export reports that compatibility limit explicitly without restricting Studio editing, animation, scene saves, or Preview capture.
