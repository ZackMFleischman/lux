# S2 shared dependency linker amendment

17 September 2026. Independent architecture amendment after the native first-gate
failure. This changes the executable packaging prerequisite, not Scene v7/Story
v2 authoring, capability rules, transport, or scoped resource quotas. No product
implementation or new GPU run was performed by the reviewer.

## Evidence and decision

The independently reviewed probe ran at HEAD
`e54266c0326d56fb152d471fa54938081cfceea4`, profile
`test-585d3372-3afc-442a-9982-02bd91067826`, owned PID 21000. Its report records
`appClosed: true`. Evidence is in
`artifacts/story-interop/native-1789654636940/{result,raw-result}.json`; raw result
SHA-256 is `3d4d2db21290ae8fa7741c228cbfb9199308d6c4afea8ce274c66ff31258422c`.

Both passes produced ordinary `[187,0,0,127]`, foreign TSL `[0,0,0,0]`, and
red-only composition `[137,0,0,63]`. The ordinary result is within the analytic
rounding tolerance. Repeated `No stack defined for assign operation` errors and
`Light node not found for AmbientLight` warnings identify the duplicated-library
boundary. The reviewed source and raw report show four completed instance
disposals and completed renderer/device cleanup. The explicit target descriptors
match the planned recipe. Additional renderer-owned `rgba16float` and canvas depth
allocations are visible in the descriptor log; they remain outside the narrowly
named `storyTargetBytes` counter, as already documented. This is a valid failure
of interoperability, not acceptance of S2 or proof of total GPU memory reclamation.

**Implement a separate, sealed, multi-entry ESM capsule using esbuild splitting.**
One verified virtual Three/TSL dependency graph serves a dependency-only runtime
entry and all individually lazy authored visual entries. Keep `linkRuntime()` and
all existing standalone linked v3/v6 formats unchanged. Do not patch Node IDs,
TSL stacks, light libraries, prototypes, or global registries.

Pure Scene v7/Story v2 schema, source quotas, and per-reference capability work can
proceed independently. Capsule/manifest integration, worker scheduling, and overlap
delivery remain behind the repaired interoperability gate. This narrows the
earlier blanket ordering restriction; no runtime prerequisite is waived.

## Concrete build route

Add `linkSharedVisuals([{ id, artifact }], options)` beside the current trusted
linker API. Accept 1–8 distinct visual IDs with independently verified SDK 0.2
artifact v3 or v6. Reuse `verifyArtifact`, per-artifact result limits, emitted
policy validation, pinned dependency-byte checks, source AST import rules, and
the current Windows Job supervisor. Never execute submitted code in the linker.

Require one identical, complete dependency identity map for the current artifacts.
Reject mixed compiler/SDK/pinned dependency identities before linking; rebuilding
all source entries is the supported resolution. Legacy standalone handling of
older v3 artifacts does not authorize a partially pinned shared capsule.

Use canonical virtual paths:

- `dep/three.webgpu.js`, `dep/three.tsl.js`, and `dep/three.core.js` are loaded once
  from the existing verified byte snapshots.
- Each visual's compiled modules live under a distinct `visual/<index>/` namespace,
  indexed by sorted stable visual ID. Its relative imports cannot leave that
  namespace. Its SDK/policy modules retain their verified compiled identity.
- One trusted runtime entry imports the full `three/webgpu` and `three/tsl`
  namespaces and exports them as `WebGPU` and `TSL`. It imports no authored entry.
  This gives the renderer, targets, compositor, and every visual the same library
  objects and TSL state without selecting an authored source as library owner.
- Each visual entry imports only its own compiled root and exports its default
  definition. Its Three imports resolve to the same canonical dependency paths.

Run one esbuild invocation with all entries, `bundle: true`, `splitting: true`,
`format: 'esm'`, `platform: 'browser'`, the current ES target, `write: false`, and
`metafile: true`. Use a virtual-only resolver with no caller path/resolution hooks
and no filesystem/network fallback. Preserve current authored dynamic-import and
`require` rejection. The output runtime entry can initialize the full trusted
library before any source executes; it cannot import visual factories eagerly.

Use flat output names: `runtime.js`, `v000.js` through `v007.js`, and
`chunk-<esbuild-hash>.js`, with paired `.js.map` data kept as diagnostic payload.
Do not deploy or serve these files. Their names are logical identities inside the
capsule, not disk or URL paths.

## Sealed capsule and identity

Use a new discriminator such as `kind: 'lux-shared-visuals', version: 1`, not an
extra optional field on a standalone linked envelope. The exact canonical body
contains:

```ts
{
  kind: 'lux-shared-visuals'; version: 1;
  linker: LinkerIdentity;
  dependencyHashes: Readonly<Record<string, string>>;
  runtimeEntry: string;
  visuals: readonly {
    id: string; entry: string; sourceHash: string; bundleHash: string;
    artifactVersion: 3 | 6; sdkVersion: '0.2.0';
    controls: ControlSchema; controlSchemaHash: string;
    assets: DerivedAssets; assetSetHash: string;
    // Required only for artifactVersion 6; exact discriminated fields.
    storyCapability?: StoryCapabilityV1; storyCapabilityHash?: string;
  }[];
  files: readonly {
    path: string; code: string; sourceMap: string;
    codeHash: string; sourceMapHash: string;
    imports: readonly { start: number; end: number; target: string }[];
  }[];
  capsuleHash: string;
}
```

Canonicalize visual and file rows by stable ID/path; sort dependency keys. Import
ranges are source-text string offsets matching the parser's UTF-16 indexing and
cover the complete import source literal, including its quotes. File hashes cover
the original emitted bytes. `capsuleHash` covers the entire canonical body except
itself, including code, maps, import graph, dependencies, metadata, and linker
identity. Linker `implementationHash` must bind every local implementation/helper
file affecting this route, using a fixed canonical file/hash list; esbuild API and
binary identities remain pinned as today.

The trusted parent verifies the returned capsule against the exact verified input
artifacts: ID, source/bundle hashes, artifact version, controls, assets, and each
source's capability. A self-consistent hash is integrity, not a compiler signature;
do not add an API that accepts arbitrary caller-provided capsules as trusted link
results. Worker admission independently verifies exact fields, size limits,
hashes, schema/asset/capability identities, and the complete static import graph
before executing anything.

Replace the earlier S2 per-source standalone `linkedHash` reference with the
source's `bundleHash` and entry file `codeHash`, plus the shared `capsuleHash` at
schedule level. The schedule hash binds Story v2, sorted per-visual source/bundle/
entry/schema/capability identities, and capsule hash. Capability authority remains
per source; a shared library does not grant Story support. Scene files still save
sources/controls/animations, never executable capsules.

## Import graph and lazy execution checks

The linker parses emitted JavaScript and derives every static import/re-export
edge and exact literal range. Reject missing files, unknown output types, duplicate
or case-folded paths, external/bare/absolute/scheme imports, query/fragment suffixes,
dynamic imports, `require`, unlisted edges, and cyclic emitted chunk graphs. All
imports must name an admitted flat sibling file. Source-level cycles contained
within one bundled entry are not inherently prohibited; the final emitted graph
must be acyclic for this bounded blob loader.

Check esbuild's output provenance before sealing: code with positive output bytes
from authored visual B cannot appear in runtime-reachable output or visual A's
static closure. The runtime closure contains trusted dependencies only. No visual
entry may depend on another visual entry. Use canonical input namespaces to make
these checks exact; do not infer provenance from generated names or comments.
The common dependency module identity is resolved once by esbuild, not copied into
each entry. Tests verify shared constructor/function identity as well as provenance.

The browser admission helper reparses output files in its pristine realm using
the pinned parser, compares exact imports and ranges to the sealed graph, and
verifies hashes before making URLs. It constructs URLs bottom-up: replace only
validated import literals, using `JSON.stringify` of the already-created target
blob URL, then create one blob URL for that file. No regex-wide substitutions,
runtime import maps, custom network protocol, `eval`, or ad hoc global singleton.
This relocation is an internal transformation of already verified code; keep its
logical-file-to-URL map for diagnostics and never hash random URLs as source
identity. Source maps remain sealed diagnostics; adjust mappings for relocated
literals before claiming exact mapped locations.

Construct the entire graph and capture import/URL cleanup operations before any
authored import. Import the runtime entry once. Import a visual entry only when
its slot prepares, caching one promise/namespace per ID for the generation.
Creating URLs or storing linked bytes must not evaluate that source. A failed
import remains failed for that generation; Retry cannot bypass the module limit
by manufacturing new URLs. Keep URLs while a lazy descendant may need them;
revoke the full owned set on terminal generation teardown. URL revocation does
not unload ESM state, so imported factories remain within the existing eight-
definition bound until worker disposal.

Sharing a worker also shares JavaScript and Three state. An authored visual can
mutate Three class prototypes or other reachable shared objects and affect a
sibling. This capsule fixes library identity; it does not sandbox one visual from
another. Do not deep-freeze Three or advertise per-visual isolation. Capture the
host's admission, graph/URL, control, renderer-facade, and resource operations
before authored execution and keep private ownership records unreachable. If
runtime corruption is detected, fail and retire the complete generation under
the existing last-good-output and external-watchdog rules. These checks do not
promise detection of every authored mutation. The trusted boundary remains the
authored worker versus the host, with the existing process/GPU failure limits.

## Fixed bounds and containment

- Keep 4 MiB maximum per input compiled artifact. Allow 32 MiB aggregate artifact
  JSON and a separate 40 MiB bounded request wrapper for this API only. Existing
  single-artifact request limits do not change.
- Allow at most 64 executable output files, 256 static import edges, and graph
  depth 32. Each `{code, sourceMap}` pair is at most 16 MiB serialized. Complete
  capsule serialization is at most 64 MiB, replacing the earlier aggregate
  standalone-envelope allowance rather than adding another 64 MiB.
- Capsule metadata excluding file code/maps and per-visual asset payloads remains
  at most 1 MiB, including the one deduplicated dependency identity map. Count
  assets/code/maps exactly once in the complete capsule quota; retain existing
  independent asset bounds and lease accounting.
- Preserve the Job's 30-second link deadline, 1 GiB process-tree memory limit,
  256 MiB Node heap setting, 45-second supervisor deadline, cleanup receipt, and
  retained failure evidence. Measure the first 2-visual result under these limits;
  no automatic resource-limit escalation for a large capsule.
- Apply limits before serialization/allocation, after child output, and in worker
  admission. Account string escaping and UTF-8 bytes as in current bounded JSON.
  No widening of GPU/slot/generation limits accompanies this change.

## File ownership and completion gate

Linker owner: new `apps/build-worker/src/shared-link-runtime.mjs`,
`shared-link-worker.mjs`, and `shared-link-identity.{mjs,d.mts}`. A narrowly extracted
pure dependency/virtual-input helper may be shared with `link-worker.mjs` to avoid
duplicating security checks; preserve all standalone regression checks. Do not
generalize unrelated compiler execution or change compiled artifact versions.

Admission owner: new `apps/studio/src/authored-shared-modules.mjs`, consuming the
shared capsule validator and existing per-source control/asset admission factories.
The native probe can use this helper before a scheduler exists. The existing
`prepareAuthoredModule` standalone route remains available unchanged.

Tests/probe: add focused shared-link identity, graph, containment, and lazy-loader
tests; update the current interoperability harness to create its renderer from
`runtime.WebGPU` and use that same runtime's TSL for composition. Keep the same
authored Lambert/Fn/If sources, alpha oracle, target recipe, recreation/disposal,
profile/PID discipline, raw results, and warnings. Preserve the failed baseline.

Required checks before the next native run:

1. Both artifact versions preserve their own controls and capabilities; tampered
   metadata, dependency mismatch, changed bytes, malformed graph/ranges, excessive
   quotas, external imports, and output cycles are rejected before import.
2. Runtime import executes no authored top-level code. Importing A does not execute
   B; importing B twice executes B once. A rejected/cancelled attempt cannot create
   unbounded module URLs. Constructor/TSL identity comes from the shared closure.
3. Existing standalone linker/artifact/admission tests still pass, including pinned
   dependencies and Windows Job cleanup. The new result remains within its quotas.

Then request root's single GPU lease and rerun the same analytic probe. Acceptance
requires both source pixels, both composition/PNG passes, expected descriptors,
clean disposal, and disappearance of the TSL-stack/light-constructor warnings.
An unchanged Electron development CSP warning is unrelated and must be reported
separately; do not disable sandboxing or change GPU validation for the probe.
The root coordinator adopts this amendment before implementation dispatch. The
scheduler remains gated until this repaired native result is independently read.
