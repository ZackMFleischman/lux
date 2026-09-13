# Component resource authority implementation plan

> For agentic workers: use `superpowers:executing-plans` within one assigned Conductor leaf. Root dispatches fresh workers and independent reviewers, with no recursive children. After independent acceptance, only C03c2a below is the first executable leaf. C03c2b requires a fresh implementation ticket and review against the delivered ledger.

**Goal:** give the internal graph runtime bounded ownership of CPU resource descriptors and asynchronous obligations before scheduling callbacks.

**Architecture:** a small synchronous reservation ledger owns atomic capacity accounting. A later resource host consumes that ledger, authentic C03c1 plans and a trusted fake backend, keeping scheduler, callback and backend authority separate. Tokens and leases are local capabilities; the host owns physical-release decisions.

**Tech stack:** existing TypeScript, Node24.12.0, TypeScript7.0.2, Node test runner; no installs.

**Spec:** accepted `docs/implementation/component-scheduler-plan.md`, C03c2/c3 caches and terminal/reset contracts; `nested-graph-plan.md` and actual C03c1 owners. Planning checkout `C:/Users/zFlei/repos/lux/.worktrees/component-resource-plan`, branch `codex/component-resource-plan`, base `a7578e8cd974498072ce319ff187d27ee2cf69a2`; LUX-61 specification2. All resource behavior below is proposed, not implemented by this documentation ticket.

## Global constraints

- Preserve authentic GraphRuntimePlan, C03b topology/defaults, SDK0.1/0.2 admission, C02 EmptyInputs, compiler, Studio, MCP and shipped skill.
- Host: generation/clock epoch nonnegative safe integers, seed uint32, integer width/height1–4096, product<=16777216, format rgba8unorm, color linear-srgb, alpha premultiplied.
- Fixed simultaneous caps: allocations8192, backend operations8192, input-reader obligations4096, external frame readers16, capture holds16. No implied GPU byte budget.
- No timers, native acquisition, pixels, physical GPU tests, portal, installs, public exports, runtime scheduler, authored reset or candidate promotion.
- Terminal invalidation is immediate; physical ownership remains until obligations settle. No timeout is settlement. No hostile-process or replaced-intrinsics sandbox claim.

## Current owners and actual feasibility

`readGraphRuntimePlan` looks up a private WeakMap, accepts only its exact frozen empty null-prototype key and returns the stored immutable NestedExecutionPlan without reflecting on the caller token. Preparation delegates to the authentic C03b planner. Preserve both. PlannedInput already supplies destination port and exact source path/port; definitions supply normalized metadata. Build consumer addresses from that data, not inferred names. Use nested maps or JSON encoding of admitted path arrays, never ambiguous delimiter concatenation. UUID case/spelling remains significant.

Metadata allows16 inputs/outputs per definition. Signals carry finite number, exact unit string|null and clock frame; images fix linear-srgb/premultiplied, with dimensions/format supplied by host. Reachable plans inherit512 leaves/4096 edges/16384 control targets and existing admission limits. Every declared output of an evaluated node remains required, including unwired outputs. Unwired outputs get cache ownership but no invented consumers. Graph aliases already resolve to one actual leaf output.

The planning probe actually admitted an image diamond A→B,A→C,B→D.left,C→D.right, final D.image. Raw wrapper3835 UTF-8 bytes, SHA256 `454c136db5262dff7d185c7090f34d8089008e8986ea07ac5589d2b95a3c9bf5`; order A/B/C/D, four input addresses, B/C shared definition but distinct paths. Its second variant routes B.image to both D.left/right and prunes C: two port obligations, one allocation. The signal6→8→16 fixture remains c3's separate numeric test.

These probes execute existing owners only. They prove no proposed resource operation. `leaves(512)` prunes511 nodes at its selected output, so it does not prove512 simultaneously reachable allocations. Capacity tests below explicitly separate direct-ledger quotas from admitted topology evidence.

## C03c2a: first implementation leaf

Create exactly two files:

| File | Responsibility |
| --- | --- |
| `packages/runtime/src/graph/resource-accounting.ts` | Fixed-cap atomic reservations, no graph/callback/backend/token issuance |
| `tests/runtime/graph-resource-accounting.test.ts` | Literal counters, authenticity, boundaries, atomicity, descriptor reentry |

No barrel export. Acceptance covers the reservation kernel only; c2b remains required for resource ownership.

### Exact API and algorithm

```ts
export type ResourceCounts=Readonly<{
  allocations:number;backend:number;inputs:number;frames:number;captures:number;
}>;
export const resourceCapacities:ResourceCounts=Object.freeze({
  allocations:8192,backend:8192,inputs:4096,frames:16,captures:16
});
declare const reservationBrand:unique symbol;
export type ResourceReservation=Readonly<{readonly [reservationBrand]:true}>;
export type ResourceLedger=Readonly<{
  reserve(charges:ResourceCounts):ResourceReservation;
  release(reservation:ResourceReservation):void;
  snapshot():ResourceCounts;
}>;
export function createResourceLedger():ResourceLedger;
```

Each ledger has a private owner, five zero counters and an admission guard. Returned methods are frozen closures. Tokens are frozen empty null-prototype objects registered in a module-private WeakMap containing owner, captured numeric vector and released flag. Dropping a token does not decrement counters; explicit release is required. Released records may remain weakly keyed for idempotence; no strong historical registry or unbounded log.

Reserve sets the guard **before any** prototype/key/descriptor reflection. Nested same-ledger reserve/release throws TypeError `Resource ledger reentry` before inspecting its argument or changing state. A different ledger is independent. Snapshot only returns a frozen copy of the five private numbers and is safe even inside reflection traps.

Inside try/finally, capture an ordinary Object.prototype or null-prototype non-array record with exactly the five own named string keys, no symbols/accessors/extras/missing keys. Inspect own data descriptors without invoking getters. Values must be nonnegative safe integers; -0 becomes0; at least one positive charge is required. Invalid shape/value throws TypeError `Invalid resource charges`. Count/prototype validation precedes descriptor values. Proxies meeting reflection checks are allowed, but traps cannot mutate the same ledger reentrantly.

Check every charge against its cap before addition; compare with cap-current to avoid overflow. Check fields in interface order for deterministic RangeError `Resource capacity exceeded: <field>`. Check **all** dimensions before token allocation or counter mutation. After capture/checks no caller callout occurs: create/register token and commit all five totals synchronously. Finally clears guard on every throw, including a throwing Proxy trap. Copy values before commit; retain no caller object.

Release enters the same guard, checks exact registry owner without reflecting on the token, and throws TypeError `Invalid resource reservation` for primitives/clones/Proxy wrappers/foreign tokens. Already released returns void. Otherwise mark released first, then subtract all five captured numbers with nonnegative invariants. No arbitrary retain, resize, partial release, cap override, manual count setter, version seed or asynchronous lifecycle exists. Independently settling host obligations use separate reservations.

### Literal tests and steps

These are concrete test fragments; import the proposed API in the new test file. Expected vectors are literals, not values derived with the implementation under test.

```ts
const zero={allocations:0,backend:0,inputs:0,frames:0,captures:0};
const l=createResourceLedger();
const a=l.reserve({...zero,allocations:1,backend:1});
const b=l.reserve({...zero,inputs:2});
assert.deepEqual(l.snapshot(),{allocations:1,backend:1,inputs:2,frames:0,captures:0});
l.release(a); l.release(a);
assert.deepEqual(l.snapshot(),{allocations:0,backend:0,inputs:2,frames:0,captures:0});
l.release(b); assert.deepEqual(l.snapshot(),zero);
const cap=l.reserve({allocations:8192,backend:8192,inputs:4096,frames:16,captures:16});
assert.deepEqual(l.snapshot(),{allocations:8192,backend:8192,inputs:4096,frames:16,captures:16});
assert.throws(()=>l.reserve({...zero,allocations:1}),RangeError);
assert.throws(()=>l.reserve({...zero,backend:1}),RangeError);
assert.throws(()=>l.reserve({...zero,inputs:1}),RangeError);
assert.throws(()=>l.reserve({...zero,frames:1}),RangeError);
assert.throws(()=>l.reserve({...zero,captures:1}),RangeError);
l.release(cap);
const full=l.reserve({...zero,frames:16});
assert.throws(()=>l.reserve({...zero,allocations:1,frames:1}),RangeError);
assert.deepEqual(l.snapshot(),{allocations:0,backend:0,inputs:0,frames:16,captures:0});
l.release(full);
const held=l.reserve({...zero,allocations:1});
let calls=0;
const request=new Proxy({...zero,backend:1},{
  getPrototypeOf(target){
    calls++;
    assert.throws(()=>l.release(held),/Resource ledger reentry/);
    assert.throws(()=>l.reserve({...zero,frames:1}),/Resource ledger reentry/);
    assert.deepEqual(l.snapshot(),{allocations:1,backend:0,inputs:0,frames:0,captures:0});
    return Reflect.getPrototypeOf(target);
  }
});
const pending=l.reserve(request);assert.equal(calls,1);
assert.deepEqual(l.snapshot(),{allocations:1,backend:1,inputs:0,frames:0,captures:0});
l.release(pending);l.release(held);
```

Run separate individual-token cap cases:8192 allocation reservations,8192 backend,4096 input,16 frame and16 capture, one dimension per fresh ledger. Cap+1 leaves previous tokens valid and all counters unchanged; release every token twice and assert zero. Aggregate reservation proves atomic arithmetic; individual-token cases additionally exercise authentication and retained state.

Reject all-zero, negative/fractional/nonfinite/unsafe values, missing/extra/symbol/accessor keys, arrays and exotic prototypes. Frozen/null-prototype records are legal. Original input mutation after reserve cannot alter release arithmetic. Clones/spread/structured clones/Proxy wrappers/foreign tokens reject without affecting either ledger. Negative type fixture makes a structural object unassignable to ResourceReservation; runtime tests remain essential.

Repeat descriptor reentry at ownKeys and getOwnPropertyDescriptor, targeting both reserve and release, with nested error caught and propagated. Throwing trap leaves pre-call counters unchanged, releases guard and preserves existing reservations. Getter count stays0. Snapshot inside any trap observes the pre-reservation vector. After every rejection a valid reserve/release must succeed.

- [ ] Write tests first and run `node --test tests/runtime/graph-resource-accounting.test.ts`; retain missing-module red as setup only.
- [ ] Implement the specified two-file boundary. Test mutation1 removes guard; mutation2 increments allocations before checking frames cap; mutation3 removes released check. Each must reach a behavioral assertion failure, then be restored. Loader failures do not prove these invariants.
- [ ] Run new suite, existing84 graph/foundation/bridge/seed checks and both actual TS configs below. Verify unchanged owner hashes.
- [ ] Commit only the two paths; submit full SHA, exact literal/red-green evidence and remaining c2b prerequisite. Stop worker for fresh review.
- [ ] Independent reviewer repeats selected traps/caps at exact submitted SHA. Root separately integrates, compares accepted file/owner hashes and reruns focused/config checks. c2b is prepared only after this acceptance.

## C03c2b: exact follow-on host contract

Proposed next leaf creates `packages/runtime/src/graph/resources.ts`, `tests/runtime/graph-resources.test.ts`, `tests/runtime/graph-resources-async.test.ts`, using delivered ledger unchanged. Fresh review must freeze implementation against actual c2a SHA. The following contract specifies interfaces and ownership; it is not source dispatch authority now.

### Separate callable surfaces

All seven tokens ResourceHost, ResourceFrame, EvaluationScope, OutputToken, InputView, CachedOutputs and RetryPin have separate type-only unique-symbol brands and private runtime WeakMaps. They are frozen empty null-prototype objects, never caller-settable records. The implementation exports needed types/functions only through this internal module.

```ts
type HostProfile=Readonly<{generation:number;sceneSeed:number;initialClockEpoch:number;
  width:number;height:number;format:'rgba8unorm';colorSpace:'linear-srgb';alphaMode:'premultiplied'}>;
type ImageDescriptor=Readonly<{kind:'image';width:number;height:number;format:'rgba8unorm';
  colorSpace:'linear-srgb';alphaMode:'premultiplied'}>;
type SignalDescriptor=Readonly<{kind:'signal';value:number;unit:string|null;clock:'frame'}>;
type OutputMap=Readonly<Record<string,OutputToken>>;
type InputMap=Readonly<Record<string,InputView>>;
type CaptureHold=Readonly<{release():void}>;
type FrameOutput=Readonly<{descriptor:ImageDescriptor;generation:number;clockEpoch:number;
  version:number;capture():CaptureHold;release():void}>;
type CallbackResources=Readonly<{
  readSignal(input:InputView):SignalDescriptor;
  imageDescriptor(input:InputView):ImageDescriptor;
  signal(portId:string,value:number):OutputToken;
  image(portId:string,descriptor:ImageDescriptor,inputs:readonly InputView[]):Promise<OutputToken>;
}>;
type Evaluation=Readonly<{scope:EvaluationScope;inputs:InputMap;resources:CallbackResources}>;
type BackendImage=Readonly<{generation:number;clockEpoch:number;version:number;
  nodePath:NodePath;portId:string;descriptor:ImageDescriptor}>;
type CpuResourceBackend=Readonly<{
  produce(output:BackendImage,inputs:readonly BackendImage[]):void|PromiseLike<void>;
  release(image:BackendImage):void|PromiseLike<void>;
  capture(image:BackendImage):void|PromiseLike<void>;
}>;
type ResourceStatus=Readonly<{
  state:'active'|'resetting'|'terminal'|'drained';clockEpoch:number;counts:ResourceCounts;
  openCallbacks:number;cleanupPending:number;releaseFailed:number;
}>;
function createResourceHost(profile:HostProfile,backend:CpuResourceBackend):ResourceHost;
function attachResourceHost(host:ResourceHost,plan:GraphRuntimePlan):void;
function beginResourceFrame(host:ResourceHost,clockEpoch:number):ResourceFrame;
function openResourceNode(host:ResourceHost,frame:ResourceFrame,nodePath:NodePath):Evaluation;
function completeResourceNode(host:ResourceHost,scope:EvaluationScope,outputs:unknown):Promise<CachedOutputs>;
function failResourceNode(host:ResourceHost,scope:EvaluationScope):void;
function reuseResourceNode(host:ResourceHost,frame:ResourceFrame,nodePath:NodePath,cache:CachedOutputs):void;
function releaseResourceCache(host:ResourceHost,cache:CachedOutputs):void;
function pinResourceRetry(host:ResourceHost,frame:ResourceFrame):RetryPin;
function finishResourceFrame(host:ResourceHost,frame:ResourceFrame):FrameOutput;
function presentResourceRetry(host:ResourceHost,pin:RetryPin):FrameOutput;
function releaseResourceRetry(host:ResourceHost,pin:RetryPin):void;
function resetResourceEpoch(host:ResourceHost,nextEpoch:number):Promise<void>;
function disposeResourceHost(host:ResourceHost):Promise<void>;
function readResourceStatus(host:ResourceHost):ResourceStatus;
```

These free functions are scheduler-only. c3 retains scope, passing only inputs/resources to evaluate. Callbacks receive no host/frame/scope/cache/retry token, backend, ledger, attach/release/admission or arbitrary retain function. Backend receives immutable scalar descriptors, never resource tokens/input views/host capability. This is capability separation inside the trusted adapter, not protection against arbitrary same-process module loading or a factory deliberately handed authority by its caller.

Capture profile and own callable backend method data descriptors at construction; keep frozen copies. Attach once, even same-plan repeated attachment rejects. Read authentic plan before storing attachment. Internal evaluation IDs and resource versions start1, are host-monotonic safe integers and never rewind/reuse, including reset. Exhaustion rejects before reservation/issue. Frame caller supplies only exact current epoch; c3 owns tick/time/control/cache-key semantics and source-to-factory binding. A private checked-increment helper can be tested at MAX_SAFE_INTEGER without claiming an end-to-end execution of that many versions.

### Frames, views, output and cache ownership

At attachment precompute declared ports and exact consumer addresses. Begin one frame per host; atomically reserve one input obligation per reachable wired destination port before publishing the frame token. The total is<=4096. These pending obligations bind to actual allocations when source outputs complete/reuse. Do not deduplicate parallel ports. Resource methods enforce each node selected once and predecessor outputs available; c3 chooses deterministic order. One node callback may be open at a time in this serial profile.

Open creates fresh input views tied to owner/epoch/frame ID/destination path+port and the actual planned source allocation. Read requires exact open scope, current epoch, noninvalidated allocation and matching kind. Input views cannot become outputs. Callback closure invalidation does not count as callback settlement. Reused source caches supply fresh views; old evaluation views reject.

Signal validates finite value, deriving exact unit/clock from output metadata. Image captures exact host-matching descriptor and0–16 dense distinct input views, each an image port of this scope. Different ports pointing to the same allocation are distinct and legal; backend receives their descriptor entries in requested order. Signal values can be read separately, not passed as image views. Every output port issues once; no undeclared scratch allocation, input alias as output or in-place transform.

Before produce, reserve allocation+backend atomically, assign version, mark port issued and register producer callback/backend obligations plus backend-read obligations on selected input ports. Commit before backend invocation. Wrong dimensions/format/color/alpha, foreign/old/released views, wrong port/kind reject before reservation/mint/dispatch. CPU backend allocates descriptors/counters only, no pixels.

Image returns a promise resolving exact token after successful produce; attach an internal rejection observer immediately even if callback abandons it. Synchronous throw/rejected thenable is settled failure; never-settled operation retains output allocation/backend slot/input reads. Backend rejection closes issuance/publication terminally. Promise settlement does not by itself mark the authored callback finished.

After authored evaluate settles, c3 calls complete or fail exactly once. Complete first closes issuance, then captures ordinary exact-own-key output map (all declared keys, <=16, no symbols/accessors/extras/missing keys) and authenticates each value to owner/scope/port/epoch. Reusing token under another port rejects. Wait every issued producer operation, including abandoned ones omitted from result; preserve output-map failure as primary while work drains. On success transfer producer holds to CachedOutputs pins, bind outputs into frame, then settle input callback obligations. An input reservation ends only after callback and all its backend reads settle. Fail marks callback finished, rejects publication and terminalizes host while keeping pending work. A terminal host must still accept the original scope's one completion/failure notification for drainage.

One CachedOutputs token pins each exact output of one node; it has no callback surface. c3 holds old cache until new cache succeeds, then explicitly releases old pins. Both count during replacement. Release is idempotent, revokes reuse, but existing frame/input obligations remain. Reuse requires same host/path/current epoch, nonreleased cache, binds unchanged versions and cancels that node's unopened input callback obligations because no callback/backend ran. c3 still owns deciding whether its full cache key permits reuse.

After all reachable nodes complete/reuse, optional pinResourceRetry retains the successful frame's final output (one retry pin maximum per host), then finishResourceFrame creates a fresh bounded reader and retires frame token. Invoke pin before finish; old retry pin must be released before replacing. No pin/reader may be created from a partially completed frame. PresentRetry admits a fresh reader without callbacks/version change. It checks current epoch and same external-reader cap. Finish capacity failure retains frame/current ownership unchanged; c3 makes failed frame terminal rather than rerunning partial simulation.

### Readers, backend cleanup and terminal drain

Reader fields are frozen copies. Release first marks reader released, then decrements exactly one frame reservation/hold; duplicates do nothing. New capture after reader release, non-active host state or reader epoch mismatch rejects; existing capture independent. Capture synchronously reserves capture+backend before returning its hold or invoking backend. Hold release marks external intent ended, but capture reservation/allocation hold persist until backend settles too. Internal observer handles rejection. Capture provides no pixels/result data in this profile.

Each allocation records producer callback/backend, every destination port callback/backend read, cache pin, retry pin, reader holds, capture holds/backend, and physical-release attempt. Signals use allocation/version/input/cache accounting but no produce/release backend calls; retire descriptor once obligations zero. Images become release-eligible only at zero nonrelease obligations. Mark release-attempted before backend release; retain allocation reservation until successful settlement. Cleanup uses cleanupPending<=8192, separate from ordinary backend8192 so a full work budget cannot deadlock cleanup. No new ordinary admission occurs terminally.

Release throw/rejection settles a failed cleanup attempt once: increment releaseFailed, keep allocation counted unreclaimed, never auto-retry. Pending release retains allocation and cleanupPending. Bound diagnostics to at most8192 entries, fixed code/version/admitted path+port, <=1024 characters per message. Never retain/stringify arbitrary thrown objects or execute error getters; nonordinary errors use fixed text. No production event history grows without bound.

Dispose returns one stored promise object, non-async wrapper. Store deferred completion/set terminal before any callout, close issuance/publication synchronously, reject new work. Running callbacks must notify completion; closure invalidation cannot fake that event. Drain them and already registered produce/capture operations, drop cache/retry pins and cancel never-started consumers only after proving no scope/dispatch exists, wait external readers/captures and physical release attempts. Never-settled work keeps promise pending. Once all attempts settle, resolve only on zero allocations; cleanup failures reject a bounded summary with visible unreclaimed counts. Pending cleanup is not a settled failure. c3 separately attempts captured authored disposers, preserving its primary error and these secondary failures; this resource owner cannot claim authored cleanup.

### Reentry and epoch barrier

Every admission takes a host-local guard before caller reflection. Nested issue/open/frame/reuse/complete/reset admission rejects RESOURCE_REENTRY before inspecting arguments. WeakMap token checks invoke no reflection. Object.getPrototypeOf, ownKeys, descriptors, promise assimilation/then getters, backend functions and error formatting are treated as callouts, not harmless field reads.

Dispose and reader/capture releases remain permitted during guarded reflection: synchronously commit terminal/released flags and ownership changes, increment mutation revision and defer backend callouts until guard leaves. Outer admissions capture revision and recheck revision/state/epoch/scope after capture and immediately before reservations/commit. A descriptor trap that disposes cannot be followed by a stale successful outer commit. Token releases involve no caller-argument reflection. Ordinary reentrant admissions fail without state changes.

Reserve and register full obligation record before any backend call or Promise.resolve/thenable assimilation. Release admission guard before invoking the captured backend method. Synchronous backend reentry now sees committed port/capacity. Catch throw and observe returned thenable even if disposal occurred during callout. Private once-settlement flags prevent duplicate callbacks from double release. There is no rollback after dispatch. Late success cannot reopen publication authority. Disposal stores its identical promise before any nested call, so dispose from backend returns that same object.

Internal resetResourceEpoch is only c4's resource barrier, not an authored reset. Require active host/no open frame or callback and exactly epoch+1 with safe headroom. Set resetting synchronously, revoke cache/retry/old views, drop pins, drain backend/readers/captures/cleanup. Commit new epoch/active only if original transition revision still owns the state and disposal did not intervene. New frames reject while resetting; disposal wins permanently and pending reset rejects RESOURCE_TERMINAL after drain, never reactivates. Cleanup failure terminalizes. Versions/evaluation IDs/scene seed do not rewind. c4 separately retains controls, resets RNG/instances and establishes tick0/time0.

Fixed codes: RESOURCE_INVALID, RESOURCE_CAPACITY, RESOURCE_REENTRY, RESOURCE_STALE, RESOURCE_TERMINAL, RESOURCE_BACKEND, RESOURCE_CLEANUP. Bound optional provenance to admitted paths/ports/version; never serialize arbitrary input. Pre-dispatch rejection leaves old obligations untouched. First operation failure remains primary. No low-level timeout, cancellation token or finalizer can declare physical release.

### Atomic groups with independently settled ledger tokens

The c2a reservation is all-or-nothing on release, so do **not** keep allocation+backend in one reservation for image work. Host admission preflights the full charge vector against one ledger snapshot while holding its own guard, then obtains separate one-dimension reservations using only internally constructed fixed data records, with no user/backend callout between them. Publish no token or promise until the whole group exists. If internal acquisition throws before dispatch, release all already acquired reservations in reverse order and leave host state unchanged. There is no competing host mutation during this segment; ordinary descriptor reflection is complete, and the ledger receives no caller Proxy.

Apply the same rule to capture+backend and to the frame's individual input obligations: preflight total input count once, obtain one inputs:1 reservation per destination port, then publish frame. Each port releases independently at callback+backend settlement. This is atomic external visibility through host guard and closed code, not a new ledger batch API or partial-release extension. Every group must have a regression proving a later failing reservation cannot leave earlier charges or consume a port/version. Version is committed only once group reservation succeeds; consumed dispatched versions are never rolled back.

## C03c2b evidence matrix

Use explicit deferred controls, not sleeps: create a promise with stored resolve/reject functions and a test event marking execution of the registered settlement handler. Snapshot at that event. A deliberately unresolved operation must be settled afterward for test cleanup; a finite observation cannot prove eventual drainage.

| Required fixture | Literal observations |
| --- | --- |
| Actual admitted image diamond | A has one allocation/cache pin and B.input/C.input obligations. B issues image using A, abandons promise then fails callback. Terminal closes C without opening it, cancels its never-started obligation, retains B's backend read. A physical releaseCalls=0 until B produce settles and cache pin drops at drain. After remaining obligations and release succeed A releaseCalls=1. B's unreturned allocation also releases once, publication count0. Ledger distinguishes per-allocation obligations from host-total four input reservations. |
| Parallel D.left/right from B | Two distinct views/destination addresses refer to B's one version. Request uses both; one backend operation owns two input-read obligations. Closing callback alone releases neither pending port reservation. Backend settlement ends both reads; one physical B release after pins end. |
| Cached source | Frame1 A.version=1. Reused frame2 A.version=1, source produceCalls=1, view identity differs. Old view rejects. Cache release while new callback/backend pending retains allocation. |
| Profile/authenticity | Two hosts generation7,epoch3,width1920,height1080. Legal original passes only its host/scope/port. Width1919, wrong format/unit/kind, cloned/Proxy-wrapped/foreign/released/old-epoch tokens reject before backend call; rejected-path backend delta0. Signal unit comes from metadata, so a forged token asserting another unit never passes. |
| Abandoned output | Image issued then omitted/throw: before produce settlement allocations1,backend1,releaseCalls0. After produce success backend0; once other obligations end release attempt starts. Deferred release gives allocations1,cleanupPending1. Successful release gives allocations0,cleanupPending0. |
| Reader/capture | After cache pin drops, final reader gives allocations1,frames1,captures0. Capture gives allocations1,backend1,frames1,captures1. Duplicate frame release leaves frames0,allocations1. Duplicate capture release before backend settles leaves captures1,backend1,allocations1. Backend settlement yields captures0,backend0 and one release attempt; successful release gives allocations0. |
| Exact external caps | Sixteen fresh readers succeed; reader17 rejects before retain. Release reader1 twice and create replacement: live16, new identity, released reader cannot capture. Sixteen captures succeed, capture17 changes neither capture nor backend counts. Release/settle every controlled holder. |
| Physical cleanup failure | Release throws/rejects: releaseCalls1,cleanupPending0,releaseFailed1,allocations1. Dispose rejects with unreclaimed count; repeated dispose returns identical promise and releaseCalls remains1. |
| Descriptor reentry | At getPrototypeOf/ownKeys/getOwnPropertyDescriptor of image descriptor/path/output map call dispose then return apparently valid data. Outer rejects stale/terminal, new dispatch0/publication0, newer terminal state persists. Reentrant ordinary issue/reset rejects before reflecting its own argument. |
| Backend/thenable reentry | produce synchronously attempts same-port issue: committed issued flag rejects. Capacity-sensitive call sees occupied reservation. Dispose in backend/then getter/fulfillment handler wins; late successful token cannot publish. Duplicate fulfill/reject callbacks settle only once. |
| Resource epoch barrier | Epoch3 cached output with held capture; request4 enters resetting. New frame rejects. After reader/backend/release settlement epoch4 becomes active and old token rejects. Dispose while reset pending leaves terminal forever; late reset continuation cannot set active. |
| Capacity provenance | Exact8192/8192/4096/16/16 and +1 use delivered ledger. Actual admitted graph tests prove authentication/consumer semantics separately. Version exhaustion uses private checked-increment helper at MAX_SAFE_INTEGER; do not claim an impossible count of real allocations. |

Each async artifact records allocation version, producing path/port, every destination path/port, callback-open/issue-closed/callback-settled as separate states, backend dispatch/settlement, cache/retry/reader/capture hold transitions and physical-release attempt/result. Failed callback precedes backend settlement in the literal event order. Merely creating a promise is not proof of completion.

Add type-negative fixtures: InputView cannot assign to OutputToken; ResourceHost cannot assign to CallbackResources; callback methods contain no attach/release/retain; BackendImage contains no token. Runtime guards must independently reject forged values.

## Validation and integration contract

Each implementation worker records exact isolated checkout/base/full submitted SHA, stable identity/session/claim, installed versions, commands/cwd and raw artifact provenance. A passing command at another SHA is not evidence without exact source comparison.

Current baseline command:
```text
node --test tests/runtime/graph-runtime-plan.test.ts tests/runtime/node-random.test.ts tests/runtime/graph-validation.test.ts tests/runtime/graph-plan.test.ts tests/runtime/component-single-image.test.ts tests/runtime/nested-graph-validation.test.ts tests/runtime/nested-graph-plan.test.ts tests/runtime/seed.test.ts
node C:/Users/zFlei/repos/lux/node_modules/typescript/bin/tsc --noEmit
node C:/Users/zFlei/repos/lux/node_modules/typescript/bin/tsc -p tsconfig.examples-v2.json --noEmit
```

Add only the selected new leaf suites. Worker evidence maps criterion to actual setup, method and observed outcome: c2a to literal vectors/cap+1/traps/authentication/unchanged owners; c2b to authentic fixtures/backend deferred controls/whole obligation ledgers/provenance. Record raw semantic red/green results and restoration. A fresh independent reviewer repeats selected adversarial cases at full submitted SHA and distinguishes executed resource evidence from the current proposed contract. Root serially integrates, compares every accepted file and owner hash, reruns focused/config checks and records separate full landed SHA. Source acceptance does not depend on future main integration.

Owner guards: accepted scheduler plan; runtime-plan.ts, node-random.ts, nested-plan.ts, nested-validate.ts; runtime-contracts graph.ts/nested-graph.ts/components.mjs/components.d.mts; seed.ts, clock.ts; components/single-image.ts and SDK sdk-components.ts. Exact hashes/lengths are in the planning manifest. Changing an owner requires reviewed scope amendment, not an unexplained manifest update. No author-facing capability is added, so shipped skill install/check is not in these leaves.

## Planning provenance and handoff

Executor `/root/component_resource_plan`, stable identity `f50a944d-5872-47bd-b538-5d6c8c06e0fd`, session `c57fedda-dd59-419e-86ba-9447134f7c2e`, claim `8d41cca2-3500-4a96-a8bb-17e18c510129`. Root binding/actual active observation, own epoch1/challenge1 ACK and dynamic-ready receipt preceded the sole claim in the assigned checkout.

Main ignored evidence root `C:/Users/zFlei/repos/lux/.worktrees/_coordination/LUX-61/`: claim.json, ack.json, ready.json, feasibility.mjs/json/log, image-diamond.json, owner-hashes.json and validation/handoff files. Probe imports actual worktree through pathToFileURL; it proves image topology, parallel ports and clone rejection, with resourceImplementationExecuted=false. Proposed c2 methods were not executed. An initial oversized PowerShell document write failed before process creation with Windows error206; bounded writes replaced that failed setup without changing scope.

Applicable startup corrections: CON-24 exact installed exe/home escalation every invocation; LUX-P1/P25 exact cwd/process trust; READ-P9/CON-P38 scoped Git trust/empty excludes; P26 successful claim boundary; P32 Windows file URLs; P42 clone frozen raw fixtures; P43 preserve RNG owners/vectors; P35 actual examples-v2 config and absolute existing compiler; P49 rg file enumeration/pattern filters; P40 optional length only if present. No native/install operations occurred.

Independent plan review assesses complete cross-leaf compatibility and the executable two-file c2a boundary. c2b needs fresh exact implementation review against c2a delivery. Root owns subsequent assignees, integration and c3/c4/c5 planning. LUX-7 stays stopped; portal remains untouched.

### Bounded capture and failed-completion clarification

For c2b, capture profiles with exactly eight own fields and image descriptors with exactly six own fields; reject symbol/extra/accessor keys. Backend has exactly three own callable data properties (produce, release, capture); normalize their receiver binding once at construction. Image input arrays are ordinary dense arrays of length0–16 with no extra/symbol keys or accessors. Caller paths are ordinary dense arrays of1–8 exact36-character UUID strings, checked against admitted paths; overlong arrays reject before element inspection. Output maps inspect at most16 admitted keys after rejecting a larger own-key count. Admission strings/units come from existing metadata, not caller coercion. Error message capture uses own data descriptors only and clips to1024 characters. Reflection itself may invoke Proxy traps or allocate an own-key list; these counts do not promise hard CPU/memory preemption against hostile Proxy implementations.

Complete is a one-shot **callback settlement notification**, even when its output capture fails, throws a trap, or discovers that disposal intervened. On entry claim the private notification flag and close issuance before capturing outputs. Catch capture/admission failures into the completion's stored primary error, mark callback settled once, preserve every existing backend observer, then reject completion after its required work settles. This terminal-notification path remains usable after dispose for the exact original scope, while rejecting all publication. It cannot be treated as a normal new-work admission that simply exits early on terminal state and strands the callback obligation. A second notification rejects without decrements. If capture reenters complete/fail, the claimed notification flag/guard prevents two notifications; dispose remains allowed and wins. Tests assert openCallbacks eventually0 after malformed output plus disposal, with pending backend still counted independently.
