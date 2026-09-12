# Installed export foundation

12 September 2026. Implements storage and integrity for DEC-13/TR-06 on the
working `a5eee83` transport. This is **not** completed Export for Resolume:
source registration, automatic startup, concurrent runtime identities and cold
composition reopen still need implementation and host acceptance.

## Authoring interface

`scripts/export-resolume.mjs` exports:

```js
await exportResolume({ scenePath, name, outputDirectory });
// { path, releaseId, runtimeId }
```

The command line is `node scripts/export-resolume.mjs saved.lux-scene "Name" output`.
Compilation/linking use the existing `prepareTransportScene`; neither generated
visual code nor a GPU process runs during packaging. `preparedPath` and optional
`intensity` permit packaging an already prepared transport release. A prepared
release omits saved controls, so that route defaults to the existing 0.5 unless
the caller supplies them. The scene route preserves `document.controls.intensity`.
`root` selects built payload inputs; `nativeRuntimeDirectory` selects the local
MSVC redistributable DLL directory (defaults to Windows System32).

Require the existing render-host build, native build and Electron installation
on the **authoring** machine. No added npm dependencies or package.json changes.
The transport linked JavaScript already embeds the supported SDK/Three module
closure; this implementation supports that current inline/procedural visual
scope. It does not implement a new external asset resolution pipeline.

## On-disk contract

```text
<export-directory>/<releaseId>/
  install.cmd
  release/release.json
  release/<transportHash>.json
  runtime/runtime.json
  runtime/electron/<entire pinned Electron distribution>
  runtime/apps/render-host/src/{main.cjs,compiled-output.html,compiled-worker.js}
  runtime/native/build/Release/<bridge,probe DLL,app-local MSVC runtime DLLs>
  runtime/tools/gpu-spike/<transport helpers>
  runtime/{install.cjs,package.cjs,transport-release.cjs}
```

`runtime.json`: `format: lux-runtime`, `version: 1`, `platform: win32-x64`, exact
`electronVersion`, `files: [{path, bytes, sha256}]`, `runtimeId`.
`runtimeId` is SHA-256 of `JSON.stringify(body, null, 2) + '\n'` excluding itself.
All relative inventory paths are ASCII, slash-separated, case-unique and reject
absolute paths, traversal, NT device names, alternate streams and trailing dots.
All payload files are hashed, unlisted files are rejected, and required Electron
and native dependencies are checked. Windows itself and the GPU driver remain
platform prerequisites; authoring Node, pnpm, the compiler and repository do not.

`release.json`: `format: lux-resolume-source`, `version: 1`, user-facing `name`,
`runtimeId`, `transportHash`, `sourceHash`, `linkedHash`, output `settings`,
`controls`, `savedControls`, `releaseId`. `controls` reproduces the existing
fixed intensity definition (number, default 0.5, range 0–1, live); `savedControls`
preserves the authored value separately. `releaseId` hashes the remaining fields
using the same JSON serialization. Thus names, saved values, visual changes and
runtime changes create new releases. The content-addressed prepared transport
file is validated with the existing reader, including its linked-code hash.

Hashes detect corruption and changed bytes; they are not publisher signatures
or proof that untrusted executable packages are safe. Validate trusted packages
again before loading them. Byte identity also does not establish native build
provenance or that a modified Electron distribution is supported.

## Installation interface

`packages/export/src/package.cjs` exposes synchronous CPU APIs:

- `createPackage({name, transportPath, runtimeDirectory, electronVersion, outputDirectory, intensity?})`
- `validatePackage(packageDirectory) -> {release, runtime}`
- `installPackage(packageDirectory, installRoot) -> {releaseId, runtimeId, releasePath, runtimePath, playbackReady:false}`
- `validateRelease(releasePath, expectedId?)`, `validateRuntime(runtimePath, expectedId?)`
- `retireRelease(installRoot, releaseId) -> {releaseId, retiredPath, runtimeRetained:true}`

The bundled `install.cmd [installRoot]` runs the bundled Electron executable in
Node mode; the default root is `%LOCALAPPDATA%\Lux\Installed`. The helper does
not need a machine Node installation or compiler. CPU tests use ordinary Node
for this helper; bundled Electron execution has not been exercised here because
the coordinator owns Electron/hardware runs.

```text
<installRoot>/runtimes/<runtimeId>/...
<installRoot>/releases/<releaseId>/{release.json,<transportHash>.json}
<installRoot>/instances/                 # reserved for mutable instance state
<installRoot>/retired/<releaseId>-<uuid>/...
```

Installation validates before mutation, copies to fresh staging directories,
validates the copies, then publishes by same-parent rename. Existing valid IDs
are reused; different versions coexist. Runtime publication precedes release
publication, so a failed release copy may leave an unused runtime but cannot
break an older release. Failed stages remain for diagnosis; successful duplicate
and authoring stages are cleaned with containment checks. Installation never
mutates the installed FFGL plugin. It rejects symbolic-link/junction ancestors
and descendants; it is not a defense against a concurrent hostile same-user
filesystem actor swapping paths between checks.

`install.cmd [installRoot] <releaseId>` retires only that release by moving it
under `retired`; it does not remove the runtime or another source. This is a
safe storage retirement helper, **not** host-aware uninstall of running sources.
Do not expose it as such until the supervisor can refuse retirement of live
references. No recursive runtime garbage collection is provided.

## Next lifecycle lane

Keep the runtime shared by `runtimeId`. Bind each FFGL source to its immutable
`releaseId`; generate a new instance UUID per loaded copy and place mutable
state under `instances/<uuid>`, never inside release/runtime directories.
The installed supervisor should resolve/validate the release and pinned runtime,
then launch `runtime/electron/electron.exe` with the packaged render-host entry.
The current entry still requires the experiment-supervisor environment and the
single-global transport bridge. Replace that startup integration and add native
instance routing; do not just forge those environment variables to claim installed
playback. Package the resulting compiled supervisor and any additional modules
as required runtime files before turning `playbackReady` true.

Next work must preserve the authoritative host snapshot before first accepted
frame, lease each instance to host lifetime, keep independent intensity/animation
state, allow shared service idle exit, report missing packages actionably, and
implement per-release FFGL identity/registration without executing visual code
during plugin scanning. Host/control restoration, two different sources, duplicate
copies and offline cold reopen remain unverified.

## Evidence

`node --test tests/unit/export-package.test.mjs`: eight CPU tests cover repeatable
IDs, complete-runtime changes, fixed/default versus saved control values, shared
runtime reuse, retirement/reinstall, corrupted-package nonreplacement, unlisted
files, manifest tampering, unsafe paths, junction escapes, nested copy rejection and helper execution
after original input paths become unavailable.

A real checkpoint package was created from prepared transport hash
`04784f34a76b02531b5808e8110ebb95592541ca5019a497344b68ab42d68e19` and the
transport checkout's generated worker, native bridge and probe DLL. Its runtime
contained 92 files totaling 387,125,266 bytes. This earlier smoke artifact has
release ID `d4df810ed04f5f2af86a147ba88e011f5077f734c7de9b862bd79d7a9e529329`
and runtime ID `bc6257bf99705d7b19e6b737b40b1ed971265a88764f95842e6635f0dd7734cc`;
subsequent helper-source changes intentionally produce different IDs. Artifact
bytes are local under `artifacts/export-foundation`, not committed. No native
rebuild, GPU/Resolume launch or installed plugin modification was performed.
