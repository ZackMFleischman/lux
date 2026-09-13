# Live input recording adapter implementation plan

> **For agentic workers:** Use `superpowers:executing-plans` for one assigned and independently reviewed leaf. Root owns fresh source review and serial integration. This plan does not launch an agent or authorize runtime recording.

**Goal:** Collect truthful input policy transcripts at the actual runtime owner, with a separate account of selected inputs, completed updates and completed output.

**Architecture:** First make the existing worker control owner reject stale prepared updates. Then establish the missing I03 input owner, trusted evaluation boundary and publication protocol. Only that integrated owner can support the I02c3b recorder. Storage and faithful live runtime replay remain separate leaves.

**Tech stack:** Existing JavaScript ESM, readonly `.d.mts`, TypeScript 7.0.2, Node 24.12.0 and built-in CPU tests. No new dependency.

**Spec:** LUX-85 specification 2. Retained specification: `C:/Users/zFlei/repos/lux/docs/conductor-onboarding/live-recording-plan-spec.json`. Read the complete [creative inputs](creative-inputs-plan.md), [live timeline](live-input-timeline-plan.md), [controlled replay](controlled-replay-plan.md) and [accepted capture/import plan](live-input-capture-plan.md) with this document.

## Status and scope

This is candidate plan revision 1. No application source changed. No independent acceptance is claimed.

The recording adapter is **not ready for source dispatch** at this baseline. No current runtime owner selects timeline state, mapping state and runtime input publication together. The first source leaf below is an explicit I03 prerequisite. It is not a reduced recording adapter or completion of I02c3b. Root must review and integrate that prerequisite, then prepare the remaining runtime owner protocol before dispatching a recorder.

| Identity | Value |
| --- | --- |
| Project | `34723eb7-f57d-45c3-8831-adcb2bbfe485` |
| Ticket | `LUX-85` / `2f5e3d5a-9740-464c-961c-62de5b729f26` |
| Base | `18e0e91686a3929d7bae34d5b85b34f6bb0fb2e3` |
| Checkout | `C:/Users/zFlei/repos/lux/.worktrees/live-recording-adapter-plan` |
| Branch | `codex/live-recording-adapter-plan` |
| Planner | `/root/live_recording_plan` |
| Stable identity | `f8141665-a024-4902-98f5-90727445c462` |
| Session | `08d980f9-0aa4-4245-80af-41e9ef86338a` |
| Claim | `14c8270f-4bcc-413d-8267-9c357d4a6cbe` |
| Evidence directory | `C:/Users/zFlei/repos/lux/.worktrees/_coordination/LUX-85` |

The accepted importer source is `2bd21901a2cf258e373811a91f1514dfb8699ab3`. LUX-82 integrated it at `c53c42fe0f1904cdd6372c985b5368ef6afba594`. The accepted capture plan is 40077 bytes. Its SHA-256 is `bf2bfa4db7a1f8a8c26f6d18f56da96a0c40e93246813ed617750b055b9f4535`.

Independent source evidence is in main `.worktrees/_coordination/reviews/LUX-76/review.md`. Main integration evidence is in `docs/conductor-onboarding/live-transcript-main-evidence.md` and `live-transcript-main-verification.json`. Their 206 CPU tests, strict declarations, both TypeScript configurations and reviewer probes establish the importer contract. They do not establish runtime recording. Those historical executors differ from this planner.

## Global constraints

- Keep the actual parameter schema and optional `intensity` behavior. Do not add an implicit global control.
- Preserve source authority, runtime generation, timeline epoch and clock epoch as separate scopes.
- Keep mapping math in `mapping.mjs`. Keep queue, lateness, coalescing and ingress policy in `timeline.mjs`.
- Keep `live-policy-transcript` version 1 distinct from `scripted`. Never change original timestamps to force scripted admission.
- Do not start another clock, scheduler, component runtime or filesystem writer.
- Do not implement provider acquisition, native processes, device bindings, persistence, playback, Studio/MCP/SDK capability or pixels in this planning ticket.
- The proposed first source leaf is internal. It changes no author-facing capability and requires no visual-creation skill publication. A later public boundary must update, install and check the repository skill.
- Root serializes shared source integration and graphics. LUX-7 stays policy-stopped. LUX-59 stays provenance-blocked. No native or physical gate is waived.

## What the actual owners observe

The complete affected control owner and its definition checker were read. The complete timeline, mapping and transcript owners were read. The complete Studio worker, standalone client, runtime operation boundary, clock, seed, authored module loader and linked identity verifier were read. `owners.json` records their exact bytes and hashes.

| Current source and call | Actual observation | Limit |
| --- | --- | --- |
| `packages/inputs/src/timeline.mjs`: `admitLiveInputs` | Returns each normalized original decision in call/array order, before loss of held continuous history. Rejections retain original reason. | Pure candidate. Rejected originals have no ingress or `receivedAtMs`. A thrown batch has no decisions. |
| Same file: `stepLiveInputs` | Returns candidate events, discards, held state and a mapping frame. | It does not evaluate mappings or publish to a runtime. |
| Same file: `changeLiveInputSources`, `resetLiveInputs` | Explicit source/reset discards and cleared state. | Source changes have no time argument. Reset time is not an observation sample. |
| `packages/inputs/src/mapping.mjs`: `evaluateTimedNumericMappings` | Validates complete base/host values and returns effective values, traces and new smoothing state. | A caller must select both policy states. This module explicitly requires use before authored code; it dynamically reads intrinsics. |
| `packages/inputs/src/live-transcript.mjs`: `normalizeLivePolicyTranscript` | Replays supplied operations through the actual owners and compares witnesses. | Local selection inside a verifier is not runtime publication or collection. |
| `apps/studio/src/controls/worker-control-state.mjs`: `prepareWorkerControlState` | Captures schema validation operations before authored import. `apply` selects complete numeric values and a sequence. | It owns no timeline, mapping, clock, RuntimeKey, receipt tape or frame. Current `apply` can overwrite a reentrant newer selection. |
| `apps/studio/src/visual-worker.mjs`: `initialize`, `onmessage`, `draw` | Owns a command chain, worker identity, clock, random stream, controls and actual update/render calls. | It never calls the input timeline or mapper. `FrameContext.events` is a frozen empty array. |
| Same file: controls command | Calls `controlState.apply(...)`, then `await draw(requestId, 'status')`. | Numeric selection occurs before authored update. An update/render failure is not an atomic rollback. |
| Same file: `draw` | Snapshots clock, increments tick as it invokes update, awaits update and render, then awaits queue completion. After running checks it assigns `lastTime`, increments frame and sends status. | Each stage is different. A returned policy event does not prove authored consumption. A completed update does not prove rendered pixels or parent receipt. |
| Same file: playback reset | Resets clock and random before awaiting `visual.reset`; later resets lastTime/tick and draws. | Failure can leave partial runtime changes. This cannot be described as an existing all-or-nothing input reset transaction. |
| Same file: capture | Reads the completed output target under the command chain and returns metadata. | No input operation/segment identity exists in that metadata. Adding requested values to it would not prove matching pixels. |
| `apps/studio/src/standalone-client.ts`: `start`, `invoke`, worker message handler | Allocates instance/generation, sends verified source/control initialization and desired control sequences; checks returned identity/schema/sequence and promotes a ready candidate. | Desired values are retained before worker acknowledgement. Parent receipt does not witness internal timeline/mapping commit. |
| `packages/runtime/src/clock.ts`, `seed.ts` | Runtime-owned injected monotonic clock and seeded stream. | No recorder, source calibration, shared input transaction or new-frame witness. |

The source search across `apps` and `packages` finds combined timeline/mapping calls only in policy helpers. There is no application input owner to attach today. The closest actual execution owner is the dedicated Studio worker. The standalone client is its outer identity and promotion owner. Neither alone currently witnesses the proposed joint commit.

The runtime's current `revisionId` is the source hash passed by `StandaloneClient.submit/start`. It is not a scene revision UUID. `RuntimeKey` has an instance UUID and generation in runtime contracts. Input targets require scene/node UUIDs. The preview client currently publishes `sceneName: 'Untitled visual'` without a scene ID. Do not derive an input target from that label, a source hash or an instance ID.

## Source-bound authority and trust prerequisites

| Required input | Existing authority | Missing connection and required evidence |
| --- | --- | --- |
| Runtime incarnation | Standalone `Running` object, allocated generation and worker reference; worker initialization identity | I03 must bind its private owner handle to the admitted worker incarnation and invalidate it on termination/replacement. A copied RuntimeKey is data, not that handle. |
| Executable and control definition | `verifyLinked`, `prepareAuthoredModule`, `prepareWorkerControlState.checkDefinition` | Record the exact admitted linked/source/schema identity and verified definition route. Legacy `moduleSource` compatibility has weaker linked provenance; do not label it verified-linked. The current prepared admission does not expose a complete linked/source receipt. |
| Target catalogue and mapping | Existing mapping normalizer; later accepted scene/component target resolver | Supply canonical scene/node targets from the accepted content owner and resolve host aliases before authority checks. There is no current saved mapping/publication authority in the preview path. |
| Seed | Validated `settings.seed`, `SeededRandom` owned in the worker | Segment admission must witness this selected seed. A supplied transcript seed or same random sequence is not proof of runtime selection. |
| Clock | Worker `RuntimeClock` and captured monotonic source | I03 must define input-domain calibration, animation/input time relation, clock epoch and observation-domain sampling. Null observation stays unknown. Never derive receipt time from animation time. |
| Source generations/configuration | I02b accepts caller-owned snapshots | No provider exists here. I05 or a separately admitted synthetic source owner must witness generation/calibration changes, exact analysis settings and conversions. IDs alone cannot prove acquisition. |
| Base and host values | Standalone desired/applied control snapshots; existing numeric schema helpers | Every policy step needs complete authored base and exact host-owned subset. This Studio path has no raw host-input authority. `authority:'host'` in a fixture cannot create one. |
| Commit and completed output | Worker command chain, running guards, update/render/barrier sequence; parent status receipt | Add an explicit source-owned operation identity and separate stage outcomes. No current caller-provided boolean or numeric sequence proves joint timeline/mapping/runtime publication. |

A policy call inside the authored worker after import violates the present mapping trust contract. Preparing only a normalized mapping in advance is insufficient: later frame/state admission and arithmetic still read mutable intrinsics. A future I03 design must choose a pristine policy realm or a separately reviewed prepared evaluator that captures every required operation before authored import. That design must also close hostile exceptions without reading foreign properties. The first control leaf below does not silently claim to solve this larger trust problem.

The shared transaction must refer to selected *input state*. It cannot promise rollback of arbitrary authored code. If authored `update` throws after mutation, stop the runtime operation, mark the recording incomplete and retain the last proven stage. Never rerun that update as if it had no effects. The same rule applies to reset, render rejection and device loss during an await.

## Bounded planning probes

`owner-probes.mjs` imports the exact checkout with `pathToFileURL`. It runs only existing pure timeline, mapping, transcript and control helpers. It does not load the worker, invoke an authored visual, render, play back, open devices or start a native process. Four assertion groups passed under Node `v24.12.0`. Full inputs/results are in `owner-probes-result.json`; stdout is in `owner-probes-output.txt`.

1. **Current control defect.** Start gain 0, sequence 0. Outer `apply` requests gain 0.25, sequence 1. A Proxy descriptor trap performs nested gain 0.75, sequence 2. The outer call returns gain 0.25, sequence 1. This is the observed defect, not a passing stale-guard implementation. The future regression must expect a stale outer rejection and preserve sequence 2.
2. **Candidate versus selection.** One accepted event is returned by a step whose base is missing. The real mapper throws `INVALID_INPUT_MAPPING`. The prior timeline still holds that event. A later valid step with base 0.5 returns it once. There was no runtime commit.
3. **Fabricated but consistent transcript.** The helper constructs a complete two-operation tape and encodes it successfully. It has one consumed policy event and a valid SHA-256. No provider or runtime ran. An incomplete one-operation prefix correctly lists pending `{epoch:0,ingress:0}`. This demonstrates why transcript consistency does not authenticate collection.
4. **Actual call order.** Pure control `apply` selects sequence 1. Read-only source assertions confirm that the real worker calls it before `await draw` and sends empty events to update. No visual execution was needed to establish this ordering.

The fabricated transcript hash is `bb1c40547141afdf358d46dbac8be753d1c803d16ac5c973a0cc8713ec476db4`. It identifies those helper-supplied bytes only.

## Delivery sequence without circular acceptance

| Stage | Deliverable and prerequisites | Acceptance boundary |
| --- | --- | --- |
| **I03-P1**, selected first source leaf | Harden the actual worker control selection owner with private prepared handles. Exact contract follows. Requires fresh review and integration of this plan and a root shared-file reservation. | Helper behavior and unchanged existing apply callers. It does not wait for recording or graphics acceptance. |
| **I03-P2**, separate runtime-owner plan and source leaf | After I03-P1 integration, freeze the actual input owner, content/clock/source authorities and trusted evaluation boundary. Own exact changes to `visual-worker.mjs`, `standalone-client.ts` and chosen policy boundary only after review. Define private selected timeline/mapping/control state, source/reset transactions and stage outcomes. | Source/CPU acceptance can cover fake-authority seams. Real runtime publication remains a separately evidenced gate. Do not invent the final API from this prerequisite document. |
| **I02c3b**, recorder leaf | After the integrated I03-P2 owner supplies the source-bound protocol below. Record actual owner calls and a contiguous prefix, with resource reservation before publication. | Bounded in-memory recording plus independent importer reconciliation. Supplied tape assembly alone is not recording acceptance. |
| **I02c3b storage** | After the recorder; use the existing filesystem authority and its reviewed append/close/flush contract. | Actual durable output, producer close/flush status and truncated/lost output evidence. No alternate store. |
| **I02c3c**, faithful live replay | After recorder format/protocol stabilization. Define live execution, seek/reset and separate runtime-epoch remapping. | Exact committed operation placement and all recorded dispositions. It does not use scripted timestamp windows. |
| **I03/I05/I08/I09 and reliability** | Runtime clock/fixed steps, provider capability, event SDK, new frames, persistence/release and physical setups | Actual live collection, authored consumption, new pixels, host/device and installed/offline/performance acceptance. CPU receipts cannot satisfy these. |

If I03-P2 cannot establish the owner/trust boundary, block only dependent recording implementation with exact evidence. Do not dispatch a recorder that accepts caller-fabricated successful commit receipts. Do not weaken the original recording requirements to make a leaf ready.

## I03-P1 exact four-file leaf

**Title:** Guard worker control selection against stale prepared updates.

**Purpose:** Preserve a nested newer control selection. Give the actual worker control owner a bounded synchronous prepare/commit seam for later I03 ownership work.

**Files:**

- Modify `apps/studio/src/controls/worker-control-state.mjs`.
- Create `apps/studio/src/controls/worker-control-state.d.mts`.
- Create `tests/unit/worker-control-state.test.mjs`.
- Create `tests/unit/worker-control-state-admission.test.mjs`.

No other source, test, barrel, manifest, config or skill file belongs to this leaf. `visual-worker.mjs` remains unchanged. Its existing `apply` call must use the new guarded path through the compatibility facade. `worker-component-definition.mjs`, parameter policy and authored-module admission remain unchanged. New unit files are picked up by existing unit discovery.

### Proposed API

These are new internal methods, not an existing runtime transaction API. All snapshot values are readonly. A prepared handle is an opaque local capability of one prepared control owner; it is not serializable and contains no public runtime identity.

```ts
import type { ControlValues } from '../../../../packages/runtime-contracts/src/parameters.mjs';
import type { prepareAuthoredModule } from '../authored-worker-assets.mjs';
type WorkerAdmission = Awaited<ReturnType<typeof prepareAuthoredModule>>['admission'];
declare const preparedControlUpdate: unique symbol;
export type PreparedControlUpdate = Readonly<{ [preparedControlUpdate]: true }>;
export type WorkerControlSnapshot = Readonly<{
  controlSchemaHash: string; controls: ControlValues; controlSequence: number;
}> & (Readonly<{ sdkVersion: '0.1.0'; intensity: number }> |
      Readonly<{ sdkVersion: '0.2.0' | '0.3.0'; intensity?: never }>);
export type PreparedWorkerControls = Readonly<{
  checkDefinition(module: unknown): Function;
  values(): ControlValues;
  state(): WorkerControlSnapshot;
  prepareUpdate(input: unknown, nextSequence: number, hash?: string): PreparedControlUpdate;
  commitUpdate(handle: PreparedControlUpdate): WorkerControlSnapshot;
  apply(input: unknown, nextSequence: number, hash?: string): void;
}>;
export function prepareWorkerControlState(message: unknown, admission?: WorkerAdmission): Promise<PreparedWorkerControls>;
```

`Function` reflects the existing captured create callable. This leaf does not invent its SDK-dependent parameter/result contract. Initial admission remains the existing trusted pre-import operation. It does not gain an arbitrary-hostile-message claim from an `unknown` declaration. New update methods must validate at runtime; a TypeScript cast does not grant handle authority.

### State and error order

1. Keep one private selected record for values/sequence. Keep one private attempt fence and at most one pending candidate. Build the returned owner before authored import, as today. Capture every intrinsic used by new post-import methods at module evaluation. Do not call the dynamic mapping/timeline policy from this control owner.
2. At the start of `prepareUpdate`, replace the attempt fence and clear the prior pending candidate. Save the selected record by object identity before inspecting caller data. Thus every new preparation, even one that fails, invalidates an older pending handle. A failed preparation alone does not change selected controls.
3. Validate the primitive sequence as a nonnegative safe integer strictly greater than the saved selected sequence. Preserve the current schema rule: SDK 0.2/0.3 require the exact prepared hash; SDK 0.1 keeps its existing hash compatibility. Validate the complete own-data control snapshot through the existing captured validator. Keep the 32-control schema cap and finite declared ranges. Preserve empty schemas and nonquantizing steps.
4. After descriptor capture, compare both selected-record identity and attempt-fence identity with the saved values. Any nested prepare, apply or commit makes the outer preparation stale. Reject it. A nested successful commit remains selected. Do not roll that newer operation back.
5. Produce an empty frozen null-prototype handle. Retain its exact identity with the detached validated values, sequence, saved selected record and fence in the one pending slot. Do not expose the candidate payload on the handle. Preparing returns no selected-state change.
6. `commitUpdate` compares the argument by strict identity with the one pending handle. It must not read argument properties, reflect on it, coerce it or invoke callbacks. Check selected-record/fence identity again. Build the result snapshot before selection. Then synchronously select the new values/sequence, clear pending and replace the attempt fence. There is no await, user callback, hashing, foreign reflection or other fallible work after the final guard. Return the frozen snapshot. Output construction failure before selection leaves the selected record unchanged.
7. `apply` calls `prepareUpdate`, then `commitUpdate`, then returns `undefined`. It keeps the current call signature, schema checks, sequence semantics and snapshot shape. Existing worker code receives the same selected values on a valid update. No new wire field appears.
8. `state()` preserves the exact existing fields; SDK 0.1 includes intensity, other profiles do not. Do not expose the private selection/fence/handle. `values()` stays detached and frozen. A snapshot or copied handle cannot be committed.

Use bounded errors with `message` at most 512 code units. Use `INVALID_WORKER_CONTROL_UPDATE` for invalid sequence/schema/snapshot and foreign descriptor failures, `STALE_WORKER_CONTROL_UPDATE` for a preparation invalidated during capture or a recognized pending candidate whose selection/fence changed, and `INVALID_WORKER_CONTROL_CANDIDATE` for foreign, cloned, expired or already consumed handles. New errors must be built with captured operations. Do not inspect or stringify a foreign thrown object, or retain it as `cause`. Preserve current initialization and definition-check messages; their error behavior is outside this change.

There is no candidate map that grows with calls. The owner retains at most one candidate, at most 32 numeric values and two small identity tokens. Caller-retained expired handles carry no owner payload. Sequence exhaustion rejects; it never wraps. Invalidating pending does not consume a control sequence. No new safe-integer revision counter is needed because private object identity provides the fence.

### Concrete test sequence

- [ ] Record the reviewed plan commit/hash and all protected owner hashes. Confirm that exactly the three proposed new files are absent. Start a fresh assigned source session and claim once.
- [ ] Write the current reentrant defect as a behavioral regression before the fix. The target assertion is stale outer rejection and preserved nested sequence 2. Save its observed pre-fix assertion failure separately from missing-new-export failures.

```js
const state = await prepareWorkerControlState({
  sdkVersion: '0.2.0', controlSchema: schema,
  controlSchemaHash: hash, controls: { gain: 0 },
});
let entered = false;
const input = new Proxy({ gain: 0.25 }, {
  getOwnPropertyDescriptor(target, key) {
    if (key === 'gain' && !entered) {
      entered = true;
      state.apply({ gain: 0.75 }, 2, hash);
    }
    return Reflect.getOwnPropertyDescriptor(target, key);
  },
});
assert.throws(() => state.apply(input, 1, hash),
  error => error.code === 'STALE_WORKER_CONTROL_UPDATE');
assert.equal(state.state().controlSequence, 2);
assert.equal(state.values().gain, 0.75);
```

Use normalized schema `[{id:'gain',type:'number',label:'Gain',default:0,min:0,max:1,changeCost:'live'}]`. Compute its hash independently with Node `createHash('sha256')` over `canonicalControlSchemaJson(schema)`. The planning helper contains the literal same setup and retained pre-fix result.

- [ ] Add positive preparation/commit tests. Prepare gain 0.5 at sequence 1. Assert selected gain/sequence remain 0/0. Commit its exact handle. Assert gain/sequence become 0.5/1. Assert a second commit fails and state stays 0.5/1.
- [ ] Add independent handle, descriptor, sequence and bounded-state cases in the matrix below. Use exact expected values, not output echoed as expectations.
- [ ] Implement only the private selection/fence/pending protocol and the `apply` facade. Add readonly declarations. Leave initialization, definition validation and numeric policy with their current owners.
- [ ] Run new helper suites, parameter regressions and strict declarations. Run existing worker/component VM suites only under the later source ticket's explicit CPU fake-surface authorization. They are source compatibility tests, never physical graphics evidence.
- [ ] Inspect the four-file diff and protected hashes. Submit the full source commit, criterion evidence and pending integration gate. Stop the source session. A fresh independent reviewer accepts source; root separately integrates it.

### I03-P1 acceptance matrix

Each source result must name exact checkout, full commit, executor identity/context, command and raw artifact. The fresh reviewer must reproduce adversarial cases with independent expectations. Root must compare all four accepted files at the landed commit and run the combined helper/compatibility checks there.

| Criterion and setup | Method and required observation | Responsible stage and artifact |
| --- | --- | --- |
| Preparation does not publish | One gain owner at 0/0; prepare 0.5/1, then inspect before commit | Source worker: before/after snapshot assertions. Fresh reviewer: exact handle call trace. Root: same at landed SHA. |
| Own single-use commit | Commit exact handle, repeat, clone empty handle, use second owner handle, pass Proxy handle with traps that throw | Only first exact commit selects 0.5/1. All others reject without trap calls or mutation. Separate raw handle test log at each stage. |
| Bounded replacement | Prepare A at seq1; prepare B at seq2; commit A; then commit B | A rejects, B selects seq2. Repeat 1000 prepare calls; only final handle commits. Source review checks one pending slot, not a cumulative collection. |
| Invalid preparation invalidates old handle | Prepare A; attempt out-of-range B; then commit A | B errors, A expired; original selected values remain. Worker/reviewer raw snapshots. |
| Actual stale overwrite regression | Proxy descriptor invokes nested valid apply seq2 during outer seq1 | Outer rejects stale; nested gain0.75/seq2 remains. Preserve pre-fix result from planning and semantic red log. |
| Same-selection reentry | Proxy invokes only nested prepare while outer captures; nested handle saved | Outer rejects due to changed fence even though selected state is unchanged. Nested handle can commit once. This guards same-position reentry. |
| Range/schema/sequence/empty | Wrong hash on 0.2/0.3; SDK0.1 legacy route; missing/extra/duplicate-accessor keys; NaN/Infinity; seq0, negative, fraction, MAX+1; commit MAX then try further update; empty schema | Closed errors; no unintended selection; current schema behavior preserved. No default insertion or quantization. Existing parameter tests remain unchanged. |
| Hostile post-import intrinsics | Bundle the exact control helper into a fresh `vm.SourceTextModule`; prepare before replacing Object/Reflect/JSON/Map/WeakMap methods in that VM; call returned methods through captured test closures | Valid updates and stale guards still work. Getter count is zero; foreign thrown Proxy is never inspected. VM supplies crypto and ordinary CPU types only, no worker/device/render object. Bundle bytes/hash and raw output at source/review stages. |
| Interface and caller preservation | Strict `.mts` imports all new types/methods, narrows SDK/intensity and checks readonly/invalid shapes. Actual existing worker calls `apply` unchanged | Strict declarations and both real TypeScript configs pass. Source hashes prove unchanged worker and definition helpers. Future approved VM suites verify 0.1/0.2/0.3 compatibility. |
| Truthful evidence | A commit result contains numeric selection only | Review rejects added RuntimeKey, timestamp, frame, `published:true`, event or recording claims unsupported by this owner. Source decision and integration decision stay separate. |

Exact minimal CPU command for the future source worker:

```powershell
& 'C:/Program Files/nodejs/node.exe' --experimental-vm-modules --test tests/unit/worker-control-state.test.mjs tests/unit/worker-control-state-admission.test.mjs tests/unit/parameters.test.mjs
```

The VM admission test may use the existing esbuild `build({entryPoints:[exact helper],bundle:true,write:false,format:'esm',platform:'browser'})` pattern already present in `tests/studio/visual-worker.test.mjs`. It evaluates only the control helper bundle. It does not initialize the worker or execute a visual. Retain actual bundled source hash and VM code. Install nothing.

The future separately authorized worker compatibility command is:

```powershell
& 'C:/Program Files/nodejs/node.exe' --experimental-vm-modules --test tests/studio/visual-worker.test.mjs tests/studio/component-worker.test.mjs
```

Do not run the full `apps/studio/test-cpu.mjs` launcher as a substitute. It includes a build and additional scopes. For an ignored strict `.mts` fixture use main's existing `node_modules/typescript/bin/tsc`, from the assigned checkout, with `--ignoreConfig --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2022 --allowImportingTsExtensions`. For project checks use `--noEmit -p tsconfig.json` and `--noEmit -p tsconfig.examples-v2.json`, without `--ignoreConfig`. All paths and logs must resolve the executing checkout.

## Required I02c3b recording contract after the runtime prerequisite

This section fixes retained requirements. It does not invent an available recorder API. I03-P2 must produce the exact source API and tests that satisfy them before I02c3b source preparation.

### Receipt and operation collection

Observe calls at the admitted input owner before coalescing. Detach the full original envelope batch and call arguments before invoking `admitLiveInputs`. Use `(segment, operationIndex, batchIndex)` for every attempt. Accepted references add the actual `(timelineEpoch, ingress)` from the owner result. Rejected originals keep the actual reason and receive no invented ingress or receipt field. Retain empty batches and call boundaries.

Malformed whole-batch input is not a batch of policy rejections. Close the last committed transcript prefix as `incomplete/unrecordable-input`. If a structurally recordable operation is rejected by an owner, close it as `incomplete/owner-error`. Retain a separate bounded attempt outcome; do not insert a fictitious successful operation into transcript version 1. Do not inspect hostile exception properties. This requires an owner diagnostic envelope separate from the importer format.

Preserve all continuous originals, even equal values and samples immediately coalesced or expired. The final held snapshot cannot recover them. At each committed step, use actual frame, events, discards and mapping values. Resolve contributor refs from the actual returned held records in frame signal order, as the importer does. Never timestamp-sort calls, originals or decisions.

### State selection and stage outcomes

I03-P2 must make the command's selected timeline, selected timed mapping state and selected runtime effective control snapshot one privately owned publication unit. Capture the old private selection before any foreign reflection. Perform descriptor admission and policy computation in the approved trust boundary. Reserve recording capacity and prepare the exact operation row before final selection. Recheck owner incarnation, selected-state identity and attempt/commit fence after capture and immediately before commit. Same-epoch/same-position nested operations must invalidate the old candidate.

The final local selection must be synchronous and contain no user callback or await. A fallible callback named `publish` cannot establish this guarantee. If policy and worker live in separate realms, the source plan must explicitly define prepare/acknowledge/failure outcomes across that boundary; it cannot claim a JavaScript object assignment commits both processes. No runtime application evidence may be inferred from a pure candidate return.

After input selection, record authored-update attempted/completed, render attempted/completed, queue completion, status send and parent receipt as separate stages keyed to the same operation. A failed update may have mutated authored state; mark terminal/incomplete, do not retry as a clean transaction. A lost acknowledgement is unknown delivery, not success or rollback. Actual captures must refer to the last completed frame and its selected input identity, not whatever controls were most recently requested.

Every current or pending source/reset/base/host operation must either be in the retained contiguous prefix or have an explicit terminal/pending outcome outside it. Do not hide an in-flight operation on close. The future diagnostic envelope must be bounded, source-owned and reviewed; its fields cannot be silently added to transcript version 1.

### Authority and segment boundaries

Source stop/rebind/reconnect/calibration changes use actual `changeLiveInputSources`. Preserve original discarded events and reason, cleared continuous outcomes, generation and observation sample. A source transition does not create a mapper evaluation. New or missing generations reset corresponding smoothing only at the next recorded step.

Timeline reset uses the actual strictly greater epoch and explicit start/definition. Retain lifetime counters, reset discards, new epoch ingress zero and recreated timed mapping state. Observation time remains monotonic across resets. Clock epoch is recorded separately; do not infer that timeline and animation reset are the same operation. Runtime seed/reset failures need their own stage evidence.

Start a new segment for changed runtime incarnation, accepted source/definition/target catalogue, mapping, seed, input clock domain or calibration of that domain. Version 1 permits source authority changes and timeline resets within a segment. It cannot redefine one `(sourceId, calibrationId)` configuration. Record exact sourceConfigs coverage, including disconnected sources. Keep device IDs, grants and OS routing machine-local; later provider evidence references them under the appropriate authority.

Every step preserves full base, exact host subset, effective values and source signals. Host aliases must be resolved by the publication owner before mapping. Studio steps have empty host values. No mapper or recorder infers host permission from a caller's label.

### Bounds, errors and close behavior

The importer limits stay unchanged: 8 MiB, 250000 visited values, depth 16, 1024 operations, 8192 envelopes, 256 source-config pairs and work 65536. Owner limits still apply: batch/queue 256, 32 consumed events per step, sources 64, signals 256, payload values 16, step delta 60000 ms, event lateness 100 ms and continuous freshness 500 ms. No recorder may silently truncate to fit them.

Before publishing a recorded transaction, reserve space for originals, resulting witnesses, exact configuration coverage and an explicit terminal ending. Reservation must cover descriptor/canonical bytes, work and counts, not only row count. On failure, do not append or publish a success row. Close the last fully retained prefix with the actual reason. If runtime policy requires continuing unrecorded, first latch incomplete/output-loss and stop appending to that segment; record whether lostRecords is known positive or unknown. Never label its suffix a complete recording.

`complete/requested` requires zero pending events and zero loss. Held continuous inputs may remain and must be listed. `incomplete/pending-events` requires pending events. `quota`, `cancelled`, `owner-error` and `unrecordable-input` use zero lostRecords under the existing importer contract. `output-loss` requires positive or unknown loss. If a footer is absent, retain raw truncated bytes and the missing-close observation. Do not repair it into completeness.

Hash only detached closed data through the accepted encoder. Pending encode promises cannot change selected runtime state or keep collection open. Hash failure does not erase collection/close outcomes and cannot make an incomplete segment complete. A self-consistent transcript plus matching hash can be fabricated, as the planning probe demonstrates.

In-memory retention, encoded bytes, sink append, producer close and durable flush are separate observations. Persistence must use the authorized filesystem owner. A footer is not proof of producer flush; absence of a row cannot establish that a write never happened. Preserve failed and ambiguous raw output evidence separately.

## Recorder and later evidence contract

Each criterion needs setup provenance, exact command/stimulus, actual observation, full source/landed commit, executor and raw artifacts. Source reviewer and integrator must independently check that the cited artifact proves the stated setup. An absent owner/provider/runtime makes the corresponding criterion incomplete, even if all pure tests pass.

| Criterion | Setup and method | Required observation | Responsible source/review/integration stage |
| --- | --- | --- | --- |
| Original calls and repeated events | Actual I03 owner through a controlled source seam. Inject A timestamp20 then B timestamp10, equal notes, empty batch and later-zero note | Original ingress0/1; steps consume1 then0. Equal notes retain multiplicity. Later-zero note waits for advancing step. Actual collector rows match owner calls, not a supplied success tape. | Recorder worker logs call-entry/selection/row identities at source SHA; independent reviewer injects variants; root reruns against landed owner. |
| Continuous history | Two originals value0@0 and value1@10 in one call; step5,10,510,510.001 | Both original decisions remain; held/ref ingress1; no signal at5; value1 at10/510; expired at510.001. Equal-valued replacement still changes reference. | Same three stages, full original rows and importer reconciliation. |
| Rejections and loss | Queue256 then repeat seq256, drains0/50/101; malformed batch; receipt reservation failure | Overflow then sequence; 32+32 consumed and192 late discarded. Malformed batch gets no invented decisions. Failed reservation closes truthful prefix. | Recorder source/fresh reviewer; root CPU integrated owner. Physical provider loss remains separate. |
| Joint input selection | Real selected owner, forced mapper missing-base error and nested same-position operation before final guard | No failed outer selection or successful row; prior or nested newer timeline/mapping/control selection remains. Event consumed once on later valid operation. | I03-P2 owner tests first; recorder tests use that actual seam. Private identity and guard source must be inspected. |
| Runtime stage truth | Explicit future runtime fixture with deferred update/render/barrier and termination at each await | No fabricated completed frame; partial authored operation closes incomplete. Input selection, update completion and completed output stay distinct. | Runtime source CPU fake stages, independent review, then serialized actual runtime/graphics validation with exact bundle and captured frames. |
| Source and reset provenance | Actual authority seam, generation1/cal1 transition and timeline epoch1/start1000 | Original source-reset/reset discards, lifetime counters, distinct epoch1 ingress0, no hidden mapper step. Missing/duplicate config or same-generation calibration change fails. | Owner/recorder CPU logs at source and landed SHA; real calibration remains I05 provider validation. |
| Base/host/smoothing | Complete gain base, host0.75 versus source1, two independent shaped bindings with exponents1/2 and taus100/200 | Host0.75 bypass; Studio host subset rejects. Contributions at100 ms from0 to0.5 equal `0.5*(1-exp(-1))` and `0.25*(1-exp(-0.5))` within1e-12. No failed candidate recorded. | Actual mapper outputs/traces and recorder rows; independent known answers; root integrated owner. |
| Bounded closure | Reach1024 empty calls; 8192 continuous originals; work65520 then next step65780; pending close and unknown output loss | Reachable cases remain within other limits or state explicit dominance. Next operation fails before publication; close outcome retained. Missing footer remains missing. | Recorder worker and fresh reviewer retain counts/bytes/raw failures. Root repeats meaningful boundaries. |
| Authority identity | Actual source admission, runtime incarnation, target resolver, clock/source handles; mutate copied IDs/hash and replace owner | Copied data cannot publish; old generation/fence fails. Artifact identity is tied to actual admitted execution route. Legacy limitations remain explicit. | I03 owner/source review first; recorder integration second; physical execution evidence later. |
| Storage | Authorized filesystem session and actual sink failures at append/close/flush | Producer and persisted prefix reconciled; truncated bytes preserved; no false durable success | Separate storage source/reviewer/integrator. LUX-7 stop is not bypassed. |
| Faithful live replay | Closed recorded operation tape plus new runtime envelope and exact recorded deltas | Reproduce committed effective steps, rejected/discarded/pending outcomes and independent binding trajectories. No live wall-time lateness rerun and no timestamp-window conversion | Separate I02c3c source and fresh review, then actual runtime integration. |
| Original product gates | Real event-capable SDK/host/device, admitted release, clock calibration, host sentinel and actual new frame captures | 200 equal events over10s, zero normal-load drops; fixed1/60, max4 live catch-up with discarded-time accounting; controlled complete advance/deadline; paused redraw versus explicit step; 0/500/1000ms intermediate-state captures; original installed/offline/latency gates | I03/I04/I05/I08/I09 and reliability owners. All remain incomplete here. Preserve original 600-sample p95<=50ms/p99<=100ms control gate and independent host behavior. |

## Plan validation and handoff

This plan maps the full earlier requirements to actual available helpers, the explicit first prerequisite, the missing runtime owner protocol, or a later source/physical gate. It does not claim the entire recorder is implementable now. Complete target/seed/clock/source authority and actual runtime publication remain mandatory.

Planner evidence includes the complete source pins, source search, four actual CPU probe groups, duplicate-ticket inventory and plan scope/diff check. The first search included absent root `src`; the original diagnostic is retained as LUX-P75 (`5db75410-d612-450f-855b-e291a2c0d6a3`). Later searches used observed `packages`, `apps` and `tests` paths. This correction does not erase the failure.

Root must give a fresh independent reviewer the full specification, this exact document commit/hash, owner pins and raw probes. Review must assess whether the explicit prerequisite is sufficient for its narrow claim and whether all recording gates remain intact. Review must not accept runtime recording from the first control leaf. Preserve findings and dispositions. Material plan changes require a fresh review of the changed contract.

The planner submits exactly this document with full `--commit`, then verifies released claim and stopped session. Root accepts and integrates the reviewed plan serially under separate evidence. Only then prepare the I03-P1 source ticket. That source ticket does not depend on recording acceptance. Subsequent I03-P2 and I02c3b tickets depend on the necessary integrated prerequisites, with no reverse acceptance dependency.
