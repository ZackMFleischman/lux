# C02 internal component execution contract

Status: approved internal execution scope, implemented for independent review in LUX-8.
C01 and project metadata1a prerequisites were integrated at f95f3975892bf612bb63b94111893b18b84fff20.
This document carries the reviewed contract and final project-v1 SDK-gate amendment into tracked documentation.
Public authoring, graph resources and real GPU acceptance remain later gates.

## Selected scope

**C02 is an internal executable bridge:** add SDK `0.3.0`, compiled
artifact `artifactVersion: 4` and linked envelope `linkedVersion: 4`, execute a
single declared image-source component in the actual existing visual-worker path,
and test that path with fake renderer/device resources. Keep ordinary Studio/MCP
supported SDKs at `0.1.0`/`0.2.0` and preserve strict product admission. C04 later
opens the authoring path after integration and serialized real GPU validation.

The bridge admits **no inputs and exactly one output named `image`**, with C01's
linear-sRGB/premultiplied image declaration. Number/live controls may be empty.
Both existing state declarations (`stateless`/`stateful`, reset by seed) are
admitted; a private factory owns state. Other valid C01 metadata remains valid
catalog data but is rejected for this executable profile. No event, signal-input,
effect-input, arbitrary image allocation or graph scheduler is claimed.

This is one additive branch in the existing selector/compiler/linker/worker,
not a second compiler service, scene store or runtime authority. SDK 0.3 may be
compiled by internal development/test callers; that does not mean ordinary
Studio, project files or installed releases support it. Do not publish 0.3 in
`studioCapabilities` or `discoverVisualSdk().supportedSdkVersions` in this slice.
The project-v1 capability gate below is a prerequisite in the same reviewed C02
integration that widens internal source admission; global SDK validation alone
must not silently widen persisted project metadata.

## Pre-C02 owner analysis and discriminant rationale

The following observations describe the integrated foundation before this slice.
The implementation adds the v4 branches specified below; these observations are
retained to explain why old discriminants and public capabilities stay fixed.

- `source-policy.mjs` calls `sdkSourceFile`; source envelopes and SDK version are
  separate. 0.2 already accepts legacy source envelopes and explicit assets v2.
- `worker.mjs` currently parses 0.2 literal `defineVisual`, copies selected SDK
  types, emits `__lux/sdk.js`/`__lux/parameters.js`, inventories dependency hashes
  and constructs the artifact through `artifactBody`.
- `artifact-identity.mjs` admits only artifact/linked versions 2/3 (or implicit v1),
  seals control fields only at v3, and hard-codes v3 to SDK 0.2. Its strict owner
  cannot accept component metadata under an old discriminant without changing
  the meaning and hash body of the existing format.
- `link-worker.mjs` re-verifies the artifact/dependency closure, restricts every
  virtual import and copies artifact fields into a separately hashed linked body.
  The browser worker gets linked code rather than the compiled module inventory,
  so component metadata must survive in a new linked v4 body as well.
- `authored-worker-assets.mjs` verifies linked data and original/derived assets
  before importing submitted code. `worker-control-state.mjs` prepares schema and
  captured-intrinsic post-import checks. Both require additive v4/component handling.
- `visual-worker.mjs` owns clock, seeded RNG, update/render cadence, the one output
  RenderTarget, queue completion, capture and final presentation. Reuse those.
- `standalone-client.ts`, `service-client.ts`, `control-state.ts` and
  `capabilities.ts` still model only SDK 0.1/0.2. Their ordinary admission must not
  accidentally treat 0.3 as legacy when the general SourceBundle union expands.
- `scene-document.ts` preserves scene versions 1/2/3. Export and installed readers
  interpret linked v3 as parameter release v2 and must reject v4 explicitly until
  their later closure/capability work is implemented.
- The actual first installed/transport reader is
  `tools/gpu-spike/transport-release.cjs::readTransportRelease`. Its policy calls
  `runtime-validation.mjs`'s reexport of shared `linkedBody`; rebuilding that
  policy will recognize v4. Add a reader-local allowlist admitting only implicit
  linked v1 and explicit v2/v3 **before** calling the shared validator. Do not
  rely on a stale generated policy or `runtime-capability.cjs`, which only checks
  build markers and does not receive a linked envelope.

## Exact source, artifact and linked contract

Keep SourceBundle envelopes unchanged: implicit v1 or explicit `sourceVersion:2`
with exact current assets. Add SDK `0.3.0` only as a new source SDK discriminant.
For 0.3, `sourceArtifactVersion` always returns 4, including code-only/no-assets
source. Asset limits/codecs, source limits and allowed bare imports stay unchanged.

Define compiled v4 as the existing asset-bearing base fields plus exactly:

```ts
{
  artifactVersion: 4;
  sdkVersion: '0.3.0';
  executionModel: 'single-image-source-v1';
  component: ComponentMetadata; // normalized C01 declarationVersion: 1
  componentMetadataHash: Hash;
  controls: ControlSchema;
  controlSchemaHash: Hash;
}
```

`componentMetadataHash = SHA256(UTF8(canonicalComponentMetadataJson(component)))`.
The existing control hash remains SHA256 of existing canonicalControlSchemaJson.
Require `controls` to equal `component.controls` by canonical bytes. The duplicate
top-level control fields are a checked projection for existing parameter consumers,
not a second declaration. Include all these fields in the v4 artifact identity
body with deterministic fixed field order; leave old-version body algorithms intact.
Fixed old-format input bodies keep their canonical bytes. Recompiling old source
with changed compiler implementation can produce new dependency hashes; identical
recompilation hashes across compiler revisions are not promised.

Linked v4 has the existing linked base (`code`, `sourceMap`, `bundleHash`, `linker`,
assets/assetSetHash) and **the same sdkVersion, executionModel, component,
componentMetadataHash, controls and controlSchemaHash**. Include them in linkedHash.
`verifyLinked(linked, hash, expectedArtifact)` checks SDK/model/metadata and control
canonical bytes and hashes against the artifact, in addition to existing checks.
Unbound browser `verifyLinked` still validates all internal cross-fields.

Reject unknown fields/versions and every mismatched combination: 0.3/v3, 0.2/v4,
wrong model, old envelope carrying new metadata, component hash mismatch, altered
controls, missing internal policy modules and changed dependency hashes. Hashes
are integrity identifiers, not signatures granting authority to arbitrary callers.

## Typed SDK API

New trusted selected entry `packages/visual-sdk/src/sdk-components.ts`; do not
modify SDK 0.1/0.2 `defineVisual` signatures or the package's default exports.
The entry imports the integrated C01 types/pure normalizer and parameter types.

```ts
export const sdkVersion = '0.3.0' as const;
declare const imageResourceBrand: unique symbol; // type only; no public mint function
export interface ImageResource {
  readonly [imageResourceBrand]: true;
  readonly width: number;
  readonly height: number;
  readonly colorSpace: 'linear-srgb';
  readonly alphaMode: 'premultiplied';
}
export type EmptyInputs = Readonly<Record<string, never>>;
export interface EvaluationContext {
  render(scene: unknown, camera: unknown): Promise<ImageResource>;
}
export interface ComponentFrame<C extends ControlDeclarations> {
  readonly tick: number;
  readonly timeSeconds: number;
  readonly deltaSeconds: number;
  readonly controls: ControlsOf<C>;
  readonly events: readonly never[];
}
export interface ComponentContext {
  readonly settings: Readonly<OutputSettings>;
  readonly assets: VisualContext['assets'];
  readonly images: VisualContext['images'];
  random(): number;
  reportError(message: string): void;
}
export interface ComponentInstance<C extends ControlDeclarations = ControlDeclarations> {
  update(frame: ComponentFrame<C>): void;
  evaluate(inputs: EmptyInputs, context: EvaluationContext): Promise<Readonly<{image: ImageResource}>>;
  reset(seed: number): void | Promise<void>;
  dispose(): void | Promise<void>;
}
export interface ComponentDefinition<C extends ControlDeclarations = ControlDeclarations> {
  readonly kind: 'component';
  readonly sdkVersion: '0.3.0';
  readonly metadata: ComponentMetadata;
  create(context: ComponentContext): Promise<ComponentInstance<C>>;
}
export function defineComponent<const C extends ControlDeclarations>(definition: {
  readonly metadata: Omit<ComponentDeclaration, 'controls' | 'controlDescriptions'> & {
    readonly controls: C;
    readonly controlDescriptions: {readonly [K in keyof C]: string};
  };
  create(context: ComponentContext): Promise<ComponentInstance<NoInfer<C>>>;
}): ComponentDefinition<C>;
```

`VisualContext` above is a type-only reuse of the current settings/assets/images
shapes, not a runtime import of sdk-v2; the selected SDK's copied type closure must
be self-contained in the compiler's trusted `types` area. A dedicated shared
type-only context module is acceptable if it does not alter old emitted identities.
The factory receives no renderer, device, target or resource ID. Rendering is
available only during evaluation through a host-created context.

The exact source shape is `export default defineComponent({ metadata: {...},
async create(context) {...} })`. Require metadata inline literals; allow the
imported defineComponent binding to be aliased. Parse strings, finite numeric
literals, null, plain literal objects and arrays for metadata, with exact C01
rules; no spread, computed/shorthand metadata keys, getters, calls, references,
template expressions or duplicate object keys. Implementation code in create
remains arbitrary allowed TypeScript. Existing imports remain limited to
`@lux/visual-sdk`, `three/webgpu`, `three/tsl`, and admitted relative `.ts` modules.
Do not permit a new authored import for internal policy modules.

## Metadata agreement across the trust boundary

AST extraction calls C01 normalization, rejects executable-profile-incompatible
ports and seals those exact bytes. SDK `defineComponent` normalizes/freeze-snapshots
the same literal without calling create. This declaration helper is convenience,
not trusted evidence after the authored module runs.

Choose a two-phase loader seam in `authored-worker-assets.mjs`:

```ts
prepareAuthoredModule(message: unknown): Promise<PreparedAuthoredModule>;
// PreparedAuthoredModule has frozen verified admission data and a private,
// once-only import(importer) closure returning {module, assets, images}.
// No authored import occurs during prepareAuthoredModule.
```

Retain `loadAuthoredModule(message, importer)` as the old-path convenience wrapper
over prepare then import, preserving its existing return type. The component
worker path must call the phases separately. The prepared closure owns the exact
verified code and read-only asset/image maps; it cannot be retargeted by replacing
message fields. Its admission variant identifies legacy/unlinked versus verified
visual/component and carries the already verified v4 metadata/projection. It is
not another service or a caller-mintable admission capability.

The exact initialization order is:

1. Snapshot/bound message and validate outer settings/identity.
2. Await `prepareAuthoredModule(message)`: verify linked v4 hashes and assets;
   validate the executable profile itself (no inputs, exactly `image` output with
   linear-sRGB/premultiplied type), including self-consistent rehashed envelopes
   supplied outside the compiler path. For components, reject moduleSource-only
   initialization. Preserve that compatibility path only for old SDKs.
3. Compare message SDK, control schema/hash and values to the verified admission
   projection. Prepare the existing control state and expected component tree;
   capture post-import descriptor checks and private resource-validation intrinsics.
   Reject disagreement here with zero imports. No metadata arrives for preparation
   only after `loadAuthoredModule` has executed submitted code.
4. Arm the existing heartbeat, then invoke the prepared once-only importer with
   its exact verified code. The trusted Blob/URL import adapter captures its cleanup
   methods before import; no user callback chooses different bytes.
5. Check the returned default definition through the prepared checker, then create
   GPU resources/factory instance and capture validated lifecycle methods. A
   definition mismatch allows one import but zero factory calls.

Capture every intrinsic used after import, following `worker-control-state.mjs`
(descriptor lookup, own-key/prototype checks, array length, equality, WeakMap
constructor **and bound methods**). After import,
verify the module's default has exactly own data fields `kind`, `sdkVersion`,
`metadata`, `create`; compare every declared scalar/record/array against the
prepared tree through captured descriptors, never getters or mutable global
JSON/normalization functions. The factory must be an own data function.

Keep the same admission authority: add a branch/helper in the existing worker
preparation pipeline, not a second parallel controls store. Factor its common
prepared-schema/sequence mechanics only as required, keeping legacy method
behavior tested. Parameter apply for 0.3 requires schema hash and monotonically
increasing sequence exactly like 0.2. Frozen-time updates continue using existing
outer clock/sequence/frame metadata. There are no node IDs in C02.

## Output token and lifecycle contract

Add one private bridge in `packages/runtime/src/components/single-image.ts` with
an injectable rendering backend. Its runtime-owned registry uses a captured
WeakMap keyed by the actual token object; the public phantom TypeScript brand is
not validation. Tokens carry no user-supplied/native ID, texture or release method.

For each evaluation, the bridge makes a unique private epoch, a frozen empty input
record and a frozen context. `context.render(scene,camera)` reserves its sole slot
**synchronously before invoking the backend**, so reentrant or concurrent calls
cannot submit twice. Track the backend promise privately, independently of the
promise returned to authored code and of evaluate's promise; attach rejection
observers immediately to prevent unhandled rejections if the author never awaits.
It renders into the worker-owned existing output target and never presents the
canvas itself. After backend fulfillment, recheck active owner/epoch before issuing
a frozen token with current width/height/color/alpha metadata. Late fulfillment
after invalidation issues no token and cannot turn a failed frame into a success.

Store owner/session/epoch and target in the private registry. A second call, call
after evaluation ends, fake token, copied token or token from another evaluation/
bridge fails. Reject an output object with extra fields, getters, inherited values,
no image or a token not issued for that evaluation. Validate returned output while
its epoch is active, then close it in `finally`, including exceptions. On failure
invalidate output admission immediately; do not present.

If authored evaluate starts rendering without awaiting it and then throws or
returns invalid output, the bridge still owns that pending backend operation.
Before another evaluation reuses the target, before reset, and before disposal,
await/settle the tracked operation (record rejection without losing the original
failure). The worker then awaits its device queue-completion barrier before target
or renderer teardown; a settled JavaScript render promise alone is insufficient.
Nonsettling backend/GPU work uses the existing supervisor's bounded forced
termination fallback; do not free still-used resources merely because evaluation
was rejected or a timeout elapsed. No unbounded orderly-drain guarantee is claimed.

Only after successful output validation does the existing worker present its
target, await its existing queue-completion barrier and emit a new completed frame.
If evaluation fails, do not present or relabel old pixels. The existing supervisor
failure/retention path remains authoritative. No additional requestAnimationFrame,
clock, renderer, target or scheduler is created by the bridge.

`update` receives current numeric controls and existing frame semantics. Every
explicit reset invocation runs once with its supplied seed, preserves controls and
invalidates outstanding output admission before draining; two reset invocations
must both reach authored reset. This is not deduplication inside the bridge.

The narrow **terminal cleanup path** in `visual-worker.mjs` supplies behavior that
was absent from the foundation's timer-only failure handler. Cache one
terminal/cleanup promise; mark
terminal immediately, cancel timers/admission, invalidate tokens and stop capture.
Track each allocated resource as initialization proceeds. For a returned component
instance, descriptor-validate and capture its required lifecycle functions before
use; never reread replaceable authored methods. If a malformed instance has a safe
own data dispose function, capture that cleanup function only; do not invoke a
getter trying to salvage it. Rejected create has no returned instance to dispose.

Restore the renderer target in the backend render's `finally`. Graceful terminal
cleanup first settles the current command (initialization, draw, reset or readback),
then bridge-owned backend work and the GPU queue barrier, then
attempts authored disposal once (mark attempted before invoking), then independently
attempts all allocated output-target, presentation-material, profiling, renderer
and device cleanup. A thrown authored/owned disposer does not skip other safe
cleanup attempts. Preserve the original error; retain bounded cleanup diagnostics
separately. Repeat terminal/dispose notifications return the existing cleanup
promise and never rerun disposal. Partial initialization follows the same path
with only the resources actually allocated.

Device loss bypasses the serialized command queue. Checks after awaited update,
render, queue completion and renderer initialization prevent work from continuing
or publishing a new completed frame after terminal state. Readback is drained
without publishing a late capture. A command that never settles retains resources
until the existing supervisor's forced-termination boundary; cleanup cannot prove
settlement merely from receiving a device-loss notification.

Report the original failure promptly through the current parent notification path;
best-effort graceful cleanup does not delay or replace supervisor failure handling.
Parent retirement currently calls worker.terminate; it can interrupt graceful
cleanup. **Forced termination cannot guarantee authored disposal, acknowledged
backend settlement or an acknowledged GPU drain.** Keep that distinction in tests
and completion claims; C02 does not change parent retirement into a new handshake.
A stuck authored disposer likewise falls back to bounded termination, rather than
claiming later cleanup completed. This does not solve general arbitrary Three
allocation accounting or GPU preemption.

The unit backend can be exactly:

```ts
interface SingleImageBackend {
  readonly width: number; readonly height: number;
  render(scene: unknown, camera: unknown): void | Promise<void>;
}
// Prepared factory/context and captured validators are trusted arguments.
createSingleImageVisual(instance: ComponentInstance, backend: SingleImageBackend): {
  update(frame: ComponentFrame<ControlDeclarations>): void;
  render(): Promise<void>; // validates successful output; caller then presents
  reset(seed: number): Promise<void>;
  dispose(): Promise<void>;
};
```

The factory remains admitted/created by visual-worker; this bridge does not import
authored code or own control state. The worker continues exporting legacy
VisualInstance behavior to its outer lifecycle. Capture reads the same completed
target; token objects never cross IPC.

## Migration into C03/C04 without an image-per-component platform

This adapter is a **root-output execution profile**, not the definition of every
future component. C03 adds graph instance IDs/paths, typed dependency planning and
fake-resource scheduling; C04 supplies a graph-aware evaluation resource host.
The host will issue leases to declared consumers and schedule passes rather than
reusing the root-only single-call restriction for internal nodes.

`ComponentInstance.update/evaluate/reset/dispose` and normalized declaration data
remain the seam. A later explicit executionModel/SDK extension admits input images,
signals and geometry/points/material/camera/scene-object resource variants. Shared
3D contributions are assembled into one compatible scene pass; they do not become
full image sources just to fit this bridge. Preserve the sealed
`single-image-source-v1` behavior for old artifacts; do not silently widen its
resource capabilities. Both the old root adapter and future graph adapter use
one resource authority inside the same worker. No separate GPU scene service or
editable source-generated wiring is introduced.

## File inventory and ownership

### Cross-workstream prerequisite: project-v1 SDK capability boundary

Read-only inspection of filesystem foundation `9a791d3` in the sibling
`filesystem-projects` worktree found `core/src/project/contracts.ts` imports the
global `sourceSdkVersionSchema` twice: `sourceFields.sdkVersion` (shared by local
ComponentFile and standalone CodeExport) and `toolchain.sdkVariants` record-key
validation. Expanding that global enum to 0.3 would expand those project-v1 paths.
The enclosing package's existing closed `sdkRange` happens to reject 0.3 exports,
but direct CodeExport admission and local components must not rely on that outer
check, and a toolchain entry could be admitted even when no scene uses it.

After both C01 and filesystem Task1a integrate, the coordinator assigns one owner
for this narrow adjustment in `packages/core/src/project/contracts.ts`:

```ts
// A persisted project-v1 capability restriction, not the global source SDK list.
const projectV1SdkVersionSchema = z.enum(['0.1.0', '0.2.0']);
// sourceFields.sdkVersion uses this schema, as does each toolchain.sdkVariants key.
```

Remove the global source-SDK-schema import from that project module. Keep shared
hash/output/identity DTO imports and all snapshot preprocessing unchanged. This
local versioned allowlist is intentional narrower product admission, not another
SDK implementation or duplicate persisted schema. The global source schema can
then admit 0.3 for the internal compiler while project-v1 parsing and inferred
ComponentFile/CodeExport SDK types remain exactly `0.1.0 | 0.2.0`. Keep the current
package `sdkRange` enum and its export/range check unchanged. No persisted field,
schema version, pin/hash algorithm or ordinary 0.1/0.2 value changes.

Use the same local gate for both the disk lock's SDK-variant keys and the caller's
`supportedToolchain` parsed by `admitProjectMetadata`; do not infer project support
from a globally registered compiler SDK, installed declaration pack or a matching
runtime hash. Unknown variants, including an unused extra 0.3 entry, fail rather
than being filtered or dropped. A future project schema/capability extension must
explicitly authorize component SDK 0.3; this bridge does not migrate v1 files.

Extend the actual `tests/project/contracts.test.ts` foundation suite (fixtures in
`tests/project/fixtures.ts`) after integration:

- Global internal `sourceSdkVersionSchema` and valid SourceBundle admit 0.3, while
  `componentFileSchema` and standalone `codeExportSchema` reject otherwise-valid
  copies whose sdkVersion is 0.3. Test both source envelopes 1 and 2, and an unused
  local definition through `admitProjectMetadata`.
- `dependencyLockSchema` rejects a sole 0.3 variant and an extra 0.3 variant beside
  0.1/0.2, including an unused one. Whole admission rejects both a disk lock and a
  supplied supportedToolchain carrying that extra entry even if they match.
- Package-v1 rejects 0.3 export and sdkRange (including a 0.3 alternative); direct
  CodeExport rejection is checked independently of the enclosing package.
- Existing 0.1 and 0.2 component/code-export cases and their source-envelope
  combinations still parse; the original multi-scene/package fixture still admits.
  Fixed accepted metadata/package hash fixtures retain identical canonical bytes.
- Type assertions prove ComponentFile/CodeExport SDK assignments stay the exact
  0.1/0.2 union while the generic internal SourceBundle type gains 0.3. Invalid
  fixture inputs use raw object copies rather than widening the fixture type.

One illustrative boundary test (using the foundation's real fixture exports):

```ts
const f = fixture();
assert.equal(sourceSdkVersionSchema.safeParse('0.3.0').success, true);
assert.equal(componentFileSchema.safeParse({...f.components[0], sdkVersion:'0.3.0'}).success, false);
assert.equal(codeExportSchema.safeParse({...f.pkg.exports.noise, sdkVersion:'0.3.0'}).success, false);
const extraVariant = {...f.lock, toolchain: {...f.lock.toolchain, sdkVariants: {
  ...f.lock.toolchain.sdkVariants,
  '0.3.0': {declarationEntry:'sdk/components.d.ts', contractHash:h},
}}};
assert.equal(dependencyLockSchema.safeParse(extraVariant).success, false);
```

This amendment adds filesystem admission to the independent C02 scoped review.
Root coordinates shared-file ownership and the combined regression run; neither
workstream should copy the entire project contract module or patch it concurrently.

### Implementation inventory

Create:

- `packages/visual-sdk/src/sdk-components.ts`: new selected SDK definitions/helper.
- `apps/build-worker/src/component-declarations.mjs`: bounded AST metadata reader/profile admission.
- `apps/studio/src/controls/worker-component-definition.mjs`: captured-intrinsic comparison helper used by the existing control/loader pipeline.
- `packages/runtime/src/components/single-image.ts`: root output token/lifecycle bridge, no Three dependency.
- Tests: `tests/compiler/component-api.test.mjs`, `component-declarations.test.mjs`, `component-identity.test.mjs`, `component-compiler.test.mjs`; `tests/runtime/component-single-image.test.ts`; `tests/studio/component-worker.test.mjs`.

Modify in one coordinator-owned compiler/runtime slice:

- `packages/runtime-contracts/src/index.ts`: additive 0.3 source and strict v4 artifact schema, no edits to old discriminants.
- `packages/core/src/project/contracts.ts`: coordinator-assigned project-v1 SDK0.1/0.2 capability restriction after foundation integration, covering sourceFields and toolchain keys as specified above; not a second project schema or v1 migration.
- `tests/project/contracts.test.ts`: cross-boundary internal0.3/project-v1 rejection, direct export/lock/whole-admission regressions and exact inferred project SDK types; reuse its existing fixtures and hash assertions.
- `apps/build-worker/src/sdk-selection.mjs`: fixed 0.3 -> sdk-components.ts/v4 mapping.
- `worker.mjs`: extractor/type-check guard, explicit fixed copies of C01 pure policy/types, emitted trusted internal modules and dependency inventory.
- `artifact-identity.mjs` and `.d.mts`: exact v4 identity/body/hash/link agreement.
- `compile.mjs`: expected-source SDK/version and asset identity check includes v4.
- `link-worker.mjs`: require/resolve selected trusted internal SDK metadata policy modules, inventory their actual dependency closure and copy v4 fields. Make component-only required modules/dependency keys conditional on v4; the current linker requires every `known` key, so adding unconditional component keys would incorrectly change admission of old artifacts.
- `link-runtime.mjs`: linked v4 return type/documentation only if required by its actual type declarations; keep service/bounds unchanged.
- `authored-worker-assets.mjs` and `.d.mts`: explicit prepare/import split and old load wrapper; v4 admission/profile checks and frozen verified projection before control-state preparation/import; no moduleSource compatibility path for components.
- `worker-control-state.mjs`: additive component preparation/check branch and shared numeric state/sequence mechanics.
- `visual-worker.mjs`: exact preparation/import order, branch after verified definition to single-image bridge, captured lifecycle functions, validated presentation, pending render/GPU drain and once-only terminal/partial-initialization cleanup described above.
- `standalone-client.ts`: explicit early unsupported-SDK rejection for ordinary UI before compile; preserve its 0.1/0.2 state types, not reinterpret 0.3 as legacy.
- `packages/core/src/scene-document.ts`: existing v1/v2 readers already pin SDK 0.1 and v3 pins 0.2; regression tests may suffice. Change only if expanded SourceBundle admission exposes a creation/parsing fallback. Do not add scene version 4.
- `tools/gpu-spike/transport-release.cjs`: unconditional supported linked-version allowlist (implicit v1, explicit v2/v3 only) before generic linked validation. Unknown explicit versions, including v4, fail with an unsupported-profile error even if their hashes are self-consistent.
- `packages/export/src/package.cjs`: defensive unsupported-profile rejection before staging/copying, retaining the transport reader as first installed admission owner. No change to `runtime-capability.cjs` markers or installed runtime versions is needed.
- `tests/unit/transport-release.test.mjs`, `export-package.test.mjs`, `parameter-export.test.mjs`: v4 rejection under the source-policy fallback and a freshly bundled `runtime-validation.cjs`; existing v1/v2/v3 acceptance remains covered.
- `apps/studio/test-cpu.mjs` or an explicit coordinator-selected runner: execute new real-worker VM test with `--experimental-vm-modules`; avoid a parallel competing test runner.

C01 policy is consumed from the integrated foundation. SDK compiler
copy/link inventory must follow its final integrated module paths/import closure.
Do not bundle `core/components/registry.ts` into authored code. Shared policy
copies resolve inside `__lux/` only through trusted compiler rewrites, never
authored `__lux` source paths or arbitrary bare imports.

Tracked SDK discovery and repo skill should state only the unchanged available
0.1/0.2 contract in C02. If a developer-facing document names the internal profile,
label it unadvertised and CPU-tested only. When C04 opens the public authoring
route, update/reinstall/check the repo skill with the running checkout. Do not
describe CPU VM execution as a live supported SDK or actual GPU validation.

## Reviewed implementation and validation checklist

0. Integrate both first foundations and assign the shared contract owner. Add the
   project-v1 SDK gate/regressions above before or atomically with global 0.3
   source admission, so no reviewed merge advertises internal support while
   silently admitting it through v1 project/component/export/toolchain metadata.
1. Add failing AST/API tests. Correct inline component + helper import passes;
   aliases pass. Dynamic metadata, duplicates/accessors/spreads, omitted/extra
   image output, any input, non-image output and wrong field/unit fail with source
   locations. Import `process`, new bare dependencies or dynamic loads still fail.
   Real pinned TypeScript infers numeric controls; missing/readonly control misuse,
   fake uncast ImageResource and incorrect evaluate output fail.
2. Implement new SDK/extractor plus strict v4 bodies. Tests cover legacy/v2 source
   envelopes, no-assets and PNG assets, every wrong SDK/artifact/linked pairing,
   hash tampering, altered/rehashed metadata versus expected artifact, control
   projection mismatch, unknown fields and trusted policy dependency changes.
  Golden old-version identity bodies remain byte-identical for fixed inputs.
3. Implement compiler/linker path using actual job-supervised compile/link APIs.
   Test code is not executed during compile/link via a create/top-level sentinel
   that would throw at runtime but compiles; extract unsupported ports before
   worker execution. Linked output has no external policy imports and contains
   only admitted virtual source/dependencies. Missing/mutated policy modules fail.
4. Add token/bridge unit tests before implementing the bridge. Spy backend counts
   one render; fake, cloned, old-evaluation, other-owner tokens fail; second render
   and captured-context calls after completion fail; thrown evaluate never validates
   a frame. Add deterministic deferred-backend cases: unawaited render then throw,
   unawaited render then invalid output, backend rejection, disposal/reset while
   rendering is pending and late completion after epoch closure. Assert no token,
   presentation, unhandled rejection or target reuse/cleanup before settlement and
   GPU barrier. Disposal attempts once; two explicit resets each run once with
   their supplied seed/current controls and cannot reuse an old token.
5. Add real visual-worker VM tests (adapt the existing bundled worker harness,
   not a stand-in reimplementation). The v4 envelope's actual `code` is the code
   evaluated by the importer, containing its fake Three exports; do not validate
   envelope A and substitute unrelated fixture B as the old harness does. Use a
   mocked GPU/device backend. Count target writes, canvas presentation, GPU queue
   completion and output messages separately. Assert heartbeat precedes import/
   create, post-import metadata disagreement blocks create, linked/message/profile
   mismatch causes zero imports, and valid execution
   calls update -> evaluate -> validated presentation -> completion -> ready.
   Live controls update without create/reset; paused time stays fixed. Capture
   returns expected same-target/provenance; errors produce no mislabeled new frame.
   Add partial/failure counters for create rejection, malformed instance, update/
   evaluate/reset rejection, authored dispose rejection, owned cleanup rejection
   and repeated terminal notifications. Validate original error retention and
   independent cleanup attempts; forced worker termination is reported separately
   from graceful cleanup and must not assert authored disposal occurred.
6. Run adversarial post-import checks: mutate Object/Reflect/JSON/WeakMap globals
   in authored setup; descriptor comparisons/private ownership still reject false
   metadata/tokens without getters. This test covers only the bridge's validation
   captures, not comprehensive protection against all same-realm prototype changes.
7. Add regression tests that ordinary Studio rejects 0.3 before clone/compile/job
   mutation, existing scene readers reject it, and transport/export readers reject
   well-formed v4 before generic fallback/staging. Exercise freshly rebuilt shared
   policy (which accepts v4 structurally) and source-policy fallback so a stale
   generated file cannot mask the missing reader guard. Public capabilities/
   discovery remain 0.1/0.2, legacy
   compile/worker/load/control/asset paths still pass, and no installed files change.
8. Run focused suites below plus typecheck, independently review contract and
   implementation, then coordinator integrates. CPU-only completion statement:
   “New internal component profile compiles/links and executes through the real
   worker entry with fake GPU resources; public authoring/actual GPU support is
   pending C04.” Actual graphics QA requires a reserved coordinator slot.

Suggested commands (use exact new filenames, not unexpanded tool-argument globs):

```text
node --test tests/compiler/component-api.test.mjs tests/compiler/component-declarations.test.mjs tests/compiler/component-identity.test.mjs tests/compiler/component-compiler.test.mjs tests/runtime/component-single-image.test.ts
node --experimental-vm-modules --test tests/studio/component-worker.test.mjs tests/studio/visual-worker.test.mjs
node --test tests/compiler/sdk-v2.test.mjs tests/compiler/parameter-identity.test.mjs tests/compiler/parameter-compiler.test.mjs tests/compiler/link-runtime.test.mjs tests/compiler/required-image.test.mjs
node --test tests/unit/transport-release.test.mjs tests/unit/export-package.test.mjs tests/unit/parameter-export.test.mjs
node --test tests/project/contracts.test.ts
pnpm typecheck
```

Select actual scene/Studio admission regression files after locating their
existing test owners; preserve the current CPU Studio suite invocation. Re-running
all graphics/host/performance gates is not required for this internal slice.
