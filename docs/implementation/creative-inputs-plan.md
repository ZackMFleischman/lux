# Creative Controls and Inputs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans when the coordinator dispatches an approved implementation slice. This document authorizes no worker launch itself. Steps use checkboxes for execution tracking.

**Goal:** Let authors experiment through declared controls, audio/MIDI response, modulation, macros and named Looks while preserving independent Studio and host execution.

**Architecture:** Build a pure numeric mapping evaluator first, then add explicit time/event state and adapters to the existing runtime owner. Scene/Look content stores creative intent; filesystem transactions remain the sole persistence authority and machine preferences hold physical device bindings. Host-published controls retain host authority and receive a separately versioned event transport when supported.

**Tech Stack:** Existing JavaScript ESM plus `.d.mts` policy modules, TypeScript, Node built-in tests, Electron/React Studio, existing native FFGL transport. No new dependency for I01.

**Spec:** [requirements](../requirements.md) T11/S02/S03/S04/U09; [roadmap](roadmap.md) workstream 3 and milestones 0.3/4; [runtime](../design/runtime.md#clock-scheduling-and-bounds); [Studio inputs](../design/studio.md#inputs-source-analysis-mapping); [project model](../design/project-model.md); [components](../design/components.md); [filesystem projects](../design/filesystem-projects.md).

## Status and authority

Plan revision **2**, revised after independent critique under **LUX-9 spec revision 2**. Baseline is `f95f3975892bf612bb63b94111893b18b84fff20`, worktree `C:/Users/zFlei/repos/lux/.worktrees/creative-inputs-plan`, branch `codex/creative-inputs-plan`. The parent task's 13 September 2026 UTC grant extends work to all four lanes and delegates routine choices while the user sleeps. Baseline roadmap language pausing lanes 3/4 predates that amendment. Root records the amendment in its orchestration documents; this plan does not silently rewrite historical authorization.

This ticket produces a plan and a next-leaf proposal, not application code. First-slice implementation requires the fresh independent critique and root dispatch. Later slices are ordered design envelopes, each needing its own current-code patch plan/review before dispatch; their file reservations are coordination requirements, not claims that those files or APIs already exist. No graphics, merge or push belongs to LUX-9.

## Global constraints

- Visual parameters belong to each visual's code. `intensity` is optional; no evaluator, mapping, Look or provider adds it implicitly. Keep number/live schemas, existing schema hashes, declaration order, valid ranges and nonquantizing `step` behavior unchanged.
- Keep application IDs and runtime identity with their canonical owners. A target uses stable scene ID plus structured UUID `nodePath` and declared `controlId`; labels, file paths, array positions and concatenated node strings are never addresses.
- Use one runtime owner/clock per instance; presentation panels are subscribers. Studio changes cannot mutate a host instance or installed release. Captures report actually applied effective values and sequence, never a requested value pasted onto old pixels.
- Source/Look edits are saved revisions; live input state is transient. Open control gestures cannot be silently included in unrelated apply/Look/save operations. Schema/units/range incompatibility reports migration; never silently clamp saved intent.
- [Filesystem architecture](../design/filesystem-projects.md) supersedes the older project-model projection description: working files are user-owned, explicit stage/apply freezes a complete candidate, durable acceptance does not rewrite them. Reuse authorized root sessions, project/revision guards and its one writer.
- All physical device IDs, permissions, monitoring output/gain and OS routing remain machine-local. Portable content keeps logical source names and creative response settings. Missing devices remain unresolved; never substitute another device automatically.
- Studio device capture is not an FFGL input contract. Resolume audio modulation and mapped controls are the 0.3 host path. No assumption that raw buffers, spectra or raw MIDI reach Lux through FFGL.
- Numeric control compatibility, installed-source offline behavior and existing performance gates continue to apply. Later event/control features require explicit version/capability admission rather than widening legacy schemas.
- Update `skills/lux-visual-creation/` in the same slice as author-visible SDK, parameters or MCP changes, then run `node scripts/install-visual-skill.mjs` and `node scripts/install-visual-skill.mjs --check`. I01 is internal and changes no shipped authoring capability, so needs no skill update.
- CPU work may run concurrently. Root serializes all Studio/GPU/Resolume tests and main integration. Dependencies are pinned by root package metadata: Node `24.12.0`, pnpm `10.33.0`. Do not install dependencies just to read or validate this plan.

## Current-code evidence, distinct from requirements

All observations below are from the baseline commit, not unmerged C02 work. Recheck after integration before opening a dependent slice.

| Observed source | Actual behavior and planning consequence |
| --- | --- |
| `packages/runtime-contracts/src/parameters.mjs` and `parameters.d.mts`; `tests/unit/parameters.test.mjs` | Browser-compatible number/live normalization, strict own data properties, 32-control bound, canonical schema JSON, finite ranges, nonquantizing patches, migration reports; empty declarations supported. I01 imports these helpers read-only instead of maintaining a rival numeric schema. |
| `apps/studio/src/controls/control-state.ts` | Saved snapshot contains source/schema hashes, schema and values; legacy intensity fallback is isolated from SDK 0.2 declared controls. Preserve both paths. |
| `apps/studio/src/controls/worker-control-state.mjs` | Full snapshot validation, monotonically increasing sequence and schema check; preparation captures operations before authored code executes. An inputs adapter must preserve that hostile-code boundary and cannot merely call new policy helpers after authored code import. |
| `apps/studio/src/visual-worker.mjs` | Frame context has current controls and a frozen empty events array. Existing clock/worker updates are real; a proposed runtime instance class is not present. |
| `packages/runtime/src/clock.ts` | Injected nonnegative nondecreasing monotonic milliseconds, play/pause/reset and epoch; no fixed-step accumulator, catch-up/drop accounting or event stream. Add those explicitly in I03 without creating a second timer. |
| `packages/visual-sdk/src/sdk-v2.ts` | `FrameContext.events` is `readonly never[]`; only numeric/live controls. Event delivery needs a new versioned capability, not casts that pretend the current SDK supports events. |
| `packages/runtime-contracts/src/index.ts` | Legacy intensity DTO coexists with parameter artifact v3 and numeric control schemas. C02 owns additive internal profiles here; I01 does not edit this file. |
| `native/texture-bridge/include/host_control_snapshot_v4.h` | Generation-paired continuous snapshot, count/schema identity, normalized float values and sequence; it is not an event queue and can coalesce values. Repeated notes must not be inferred from polling this snapshot. |
| `packages/core/src/project/contracts.ts` | Strict project/scene schema version 1, saved numeric controls, SDK/package pins and stable entities; no accepted Look/mapping field. I07 must version readers and closures jointly with the filesystem/component owners. |
| `packages/core/src/scene-document.ts` | Portable scene formats 1/2 and parameter format 3 preserve numeric snapshots, source/settings. They cannot currently serialize Looks or richer inputs. Unsupported export must fail visibly until a versioned format exists. |
| `docs/design/components.md` and `docs/implementation/components-plan.md` | Planned node paths are UUID arrays, scene node controls retain existing snapshot policy, host publication maps public IDs to node targets, and scheduler uses the existing clock. C01 metadata is integrated; node execution/control integration is not implied by declarations. |

An initial lookup of proposed `packages/runtime/src/instance.ts` failed; the actual directory contains `clock.ts` and `seed.ts`. This is recorded as LUX-P3. No runtime implementation is attributed to that proposed path.

## Design decisions and alternatives

**Choose pure evaluation before provider/UI wiring.** I01 has no device, clock, worker, compiler or filesystem dependency. It gives later adapters one tested arithmetic and authority boundary and can be independently reviewed while C02/native work proceeds. An alternative starting with the Inputs panel would require temporary runtime/provider semantics and collide with Studio ownership. Starting with host event transport would block on native event capability and real-host evidence before delivering a reusable CPU foundation.

**Choose explicit ordered transforms rather than a free-form modulation graph.** Base/Look value → macro bindings → modulation bindings → declared output clamp matches the Studio design. A macro is a named numeric source that can feed multiple bindings, not another control type or recursive graph. No macro-to-macro cycle or implicit modulation feedback. General graph signals can later feed this same normalized source interface through the component scheduler.

**Choose target resolution before evaluation.** The filesystem/component/core adapter resolves authored references against the exact accepted revision and supplies the declared control definition to the evaluator. I01 validates arithmetic and target uniqueness; it does not decide whether a UUID belongs to a project or grant edits because a target exists. This avoids a second scene registry and preserves root-session isolation across Git clones.

## Ordered whole-lane slices

| Slice | Deliverable, dependencies and owned boundary | Acceptance before claiming that deliverable |
| --- | --- | --- |
| **I01 — pure numeric mapping policy** | Detailed below. New `packages/inputs/src/{mapping.mjs,mapping.d.mts}` plus two new tests only. Imports existing parameters read-only. No dependency on unmerged C02 or native filesystem. | Exact arithmetic/order/clamp/authority, strict admission, detached frozen output, structured target collision tests, unchanged parameter regressions. CPU only; no runtime/UI claim. |
| **I02 — deterministic input timeline** | After I01. New `packages/inputs/src/{timeline.mjs,timeline.d.mts,replay.mjs,replay.d.mts}` and dedicated unit tests, plus an explicitly owned versioned extension of `mapping.mjs`/`mapping.d.mts` and their focused tests. Keep the I01 version-1 entry points unchanged; add a timed version-2 evaluator with per-binding smoothing state after shared shaping and before combination. No transport/SDK edit in this slice. | Identical fixture hash/seed and tick intervals reproduce equal values and ordered event IDs; repeated notes retain multiplicity; reset/reconnect flush stale data; limits/drop counters exercised; smoothing partition invariance for the identical held or piecewise input trajectory within numeric tolerance; same-source bindings with different nonlinear curves and smoothing constants remain independent. |
| **I03 — fixed steps and runtime adapter** | After I02 and integrated C02, with reliability/runtime owner agreement. Proposed new `packages/runtime/src/fixed-step.ts`, `packages/inputs/src/runtime-adapter.ts`; jointly owned changes in clock/worker/protocol and captures. Freeze exact versioned message schema before touching reserved files. | 1/60-second simulation, max four live catch-up steps plus exact discarded-time counter; controlled mode executes every intermediate step under deadline; pause/redraw versus step distinguished; current generation/epoch/sequence guards; fake-host CPU tests plus serialized visible stateful fixture. |
| **I04 — host audio/MIDI and events** | After I03 and a CPU-only native capability investigation under bridge ownership. Continue continuous numeric schema/index path; add separate bounded event transport only if actual host delivers events. Joint versioned native/protocol/SDK/release changes; no reuse of continuous snapshot for notes. | Actual Resolume audio modulation + MIDI knob, repeated 20 events/sec for 10 seconds → 200 exact delivered events in order; include sent/received/applied/consumed counts, stale-generation rejection and latency measurement. If host cannot provide event ingress, record missing capability and block event acceptance; continuous success cannot certify triggers. |
| **I05 — Studio sources and analysis** | I02 permits independent CPU lifecycle/analysis work. Proposed `packages/inputs/src/{sources,analysis,lifecycle,midi,signals}.ts`, focused tests; `signals.ts` owns deterministic tempo/phase, LFO and curve producers; Studio adapter/permission preload changes require entry-point reservation. | Known time-domain RMS and spectra/onset fixtures; tempo/phase, LFO and curve known-answer/reset/replay fixtures; MIDI decode/repetition; fake source denial/hotplug/start-stop races; actual device negotiated settings; late-start cannot resurrect source, one listener per active source, cleanup and monitoring OFF invariants. |
| **I06 — Studio mapping and macros UI** | I01/I02/I03/I05, plus component target operation and SDK capability available. Proposed `apps/studio/src/inputs/{InputsPanel,MappingRows,InputStatus}.tsx`, `apps/studio/src/preferences/DeviceBindings.ts`; coordinate registry/renderer/MCP/Inspector edits. | Base/macro/modulation/clamp/effective values and authority visible; explicit source binding and Learn per row; missing target/source visible; live gesture round trip; moving/closing panel creates no provider/runtime duplicate. UI and MCP use the same operations. |
| **I07 — saved creative state and Looks** | Pure schema work may start after I01, but persistence requires filesystem transaction service and component scene/target schemas integrated. Proposed `packages/core/src/project/creative-state.ts` and `apps/studio/src/looks/LooksPanel.tsx`; coordinated versioned project readers, inventory/closure/export adapters. | Two Looks recall controls, seed, macros and modulation into the same selected instance; no dual continuous renders. Explicit saved gesture/apply conflicts, rename-stable targets, clone-root session isolation, crash/Git reconciliation and incompatible-schema migration preserving old intent. |
| **I08 — replay, step and inspection UX** | I02/I03/I06/I07 and capture owner agreement. Extend existing playback/capture adapters and source selector; add repeatable recorded/synthetic source fixture assets. | Paused step advances exactly one declared interval, consumes each current-epoch event once, remains paused, records input mode/hash/snapshot and leaves host unaffected. Capture 0/500/1000 ms includes actual intermediate state; same seed/fixture replay repeatable within declared CPU/GPU tolerance. |
| **I09 — release compatibility and combined gate** | I04/I07/I08 plus installed release owners. Proposed `apps/studio/src/release/InputCompatibilityReport.tsx`; jointly version release closure/capability readers and portable formats. | Each mapping classified supported internal / host setup required / unsupported; no silent device transfer or double audio response; preserved exact Look/source/asset bytes and pins; installed offline cold reopen, independent copies, host controls and repeated notes; retained numerical host gates measured by reliability lane. |

I05 CPU analysis can follow I02 without waiting for I04 hardware. I07 cannot invent a persistence store while native/service work is incomplete. I09 is not a prerequisite of I01–I02. Root creates/dispatches one bounded leaf at a time within real capacity; this table is not an instruction to launch nine workers.

## I01 concrete first patch plan

**Purpose:** Resolve a trusted numeric target catalogue, a complete authored base snapshot, an ordered mapping configuration and a current finite source snapshot into explainable effective values. Admission never executes generated source. This module is not yet wired into Studio, exported packages or the runtime worker.

**Files (exclusive I01 ownership):**

- Create `packages/inputs/src/mapping.mjs`: strict pure input normalization and evaluation, no timers/global mutable state or side effects.
- Create `packages/inputs/src/mapping.d.mts`: the exact declarations below, importing `NumberControlDefinition` from `../../runtime-contracts/src/parameters.mjs` by type only.
- Create `tests/unit/input-mapping.test.mjs`: arithmetic/order/authority/missing-source and parameter parity cases.
- Create `tests/unit/input-mapping-admission.test.mjs`: hostile/invalid data, limits, structured target identity, isolation and finite intermediate overflow cases.

Do not edit package manifests, lockfile, shared test runner, `parameters.*`, `runtime-contracts/src/index.ts`, SDK/compiler/linker, `visual-worker.mjs`, authored-worker assets, standalone-client, transport/release profiles, `project/contracts.ts`, native files, or other lanes' documents. Node discovers these `.test.mjs` files through the existing root unit glob. Any newly discovered necessary edit outside the four files is a coordinator decision before implementing it.

### I01 interface contract, internal version 1

These types describe local policy data, not public runtime/MCP/wire DTOs or newly allocated identity brands. They are converted at adapter boundaries in later slices. Current component IDs are resolved by the component owner; there is no new component target registry here.

```ts
import type { NumberControlDefinition } from '../../runtime-contracts/src/parameters.mjs';

export type InputTarget = Readonly<{
  sceneId: string;                 // lower-case canonical UUID
  nodePath: readonly string[];     // canonical UUIDs; [] means the scene public control
  controlId: string;               // exactly the existing declared number/live ID
}>;
export type ResolvedInputTarget = Readonly<{
  target: InputTarget;
  definition: NumberControlDefinition; // definition.id must equal target.controlId
}>;
export type InputValue = Readonly<{ target: InputTarget; value: number }>;
export type SourceRef = Readonly<{ sourceId: string; signalId: string }>;
export type SignalValue = Readonly<{ source: SourceRef; value: number }>;
export type NumericBinding = Readonly<{
  id: string;                     // stable canonical UUID, assigned by content owner
  phase: 'macro' | 'modulation';
  source: SourceRef;
  target: InputTarget;
  inputMin: number; inputMax: number;
  outputMin: number; outputMax: number;
  exponent: number; invert: boolean;
  mode: 'replace' | 'add' | 'multiply';
  enabled: boolean;
}>;
export type NumericMappingPlan = Readonly<{
  version: 1;
  targets: readonly ResolvedInputTarget[];
  bindings: readonly NumericBinding[];
}>;
export type MappingFrame = Readonly<{
  authority: 'studio' | 'host';
  base: readonly InputValue[];
  signals: readonly SignalValue[];
  hostValues: readonly InputValue[];
}>;
export type BindingTrace = Readonly<{
  bindingId: string;
  phase: 'macro' | 'modulation';
  status: 'applied' | 'disabled' | 'unresolved-source' | 'host-owned';
  before: number; mapped: number | null; after: number;
}>;
export type TargetTrace = Readonly<{
  target: InputTarget; authority: 'studio' | 'host';
  base: number; afterMacros: number; beforeClamp: number;
  effective: number; clamped: boolean;
  bindings: readonly BindingTrace[];
}>;
export type MappingResult = Readonly<{
  version: 1;
  values: readonly InputValue[];
  traces: readonly TargetTrace[];
}>;
export function normalizeNumericMappingPlan(input: unknown): NumericMappingPlan;
export function evaluateNumericMappings(plan: NumericMappingPlan, frame: MappingFrame): MappingResult;
// Both entry points validate their arguments as data at runtime; readonly is not trust.
export const inputMappingLimits: Readonly<{
  targets: 256; bindings: 256; sources: 256; nodeDepth: 8; metadataBytes: 262144;
}>;
```

**Data/admission rules:** Plain records (Object or null prototype), dense ordinary arrays, own enumerable data descriptors, exact fields, no symbols/accessors/custom prototypes/sparse arrays. Reject before dereferencing accessor values. Canonical UUID syntax is lower-case 8-4-4-4-12 hex with RFC variant/version checked consistently with the repository UUID admission; no new ID allocation or file operations. `sourceId`/`signalId` use the existing control-ID grammar/reserved-key rejection (1–64 ASCII characters). Structured equality compares scene ID, every node UUID and control ID; a length-delimited tuple encoding such as `JSON.stringify([sceneId,nodePath,controlId])` is permitted internally after normalization. Never expose that encoding as an authored address.

At most 256 targets/bindings/distinct source references per evaluation, depth 8. Each target definition passes the existing `normalizeControlSchema([definition])`; count is per resolved catalogue, so 256 targets does not widen a component's existing 32-control declaration limit. The adapter must already have enforced per-component bounds. Reject duplicate targets, duplicate binding UUIDs, bindings to absent targets, mismatched definition IDs, unknown phase/mode, unknown version/fields and empty or excessive source IDs. A plan with no targets/bindings is valid. Bound each input plan/frame to 256 KiB UTF-8 *after descriptor-safe bounded traversal*; check counts/depth/string lengths before cloning/encoding to avoid allocation on unbounded input. Count bounds apply even to unused/disabled data.

`base` must contain exactly one valid, in-range number per target; no extras/missing/duplicates/default insertion. Reuse `validateControlSnapshot` for the one-definition value check, or enforce identical semantics after shared definition normalization. All signals are finite; duplicate source tuples fail even if unused. `hostValues` is empty in Studio authority; under host authority it is a unique valid in-range subset of catalogue targets. That subset identifies published controls; those targets require no Studio signal and bypass all competing bindings. Targets outside the subset are internal release targets and can use explicit supplied internal mappings, never machine Studio capture. Later adapters prove that provenance; I01 cannot.

Source values may lie outside a binding's input range: normalize and clamp the signal deliberately. `inputMin < inputMax`, finite nonzero span; `outputMin <= outputMax` with finite span (equal gives a constant); `exponent` in [0.125,8]. Invert is explicit; use it rather than reversed ranges. All intermediate arithmetic must remain finite; reject the whole result on overflow with `code: 'INVALID_INPUT_MAPPING'` and a bounded `path`. Never return partially applied targets. Normalize negative zero. Preserve input order in target/results, preserve binding array order within each phase, and execute all macro bindings before all modulation bindings. IDs are identity, not lexical execution order. Freeze detached normalized plans and results recursively; mutation of caller data must not affect previous results. Do not promise safe execution in a process whose intrinsics have already been modified by generated code.

### I01 evaluation semantics

For each target start from its validated base. If it has a host value, effective value is that value, `afterMacros`/`beforeClamp` equal it, `clamped=false`, and each binding trace is `host-owned` with `mapped=null` and unchanged before/after. `base` remains visible as authored intent. Otherwise visit enabled macro bindings then enabled modulation bindings:

```js
const unit = Math.max(0, Math.min(1, (sample - inputMin) / (inputMax - inputMin)));
const shaped = (invert ? 1 - unit : unit) ** exponent;
const mapped = outputMin + (outputMax - outputMin) * shaped;
const next = mode === 'replace' ? mapped : mode === 'add' ? current + mapped : current * mapped;
// Reject nonfinite intermediate arithmetic; do not conceal it with final clamp.
```

Check subtraction/division intermediates too: finite operands can overflow (`sample - inputMin`). Reject rather than accidentally interpreting infinity as a legitimate saturated signal. Disabled or missing-source bindings keep the running value unchanged, `mapped=null`, and get an explicit status; a missing source never substitutes zero, the last device value or another device. Record `afterMacros`, then `beforeClamp`, then clamp once to the declared target min/max and report `clamped`. `step` is UI affordance, not quantization. Add units are target units; multiply factors are dimensionless; replace outputs are target units. This explicit mode defines interpretation, rather than claiming arbitrary source units are automatically convertible. No smoothing, timestamps, events, random numbers or hidden cache in I01.

### I01 executable sequence

- [ ] **Step 1 — confirm boundary:** Record fresh isolated checkout/branch/start SHA, current plan revision and reviewer disposition; inspect four proposed paths for collisions and reserved files in the current root orchestration checkpoint. Verify pinned Node with `& 'C:/Program Files/nodejs/node.exe' --version` (expect `v24.12.0`). Do not substitute PATH Node/pnpm silently.
- [ ] **Step 2 — add behavioral tests first:** Create the two test files importing the missing `mapping.mjs`. Use built-in `node:test`/`node:assert/strict`, with actual fixtures and expected values below. Keep test expectations independent of evaluator implementation. Run the exact focused command and retain the missing-module failure as the red precondition.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNumericMappingPlan, evaluateNumericMappings } from '../../packages/inputs/src/mapping.mjs';
const target = { sceneId:'11111111-1111-4111-8111-111111111111', nodePath:[], controlId:'height' };
const definition = { id:'height', type:'number', label:'Height', default:2, min:0, max:10, changeCost:'live', step:1 };
const source = { sourceId:'music', signalId:'level' };
const bind = (id, phase, mode, outputMin, outputMax) => ({
  id, phase, source, target, inputMin:0, inputMax:1, outputMin, outputMax,
  exponent:1, invert:false, mode, enabled:true,
});
test('phase order is explicit and step does not quantize the result', () => {
  const plan = normalizeNumericMappingPlan({ version:1, targets:[{target,definition}], bindings:[
    bind('33333333-3333-4333-8333-333333333333','modulation','multiply',1,2),
    bind('22222222-2222-4222-8222-222222222222','macro','add',0,2),
  ] });
  const result = evaluateNumericMappings(plan, {authority:'studio',base:[{target,value:2}],signals:[{source,value:0.5}],hostValues:[]});
  assert.equal(result.values[0].value, 4.5); // (2 + 1) * 1.5
  assert.equal(result.traces[0].afterMacros, 3);
  assert.equal(result.traces[0].beforeClamp, 4.5);
  assert.equal(result.traces[0].clamped, false);
  assert.deepEqual(result.traces[0].bindings.map(x=>x.phase), ['macro','modulation']);
});
```

- [ ] **Step 3 — complete independent acceptance cases:** Include exact cases in the table below, including getter counters and snapshots of unchanged inputs. Run tests and retain the red output before implementing policy.
- [ ] **Step 4 — implement strict admission and declarations:** Add the two mapping files with the interface above; reuse parameter normalization. Validate own descriptors before values, cap traversal, normalize detached data, retain structured target identity. Include one typed usage fixture through the repository's existing typecheck only if already covered by its include pattern; do not modify shared typeconfigs without coordination.
- [ ] **Step 5 — implement pure evaluation:** Use the specified two-phase order and formula, explicit host bypass, trace statuses and final clamp; reject whole-frame arithmetic failure. Return detached deeply frozen values/traces.
- [ ] **Step 6 — run focused tests and existing parameter regressions:** Execute the command below and retain actual pass/fail counts at the exact source commit. No dependencies/GPU required. Fix only in-scope failures; report unrelated failures with evidence.
- [ ] **Step 7 — verify and commit:** Run `git diff --check`, inspect changed-file list against four-file ownership, and commit only those files. Submit exact commit, red/green outputs, criterion coverage and remaining runtime/host checks for a fresh independent code reviewer. Root integrates only after review; this worker does not merge/push.

```powershell
& 'C:/Program Files/nodejs/node.exe' --test tests/unit/input-mapping.test.mjs tests/unit/input-mapping-admission.test.mjs tests/unit/parameters.test.mjs
git -C C:/Users/zFlei/repos/lux/.worktrees/creative-inputs-plan -c core.excludesFile= -c safe.directory=C:/Users/zFlei/repos/lux/.worktrees/creative-inputs-plan diff --check
```

The command's checkout is the planner checkout for illustration; the implementation worker must substitute its **own exact assigned worktree** in both `-C` and `safe.directory`, not trust this planner root globally. Typechecking after dependency availability uses root's pinned corepack/pnpm setup; passing the focused `.mjs` suite does not certify declarations or runtime integration.

| I01 criterion | Required setup and precise expected observation |
| --- | --- |
| A1 arithmetic/order | Above fixture gives 4.5. Two same-phase bindings `replace 4`, then `add 2` give 6; reverse array order gives 4. Target range [0,5], base 4, add 3 then multiply 0.5 gives 3.5 (no intermediate clamp). Add 3 alone gives effective 5, beforeClamp 7 and clamped=true. |
| A2 shaping and units | Range input [0,2], output [0,8], sample 1, exponent 2 gives 2; invert=true with sample 0.5 gives 4.5. Out-of-range finite sample saturates. Equal output endpoints produce constant. Step 1 leaves 4.5 unchanged. |
| A3 authority/unresolved | Host value 0.25 bypasses all mappings even with absent signal; trace authored base separately. Studio authority rejects nonempty hostValues. Missing source yields base and unresolved trace; disabled binding yields disabled trace. Host subset leaves other explicit internal targets evaluated independently. |
| A4 identity/isolation | Two UUID node paths with the same control ID retain independent values. Distinct scene IDs with identical node paths do not collide. Empty nodePath addresses scene public control. Duplicate exact target/binding/source IDs fail. Changing labels does not change target identity. |
| A5 numeric compatibility | Empty plan/frame yields empty frozen outputs, no intensity. Invalid/nonfinite/out-of-range base/host value rejects before application. Existing `parameters.test.mjs` remains passing and unchanged. Overflowing finite arithmetic fails atomically. |
| A6 hostile data/bounds | Unknown fields/version/type, accessors, symbols, custom prototypes, sparse arrays, prototype keys, malformed UUID/control/source IDs, depth9, 257th target/binding/source and payload byte limit fail; getter counter stays 0. Valid exact-bound inputs pass. Returned nested data is frozen and independent of later mutation. |

## Time, events and replay contract to freeze in I02–I04

These decisions constrain the later patch plans; I01 does not implement them. Keep runtime `{instanceId,generation}`, `clockEpoch`, accepted revision/schema and applied control sequence as outer guards supplied by their canonical owners. Logical source generation is independent and increases on stop/rebind/reconnect. Provider timestamps are translated once into the owner's monotonic domain with recorded calibration; wall time is informational. Never compare uncalibrated device timestamps with runtime time.

I02's version-1 source envelope includes logical source/signal identity, source generation, monotonic timestamp, safe integer sequence and payload kind (`continuous` or `event`). Events have unique sequence IDs and retain repeated equal note/velocity messages; sequence order is authoritative within a source. Runtime admission assigns one monotonic ingress sequence for cross-source order, records original timestamps, and rejects backward timestamps per source (ties allowed). Controlled replay serializes this admitted order so callback scheduling cannot change playback. Continuous samples may coalesce by source/signal; events never coalesce.

Initial engineering bounds: 256 queued events per instance, 32 events admitted per step, 100 ms maximum live lateness. Reject newest on overflow, count each rejection, never silently evict older accepted events. Late events beyond 100 ms are dropped with reason/count; remaining events execute on the next eligible step in ingress order. If draining 32 would leave events beyond the lateness bound, they become explicit late drops on the next drain. Normal 20/sec acceptance must have zero drops. Controlled replay has no live lateness discard: apply events in `(previousTime,nextTime]`, with a separately defined time-zero initialization batch consumed once, and fail the bounded capture job rather than silently drop required steps/events. Test the zero boundary, equality at the next boundary and repeated step calls explicitly.

On reset/restart/owner or source generation change: discard queued obsolete events, clear held-note state and smoothing state, retain accepted seed/current owner-authoritative continuous controls. Reconnect starts a fresh source generation with no stale analysis value; mappings persist unresolved until new samples. Continuous signal freshness uses a declared provider timeout (initial 500 ms) so a disconnected source cannot hold the last live value forever. These bounds are proposed admission policies to validate, not measured host capability or latency evidence.

**I02 mapping extension ownership:** I02 explicitly owns changes to `mapping.mjs`, `mapping.d.mts` and their tests alongside timeline/replay. It preserves I01's version-1 normalizer/evaluator and stateless arithmetic. Before implementation, freeze a separate version-2 timed-plan/evaluation API that stores smoothing constants per binding and accepts/returns detached state keyed by binding UUID, normalized plan identity, source generation and evaluation epoch. Factor shaping and combination inside the mapping owner so both evaluators reuse the same range/curve/mode policy; timeline code must neither reimplement that math nor squeeze differently smoothed bindings into one per-source `SignalValue`. The timed evaluator receives explicit evaluation delta and state, never a second clock or hidden process cache. Failed admission or arithmetic leaves prior state unchanged; changed binding/plan identity, reset, source generation and declared disconnect policy invalidate corresponding state. A version-2 result exposes each binding's shaped and smoothed contribution for trace/replay; it is not a silent widening of I01 version 1. Exact DTOs and bounds receive the I02 slice review before coding.

I02 acceptance includes two bindings sharing one source but using different nonlinear exponents and different tau values, proving their independently computed post-shape smoothing and downstream contribution. Replay must reproduce those separate states. Interval partition comparisons hold the same piecewise-constant input trajectory and include its change boundaries; arbitrary different sample trajectories are not expected to give identical smoothing.

Smoothing is per binding, after range/curve mapping and before replace/add/multiply: `next = previous + (mapped - previous) * (1 - exp(-dt/tau))`, `tau=0` means no smoothing, first valid sample initializes to mapped, reset/disconnect clears history. Use animation-step delta for replay/simulation, and an explicitly recorded monotonic input-evaluation delta for paused live presentation. Never advance simulation because an input changed while paused. Test equivalent interval partitioning and zero-delta behavior; smoothing is disabled for latency acceptance.

I03 adds fixed-step state without replacing `RuntimeClock`: accumulate elapsed animation time, consume 1/60-second intervals, at most four per live tick, drop only whole excess steps while retaining fractional remainder, record discarded seconds and counters. Controlled advance executes all required steps within the job deadline. I03 must specify how event intervals align with dropped time so skipped live intervals produce declared late/drop results rather than a burst with false timestamps. Step requires paused authority, increments tick/time exactly one declared interval, preserves revision/generation/clock epoch and returns a newly completed frame. Frozen-time redraw has zero simulation delta and consumes no simulation events; explicit step consumes queued current-epoch events once.

Event SDK and host transport versions are separate from numeric mapping version 1. I04's investigation must inspect the actual FFGL setter/event APIs and real host delivery before choosing a trigger type. A pulse in a continuous float sampled once per frame cannot prove two identical notes were received. If no supported repeated-event channel exists, use a blocked capability follow-up; do not call host tests passed from synthetic runtime injection alone.

## I05 deterministic tempo, LFO and curve signals

I05's pure `signals.ts` producer supplies tempo/beat phase, periodic LFOs and authored curves through the same logical source/signal envelope as device analysis (S02 and Studio Analysis requirements). It consumes the owner's declared monotonic simulation/replay time and reset epoch, never wall time or its own timer. Live tempo tracking may estimate BPM/phase from actual input only with separately reviewed evidence; deterministic configured tempo is a concrete supported fixture, not a claim of beat detection.

The I05 patch plan freezes bounds, waveform/curve schemas, time-zero, phase wrap and discontinuity behavior before implementation. Required known answers include configured 120 BPM: one beat every 0.5 seconds and phase 0.5 at 0.25 seconds; normalized sine LFO at 2 Hz: values 0.5/1/0.5/0 at times 0/0.125/0.25/0.375 seconds within declared tolerance; piecewise-linear curve [(0,0),(0.5,1),(1,0)] returns 0.5 at 0.25. Reject nonfinite tempo/rates/points, duplicate or unordered knots, oversized schemas and unsupported extrapolation. Reset to the same epoch/seed/fixture recreates phase and values; paused redraw versus explicit stepping follows I03 time semantics. Replay records exact producer configuration/curve bytes and version, and source-generation changes cannot reuse obsolete phase state.

I06 exposes tempo/phase/LFO/curve source selection and parameter/curve editing alongside audio/MIDI mappings. I07 persists their portable logical definitions and creative values with Looks through the filesystem owner, while physical device settings remain machine-local. I08 captures exact configuration, clock mode and phase/replay provenance. I09 classifies each producer as supported offline internal, host setup required or unsupported according to the installed runtime capability; no new source is silently dropped or represented as available before its implementation. These are later slices and do not expand I01's four-file boundary.

## Persistence and component interface handshakes

| Boundary | Owner and precise agreement required before integration |
| --- | --- |
| Target catalogue | Component/core owner resolves scene public targets (`nodePath=[]`) or placed node UUID paths to exact definition/schema hashes in an accepted revision. A runtime adapter adds canonical RuntimeKey, revision, epoch and expected schema/definition guards. Rename/reorder preserves target; duplicate/publish extraction returns an explicit ID remap. Deleted/incompatible targets stay visible in saved intent as migration needs. |
| Public host target | Component publication owner maps stable public control ID/index to `{nodePath,controlId}`. Inputs resolves any public/internal alias before checking host authority so a second path cannot apply Studio modulation to the same host-owned target. Continuous normalized host values are converted through the existing numeric host adapter exactly once. |
| Saved state | Filesystem owner versions scene/Look metadata and accepted closure; proposed creative state v1 holds scene ID, Looks with application-allocated IDs/names, seed, compatible base values, macros, logical sources, analysis settings and mappings. Current project/scene v1 fields are not widened silently. Exact reader version chosen jointly with component schema-v2 work; unsupported readers fail without deleting fields. |
| Write authority | Every saved mapping/Look operation uses authorized physical-root session plus expected project/scene heads and source-schema preconditions. Clones with the same logical project ID stay separate physical roots. No file path or `sceneId` alone grants access. No second `.lux` store, implicit watcher apply or auto-restored device connection. |
| Live versus saved | Editing base/macro/mapping inside a saved gesture is one undo step at completion; runtime samples never write disk. Source apply/Look recall during a dirty gesture reports a conflict unless caller explicitly finishes/cancels it. Look recall prepares values/modulation atomically; failed migration or runtime promotion preserves old working output and saved intent. |
| Looks and seed | A Look contains values/seed/modulation only; topology/code alternatives duplicate scenes. Compatible recall updates one existing instance, resetting simulation only for seed/reset-cost changes and disclosing that cost. Compare via retained stills or sequential recall; do not start two continuous producers. Historical values are preserved for migration rather than silently clamped. |
| Export | Release owner freezes selected Looks plus exact source/asset/dependency closure and supported internal signal/replay data. Classification lists each mapping/target and missing contract. OS devices/grants remain excluded. Host setup-required and unsupported mappings prevent claiming equivalent offline playback unless explicitly resolved. |

C02 owns `runtime-contracts/src/index.ts`, compiler/linker/SDK and `visual-worker.mjs` with control preparation and Studio CPU runner; LUX-7 owns native project files and filesystem adapter. I01 writes none. I03/I04 require a refreshed integrated baseline and a root-issued shared-file window. I07 waits for filesystem service semantics and C03+ graph metadata agreement; do not copy the same transaction implementation into inputs. Reliability owns measurement collection/profiling, while inputs supplies event/control identifiers and test stimuli; avoid two instrumentations counting different stages as the same latency.

## Validation and evidence contract

Every implementation/validation record names the exact worktree, branch, full tested commit, stable executor identity, fresh host context, runtime/build versions where relevant, setup evidence, command/stimulus, actual observation and raw artifact path. A passing CPU command does not prove a device, graphics or installed-host precondition. The independent validator has no implementation participation; root schedules that fresh context and final integration separately.

| Criterion group | Required setup/preconditions | Method / expected observation | Role and stage / artifact source |
| --- | --- | --- | --- |
| LUX-9 plan coverage | Read baseline sources, current ticket spec2 and root reservations; user amendment recorded | Trace T11/S02/S03/S04/U09 to I01–I09, verify first four files avoid active reservations, audit interface/time/authority/persistence consistency | Planner now: plan commit + source-read journal; fresh reviewer before implementation: critique tied to exact plan SHA/digest, findings/dispositions retained. |
| I01 A1–A6 | Pinned Node24.12.0, only four owned files, unchanged parameter helpers at recorded SHA | Focused command above; all explicit table cases pass with no application wiring | Implementer CPU then independent reviewer: `.superpowers/conductor/<leaf>/` red/green logs, diff/commit and criterion mapping. |
| I02 timeline/replay | Immutable fixture bytes/hash, seed, input intervals, source and runtime generations documented | Exact event IDs/order/count and numeric output across replay runs; drop reasons/limits exercised, no obsolete replay | CPU implementer/reviewer: fixture JSON, raw drains/evaluation results and assertions. |
| I03 simulation/step | Versioned runtime profile active, seeded stateful fixture, actual clock mode and step size recorded | CPU overload/paused tests; serialized renderer trace/capture proves new frames with correct tick/time/epoch/effective controls and intermediate steps | Runtime worker + graphics validator under root reservation: exact source bundle, capture metadata, raw frame/event traces. |
| I04 T11 host | Actual Resolume host/device/version, real FFGL ingress route, accepted event-capable release, 20/sec stimulus for10 s, distinct 200 sequences | All200 sent/received/applied/consumed matched in order; zero normal-load drops; reconnect/reset rejects stale bursts; actual MIDI knob/audio response | Host validator under graphics reservation: wiring/setup evidence, stimulus and native/runtime/consumption logs, not synthetic-only CPU injection. |
| I05 S02/U09 providers | Known PCM samples/window/channel policy, configured tempo/LFO/curve fixtures with exact time/epoch and target-system chosen devices/permission states | True RMS plus tempo/phase/LFO/curve known-answer and reset/replay tests; negotiated music settings; denial/disconnect/late start/retry; no duplicate listeners or implicit monitoring | CPU lifecycle reviewer then device validator: fake-service call logs, actual settings/status/cleanup and monitor-output observations. |
| I06 S03 authority/UX | Independent authoring/host instances, one provider session, mapped targets/macros | Display trace matches effective capture; host unchanged by Studio edits; Learn only chosen row, unresolved source preserved; panel move retains one producer | Studio/MCP reviewer: operation transcript, screenshots/captures and listener/instance counters. |
| I07 S04 persistence | Real filesystem service/version, two clone roots with same logical IDs, dirty gesture/Git conflict fixtures, incompatible target schema | Two Looks survive reopen; one instance; correct seed/reset; migration/conflict retains old intent; no cross-root write or silent live-state save | Filesystem + creative validator: transaction/raw file inventories, commit/reopen logs, runtime ID/seed/captures. |
| I08 controlled capture | Recorded immutable fixture/hash, paused authoring instance, independent host sentinel | 0/500/1000 ms provenance with real intermediate state, exact step/event consumption, host sentinel untouched | Capture validator: fixture, command logs and actual frames/metadata. |
| I09 offline/latency | Installed exact immutable release on supported host, Studio/dev tools/network absent, mapping compatibility resolved, smoothing disabled | Independent copies and cold reopen preserve Looks/controls; all600 normal-rate control samples matched, p95≤50 ms/p99≤100 ms per existing acceptance; event200/200 separately; no invented new throughput gate | Release/reliability validator: [tracer acceptance](tracer-acceptance.md) setup/clock calibration and raw sent/received/rendered/consumed counts, settings, installed identities and resource traces. |

Remaining whole-product release/soak budgets remain with reliability and milestone5; this lane must not certify them from unit tests. I01 can be accepted as a pure policy foundation with I02–I09 explicitly outstanding. Likewise an accepted plan is not a usable Inputs panel or verified host event path.

## Next leaf ticket proposal

**Title:** Implement pure numeric creative mapping policy (I01).

**Parent:** LUX-4 creative controls/inputs lane. **Dependencies:** LUX-9 independently reviewed current plan; no technical dependency on LUX-7/LUX-8 for the four-file boundary. Root checks current names/paths before creating the leaf and attaches any revised plan disposition.

**Scope:** Exactly the four I01 files, local policy version1 interfaces and A1–A6 behavior above, no application integration. **Acceptance:** A1–A6 pass with pinned Node, unchanged parameter regressions; red/green logs and declaration/interface audit; no edit outside reserved files; exact source commit submitted for independent review. **Non-goals:** providers/UI/SDK/events/clocks/persistence/export wiring, graphics, merge/push. **Delivery:** one reviewed worktree commit; root serializes integration and records combined validation. Do not open/claim this leaf from the LUX-9 worker session.

## Plan review ledger

- Revision1: planner source audit and self-review complete; independent critique is requested from root in a fresh context before implementation dispatch. Findings and dispositions must be appended with reviewer context, exact reviewed SHA/digest and resulting revision; no independent approval is claimed in this initial artifact.
- Self-review coverage: T11→I02/I03/I04/I09; S02→I01/I02/I05/I06/I08; S03→I01/I04/I06/I09; S04→I07; U09→I05/I07/I09. Fixed-step versus presentation, repeated-event multiplicity, optional intensity, host alias authority, clone roots and schema migration have explicit contracts. Later reserved-file names are proposals subject to owning-lane review, not implementation instructions outside the next leaf.

### Revision 2 disposition

Fresh reviewer `/root/inputs_plan_review` (stable e00b2f25-2206-4729-b632-a7b59e641774) rejected revision 1 at commit 61305e081ac3e9bba91055b93ec63912d43a718b with two P2 findings. The exact report is retained in the main checkout `.superpowers/conductor/reviews/LUX-9/round-1.md`; Conductor rejection event 7c55e4f1-7204-42aa-b663-bb15928eb37a preserves the decision.

- P2-1 resolved in revision 2: I02 explicitly owns a versioned mapping API/state extension, shared shaping/combination implementation and independent per-binding smoothing tests. Partition comparisons preserve the same input trajectory. I01 remains stateless and unchanged.
- P2-2 resolved in revision 2: I05 explicitly owns tempo/phase, LFO and curve producers with clock/reset/replay known answers, and I06-I09 cover UI, persistence, capture and export handoffs.

Overall coordinator performed this documentation synthesis under a new ordinary planning claim after the first planner submitted and stopped; no old managed worker claim was revived. Fresh focused recheck of the exact resulting commit is required before acceptance and I01 dispatch. The original findings and historical review-pending record above remain preserved.
