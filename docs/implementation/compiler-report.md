# TR-03 compiler and SDK implementation slice

This is an implemented CPU compiler/SDK slice, not TR-03 or GPU acceptance.
The coordinator explicitly authorized parallel implementation while GPU/runtime
integration remains gated. No generated visual, Electron, native graphics host,
or GPU shader was executed to validate this slice.

## Public surface and integration

`apps/build-worker/src/main.ts` exports `compileVisual(request, options)` and the
coordinator-owned types from `packages/runtime-contracts/src/index.ts`.
The request is `{source: {entry, files: Record<string,string>, sdkVersion:'0.1.0'}}`.
The result uses the canonical `CompileResult`: successful emitted artifacts are
**not** validated bundles, accepted revisions, or completed frames. The caller
owns scene/candidate IDs, admission queues, candidate smoke and activation.

`options.dependencyRoot` is a trusted service configuration, never an authoring
request field. It defaults to this checkout's `node_modules`; this development
environment uses the coordinator's central installed dependency directory.
`options.timeoutMs` defaults to 30000 and accepts explicit 1–30000 ms values for
bounded CPU tests. The caller cannot select a worker executable or command.

`packages/visual-sdk/src/index.ts` provides `defineVisual`, VisualDefinition,
VisualInstance, VisualContext, FrameContext and runtime-owned OutputTarget types.
It imports canonical OutputSettings/ControlValues/ControlDefinition as types only.
`defineVisual` supplies the frozen literal `intensity` contract: number, label
Intensity, default 0.5, range 0–1, live change cost. Creation is not called by the
SDK factory. The runtime must still validate controls, enforce authority and
finite values, own renderer/resource lifecycle, and smoke-test the candidate.

`@lux/visual-sdk/discovery` is a trusted filesystem-reading discovery adapter.
It returns the actual SDK/shared contract source, working source example and
the same pinned import allowlist used by the compiler. Never expose this adapter
in the renderer's import map; generated imports permit only `@lux/visual-sdk`,
`three/webgpu`, `three/tsl` and submitted relative TypeScript modules.

Example CPU invocation from an ESM service:

```js
import { compileVisual } from './apps/build-worker/src/compile.mjs';
const result = await compileVisual({ source: {
  sdkVersion: '0.1.0', entry: 'main.ts', files: { 'main.ts': submittedSource },
}}, { dependencyRoot: absolutePinnedNodeModules });
```

## Source boundary and actual compilation

Admission validates well-formed UTF-8 strings, aggregate 1 MiB and 32-file caps,
an existing entry, and unique case-folded module paths before disk materialization.
The initial path subset is ASCII letters/digits/underscore/hyphen directory and
file stems, with `.ts` suffixes and at most 240 characters per path. Absolute/traversal paths, Windows device names,
reserved `__lux` top-level names, drive prefixes, and case collisions are refused.
Relative imports require explicit `.ts` and must resolve inside the submitted
bundle. TypeScript rewrites these imports to emitted `.js` paths.

A fixed trusted worker runs Babel parser **8.0.5** on source as data. Its AST
rejects nonallowlisted imports/reexports, dynamic/import-equals/type imports,
ambient declarations, reference/diagnostic suppression directives and obvious
privileged capability identifiers. The entry must directly default-export a
`defineVisual(...)` call imported from the SDK. Syntax failures retain source
line/column. Screening is deliberately conservative; it is not a security sandbox
and cannot make arbitrary JavaScript or GPU shaders safe.

The real pinned native TypeScript **7.0.2** compiler typechecks and emits ES modules
and source maps with source content. It uses actual **@types/three 0.186.0** and
Three **0.186.0**, not handwritten substitute typings. `skipLibCheck` avoids
rechecking dependency declaration bodies; submitted source and SDK are strict
typechecked. Browser DOM types describe renderer APIs but do not grant actual
runtime capabilities. Diagnostics are bounded to 128 KiB; emitted result data is
bounded to 4 MiB. Both quotas count final serialized UTF-8 JSON bytes, including
escaping and the artifact's hash field. Excess diagnostics carry an explicit
truncation marker; the parent independently rejects oversized decoded results.
Diagnostics redact the job/dependency root paths.

Artifacts contain source hash, bundle hash, emitted modules/source maps, SDK and
compiler versions, and dependency hashes including the actual compiler executable,
Node executable, parser implementation, compiler policy, SDK/shared sources,
Three runtime entry/core bytes and the declaration closure listed by TypeScript.
IDs exclude temporary job paths. Repeating identical input/dependencies yields
identical source and bundle hashes. The renderer must map `@lux/visual-sdk` to
artifact module `__lux/sdk.js` and Three imports to the verified pinned dependency
bytes. Artifact dependency hashes are integrity metadata, not a runtime loader.

## CPU isolation and bounds

The trusted compiler worker and native TypeScript descendants run inside the
existing Windows Job Object helper, invoked directly without taking the exclusive
GPU experiment lock. The target is created suspended and assigned before resume.
Compiler jobs set a **1 GiB job-wide memory cap**, **256 MiB Node heap**, and a
30-second child lifetime ceiling. Source is never evaluated in this or the caller
process. A visual with an infinite `create` loop compiles as data; only a future
sandboxed runtime can exercise its initialization watchdog.

The optional helper memory setting permits zero (previous behavior) or 64 MiB–4 GiB.
GPU callers omit it, preserving their existing behavior. Job cleanup terminates
descendants and confirms active process count zero. Helper setup/cleanup has a
separate 15-second allowance; the compiler deadline begins at child resume.
An uncertain helper/cleanup result returns SERVICE_UNAVAILABLE and retains its
temporary evidence directory. Normal completed jobs remove only their own
randomly created directory. Abrupt helper termination in the narrow suspended
creation-before-job-assignment window retains the existing helper limitation;
see experiment-runner notes before manual cleanup. No timer guarantees recovery
from a whole-system GPU/driver freeze.

## Validation and remaining work

Run `node --test --test-isolation=none tests/compiler/*.test.mjs` on Windows with
pinned dependencies installed. Set `LUX_COMPILER_DEPENDENCIES` to an absolute
dependency root when the checkout lacks its own installation. Tests use only
compiler processes and harmless CPU allocation/spin fixtures. They cover source
boundary/budgets, real syntax/type diagnostics, pinned import failures, sibling
modules, deterministic identity, unexecuted infinite visual initialization,
compile timeout/recovery, literal SDK schema, memory limit and confirmed loop stop.
The full suite passed 15/15 in 39.9 seconds on this Windows machine, including
escaping-heavy diagnostics and parent result-reader regressions. These timings describe
the CPU tests, not compile performance or runtime/GPU acceptance.

Still required: real render-process sandbox and escape tests; resource factory and
renderer adapter; candidate initialization/first-frame smoke; generation-aware
supervisor lifecycle; queueing/cancellation; accepted revision retention and failed
replacement behavior; SDK-produced completed GPU output/captures and actual host
acceptance. This slice does not claim those gates or full TR-03 completion.
