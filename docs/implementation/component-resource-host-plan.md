# Component resource host implementation plan

> For agentic workers: use `superpowers:executing-plans` in one assigned Conductor leaf. Root dispatches each fresh worker and independent reviewer. Do not create child agents. Only C03c2b1 is the first source leaf after this exact plan passes independent review and integration.

**Goal:** own graph resources through callback, backend and physical-release settlement.

**Architecture:** keep the accepted synchronous reservation ledger unchanged. Add one internal host that authenticates runtime plans and issues separate scheduler, callback and backend surfaces. Split reuse, retry and epoch transition into C03c2b2. C03c3 cannot start until both host leaves pass their own source and integration gates.

**Tech stack:** existing TypeScript, Node v24.12.0, TypeScript 7.0.2 and Node test runner. No installs.

**Spec:** [resource plan](component-resource-plan.md), [scheduler plan](component-scheduler-plan.md), [nested graph plan](nested-graph-plan.md). Read all three. This document refines their host implementation boundary. It changes no scheduling, reset or promotion semantics.

## Scope and source baseline

Planning ticket: LUX-72, specification 2. Output: this document only.

Checkout: `C:/Users/zFlei/repos/lux/.worktrees/component-resource-host-plan`.
Branch: `codex/component-resource-host-plan`.
Base: `58ce79509ad0770a037b96aa9315cefad240f0f6`.
Accepted ledger source: `81f29cd2b80603e8cf8758246a2d93972a39a9be`.
Ledger integration: `6352ad9cf3a3ff3da90425f4a3827ed9702ffc07`.

The ledger already provides `ResourceCounts`, `resourceCapacities`, `ResourceReservation`, `ResourceLedger` and `createResourceLedger`. It has five fixed counters. Each reservation releases its entire captured vector. Release is authentic, owner-local and idempotent. Dropping a token changes no counter. No backend completion, allocation lifetime, physical release, cache, graph or callback exists in that module.

The accepted charge shape has exactly five own data fields. Those fields may be non-enumerable. Frozen and null-prototype records work. Preserve that behavior. The ledger accepts no getters, symbols, missing keys, extra keys, arrays or exotic prototypes. Its guard runs before reflection. Its snapshot is a frozen scalar copy. No new batch, partial release, cap override or test injection API is needed.

`readGraphRuntimePlan` authenticates the exact local capability without caller reflection. Its returned plan supplies actual paths, declared metadata, exact wired destination ports and resolved source ports. `nested-plan.ts` owns order, pruning, aliases and defaults. `node-random.ts` owns UUID path validation and RNG derivation. Keep the existing RNG algorithm and vectors. `single-image.ts` and the SDK remain the separate C02 root-image bridge with `EmptyInputs`.

## Global constraints

- Generation and clock epoch are nonnegative safe integers. Scene seed is uint32.
- Width and height are integers from 1 through 4096. Their product is at most 16777216.
- Image format is `rgba8unorm`. Color space is `linear-srgb`. Alpha mode is `premultiplied`.
- Fixed simultaneous caps are allocations 8192, backend operations 8192, input obligations 4096, frame readers 16 and captures 16.
- Cleanup operations use an internal counter bounded by 8192 allocations. They do not consume the ordinary backend counter.
- Preserve C03b admission limits. There are at most 512 reachable leaves, 16 declared outputs per leaf and 4096 reachable wired input ports.
- Terminal invalidation stops publication immediately. It does not prove physical settlement.
- No timeout, cancellation marker, dropped token, rejection or dispose call may free unresolved ownership.
- No timers, executable graph scheduler, authored instances, pixels, native backend, GPU, Studio, Resolume, portal, SDK/barrel/manifest changes or dependency installs.
- LUX-7 stays stopped. C03c3 scheduling, C03c4 authored reset and C03c5 promotion remain separate.

## Leaf decision and exact files

A single host leaf with epoch reset and cache retry has too many independent transition gates. An admission-only shell would not establish useful resource ownership. Select a complete terminal host first. It can evaluate a real admitted graph through explicit test calls and drain every obligation. It invokes no authored callback itself.

| Leaf | Exact paths | Deliverable |
| --- | --- | --- |
| C03c2b1 | Create `packages/runtime/src/graph/resources.ts`, `tests/runtime/graph-resources.test.ts`, `tests/runtime/graph-resources-async.test.ts` | Attachment, explicit node evaluation, cache ownership/release, final readers, capture, terminal drain and bounded failure evidence |
| C03c2b2 | Modify those three files only, under a fresh reviewed ticket against delivered b1 | Cache reuse, retry pin/presentation and internal epoch barrier |

All other files are protected owners. Tests may import current fixture constructors. Copy raw fixtures with `structuredClone` before mutation. Do not change frozen fixture owners. No public export is added. The b1 module does not export placeholder b2 functions. The full b2 signatures below are future contracts, not an available API claim.

## Types and callable surfaces

The following types live in `resources.ts`. Import `GraphRuntimePlan`, `NodePath` and `ResourceCounts` from their existing internal owners. Each opaque type has its own type-only unique symbol and runtime WeakMap. Tokens are frozen empty null-prototype objects. Do not put brands on runtime objects.

```ts
declare const hostBrand: unique symbol, frameBrand: unique symbol;
declare const scopeBrand: unique symbol, outputBrand: unique symbol;
declare const inputBrand: unique symbol, cacheBrand: unique symbol;
export type ResourceHost = Readonly<{readonly [hostBrand]: true}>;
export type ResourceFrame = Readonly<{readonly [frameBrand]: true}>;
export type EvaluationScope = Readonly<{readonly [scopeBrand]: true}>;
export type OutputToken = Readonly<{readonly [outputBrand]: true}>;
export type InputView = Readonly<{readonly [inputBrand]: true}>;
export type CachedOutputs = Readonly<{readonly [cacheBrand]: true}>;
export type HostProfile = Readonly<{
  generation:number; sceneSeed:number; initialClockEpoch:number;
  width:number; height:number; format:'rgba8unorm';
  colorSpace:'linear-srgb'; alphaMode:'premultiplied';
}>;
export type ImageDescriptor = Readonly<{
  kind:'image'; width:number; height:number; format:'rgba8unorm';
  colorSpace:'linear-srgb'; alphaMode:'premultiplied';
}>;
export type SignalDescriptor = Readonly<{
  kind:'signal'; value:number; unit:string|null; clock:'frame';
}>;
export type OutputMap = Readonly<Record<string,OutputToken>>;
export type InputMap = Readonly<Record<string,InputView>>;
export type BackendImage = Readonly<{
  generation:number; clockEpoch:number; version:number;
  nodePath:NodePath; portId:string; descriptor:ImageDescriptor;
}>;
export type CpuResourceBackend = Readonly<{
  produce(output:BackendImage, inputs:readonly BackendImage[]):void|PromiseLike<void>;
  release(image:BackendImage):void|PromiseLike<void>;
  capture(image:BackendImage):void|PromiseLike<void>;
}>;
export type CaptureHold = Readonly<{release():void}>;
export type FrameOutput = Readonly<{
  descriptor:ImageDescriptor; generation:number; clockEpoch:number;
  version:number; capture():CaptureHold; release():void;
}>;
export type CallbackResources = Readonly<{
  readSignal(input:InputView):SignalDescriptor;
  imageDescriptor(input:InputView):ImageDescriptor;
  signal(portId:string,value:number):OutputToken;
  image(portId:string,descriptor:ImageDescriptor,inputs:readonly InputView[]):Promise<OutputToken>;
}>;
export type Evaluation = Readonly<{
  scope:EvaluationScope; inputs:InputMap; resources:CallbackResources;
}>;
export type ResourceStatus = Readonly<{
  state:'active'|'resetting'|'terminal'|'drained'; clockEpoch:number;
  counts:ResourceCounts; openCallbacks:number;
  cleanupPending:number; releaseFailed:number;
}>;
export type ResourceErrorCode = 'RESOURCE_INVALID'|'RESOURCE_CAPACITY'|
  'RESOURCE_REENTRY'|'RESOURCE_STALE'|'RESOURCE_TERMINAL'|
  'RESOURCE_BACKEND'|'RESOURCE_CLEANUP';
export type ResourceFailureDetail = Readonly<{
  code:'RESOURCE_CLEANUP'; version:number; nodePath:NodePath;
  portId:string; message:string;
}>;
export type ResourceError = Error & Readonly<{
  code:ResourceErrorCode; unreclaimed?:number;
  cleanupFailures?:readonly ResourceFailureDetail[];
}>;
export function createResourceHost(profile:HostProfile,backend:CpuResourceBackend):ResourceHost;
export function attachResourceHost(host:ResourceHost,plan:GraphRuntimePlan):void;
export function beginResourceFrame(host:ResourceHost,clockEpoch:number):ResourceFrame;
export function openResourceNode(host:ResourceHost,frame:ResourceFrame,nodePath:NodePath):Evaluation;
export function completeResourceNode(host:ResourceHost,scope:EvaluationScope,outputs:unknown):Promise<CachedOutputs>;
export function failResourceNode(host:ResourceHost,scope:EvaluationScope):void;
export function releaseResourceCache(host:ResourceHost,cache:CachedOutputs):void;
export function finishResourceFrame(host:ResourceHost,frame:ResourceFrame):FrameOutput;
export function disposeResourceHost(host:ResourceHost):Promise<void>;
export function readResourceStatus(host:ResourceHost):ResourceStatus;
```

These free functions are scheduler-only. The future scheduler keeps `scope`. It passes only `inputs` and `resources` to evaluate. Callbacks get no host, frame, cache, ledger, backend, arbitrary retain or release method. Backend methods receive detached immutable descriptor records and frozen arrays. They get no token or input view. This is local capability separation in a trusted adapter. It is not protection against arbitrary same-process imports or replaced intrinsics.

Capture exactly eight own data profile fields and three own callable backend fields. Accept ordinary or null-prototype records, including non-enumerable data fields. Reject accessors and extra/symbol fields. Capture receiver and callable identity once; use the captured receiver on invocation. Freeze copied descriptors and method wrappers. Do not retain mutable profile input. Authentic attachment occurs once; attaching the same plan twice rejects. An invalid initial attachment leaves the host unattached. No work starts until attachment succeeds.

## Identity, capture and error contract

Private records bind owner identity, authentic plan identity, immutable generation, current epoch, frame evaluation ID, exact producer path and declared port. Matching numbers alone grant no authority. Versions and evaluation IDs start at 1 and never rewind or repeat. Reject exhaustion before reservation, issuance or dispatch. Test the private checked increment through a copied test-only fixture at `Number.MAX_SAFE_INTEGER`; do not export a setter or claim that many actual evaluations ran.

Capture paths as ordinary dense arrays of 1–8 own data UUID strings. Reject length above 8 before element inspection. Each string has exactly 36 UTF-16 units and must match an admitted path segment exactly. Preserve UUID case. Use nested maps or JSON encoding of captured arrays for keys. Never concatenate path delimiters. Compare against reachable plan nodes, not definitions or catalog names.

Capture image descriptors as exactly six own data fields. Values must equal the host profile plus `kind:'image'`. Capture image input lists as ordinary dense arrays with 0–16 own data elements, no extra/symbol keys or accessors. Elements are distinct view identities from this open scope. Two distinct destination ports that share an allocation are legal. Passing the same view twice rejects. Signal inputs cannot appear in an image dispatch list.

Capture output maps as ordinary or null-prototype exact own-data records. Check own key count before descriptors. Require every declared output, including unused outputs. Reject getters, symbols, extra/missing keys and wrong producer-port tokens. Do not require enumerability in these new host captures. Bound output inspection to 16 admitted ports. Treat reflection and thenable assimilation as callouts. A Proxy can perform arbitrary work in a trap; these data bounds are not hostile-process CPU preemption.

Errors are `Error` objects with a readonly code from `RESOURCE_INVALID`, `RESOURCE_CAPACITY`, `RESOURCE_REENTRY`, `RESOURCE_STALE`, `RESOURCE_TERMINAL`, `RESOURCE_BACKEND`, `RESOURCE_CLEANUP`. Use INVALID for malformed data, forged/foreign tokens, wrong kind/port and invalid ordering. Use STALE for authentic closed/released evaluation authority. Use TERMINAL for new work after terminal state. During resetting, new frame admission uses STALE. Use CAPACITY for all fixed-cap and safe-integer exhaustion failures. Translate ledger capacity errors at the host boundary; keep the ledger unchanged.

Store the first normalized host failure as primary. Preserve its code and bounded message when later cleanup fails. Store no arbitrary thrown value or `cause`. Error capture may inspect only own data `message`; never stringify, coerce, read error accessors or traverse prototypes. A non-string or inaccessible message uses fixed text. Clip each message to 1024 characters. Catch reflection failure during error capture and use fixed text. Later errors cannot replace the primary or restore publication.

## Ownership records and reservation groups

The host owns one ledger. It never exposes its tokens. Keep separate ledger tokens for independently settled dimensions. Do not reserve allocation and backend in one ledger token: a successful producer must release the backend slot while its allocation remains live.

For each admission, first capture and validate caller data under the host guard. Read one ledger snapshot. Check the complete charge vector in ledger field order against cap minus current count. Obtain one-dimension reservations from internally constructed fixed records, with no caller/backend callout between them. Publish nothing until all reservations exist. If acquisition fails before dispatch, release acquired tokens in reverse order. Do not consume a version, port or frame ID on this failure. This uses the existing ledger; it adds no partial release.

For a frame, preflight the total reachable input count, then reserve one `inputs:1` token per destination port. No token is needed for zero input count. Store exact planned source address on each obligation. Bind it to the allocation when its source completes. Two ports sharing one source receive two reservations. There is one open frame per host and one open callback notification at a time. Frame inputs from prior frames must have drained before another frame begins.

| Record | Reservation and holds | Release condition |
| --- | --- | --- |
| Signal allocation | One allocations token; producer notification, consumers, cache and optional frame-final holds | All holds end; no backend release call |
| Image allocation | One allocations token; producer notification/backend, consumer reads, cache, frame-final, reader, capture and future retry holds | All nonrelease holds end, then one successful physical release |
| Produce | One backend token; selected input-port read counts | Returned value or thenable settles, once; rejection is operation settlement, not physical release |
| Destination port | One inputs token; callback-notified flag and zero or more backend reads | Callback notification received and every recorded read settled; unopened cancellation only after dispatch is impossible |
| Cache | One pin per declared output; one authentic cache token | Explicit cache release, or terminal drain drops the pins |
| Current final output | One internal frame-final hold on the selected resolved allocation | Successful transfer to frame reader, or terminal frame retirement |
| Frame reader | One frames token and allocation hold | Reader release, exactly once |
| Capture | Separate captures token and backend token; independent allocation hold | Capture token and allocation hold end only after external release intent AND backend settlement |
| Physical release | `cleanupPending` counter, same allocation token | Success frees allocation; failure preserves it as unreclaimed |

A backend image operation can use one input port in several different declared output operations. Count every such read. At most 16 image outputs and 16 selected inputs per callback bound these records to 256 per callback. Across live operations the coarse bound is 8192 times 16 read links. These links have no extra ledger dimension. The existing inputs reservation remains live until all links for its destination port settle.

Keep strong records only while they own a live obligation. Live allocation records are bounded by 8192. Live input records are bounded by 4096. Reader and capture records are bounded by 16 each. Active frame node records are bounded by 512. Each live cache pins at least one output of a reachable node and is bounded by live allocation pins; allow at most one new cache per completed node evaluation, without a public retain operation. Remove released cache/frame/scope records from host strong collections. WeakMaps may retain a minimal released marker while a caller retains its token. Drop arrays and descriptor references from settled records when authenticity checks no longer need them. Do not keep a growing event history or completed-promise queue.

## Node issuance and completion

`beginResourceFrame` checks attachment, active state, exact current epoch and no open frame. It reserves the frame input group before publishing a new frame ID/token. `openResourceNode` requires the exact host/frame, a reachable unselected path and complete predecessor output bindings. It marks the node selected, opens one scope and creates fresh views for its declared inputs. A view binds destination path/port and the actual source allocation/version. Read methods require that exact open scope and kind. A view cannot become an output. A prior evaluation view always rejects, even when the underlying allocation still exists.

`signal` validates a declared unissued signal port and finite number. It derives unit and frame clock from metadata. Reserve one allocation, commit a new version/issued port and return its token synchronously. `image` validates a declared unissued image port, exact descriptor and input views. Reserve allocation and backend separately as one admission group. Commit the version, issued port, producer record and all selected input reads before invoking backend code. No scratch output, input alias, in-place transform or cross-port token reuse is supported.

`image` is a non-async admission wrapper. Invalid admission returns a rejected promise with an internal observer; it causes no dispatch or counter change. A committed operation gets an observer before its captured backend call executes. The backend call runs after the host admission guard leaves. Observe synchronous throws, rejected promises and arbitrary thenables through one once-settlement path. Internal observation must also cover the author-facing promise if it is abandoned. On backend rejection, terminalize immediately. Never rollback dispatched ownership. A late success after invalidation cannot publish a usable token; reject the author-facing result with the stored terminal failure while retaining cleanup responsibility.

`completeResourceNode` and `failResourceNode` are one-shot callback settlement notifications. The scheduler calls one after authored evaluate settles. They do not execute or await authored code themselves. Authenticate the exact scope first. Claim its notification flag and close issuance before output reflection. A second complete/fail rejects without changing counts. A nested complete/fail during guarded capture rejects before claiming a second notification.

Complete must remain usable for the original unnotified scope after disposal. Mark callback notified once even when output capture fails, throws a trap, or discovers terminal state. Close views immediately. Record capture failure as primary when no earlier error exists. Observe and wait every issued producer, including omitted and abandoned output promises. Input callback notification alone cannot clear pending backend reads. After valid capture and all successful producers, recheck active state, owner/frame/epoch and mutation marker. Then create a cache with every declared output, bind frame consumers and the selected final hold, and resolve. Otherwise terminalize and reject after required producer settlement. An invalid map never strands `openCallbacks` at 1.

The serial evaluation slot remains occupied until completion settles, even after openCallbacks reaches 0. Reject opening another node while the prior completion waits for producers. This keeps the pending-produce bound at 16. A completion Promise has its own internal rejection observer. `openCallbacks` counts notifications still owed, not pending completion Promises.

Fail closes issuance and marks callback notified synchronously. It terminalizes with a fixed callback-failure message if there is no earlier primary. It retains every pending producer and input read. The resource API cannot assert that authored cleanup was performed. The future scheduler separately owns captured instance disposers and its original authored error.

`releaseResourceCache` authenticates ownership and marks released before dropping pins. Duplicate release does nothing. It prevents later reuse but does not revoke current input, backend, frame-final, reader or capture holds. When replacing a cache, the future scheduler keeps the old pins until new completion succeeds. Both allocations count during replacement. Unused declared outputs own a cache pin without invented consumers.

## Publication, capture and terminal drain

`finishResourceFrame` requires every reachable node completed, no open scope or pending produce, and a valid final image. Reserve one frame reader before changing the frame. Copy its immutable descriptor, generation, epoch and version. Transfer the final hold to that reader and retire the frame token. Capacity failure leaves the frame and final hold intact. The scheduler then terminalizes the failed frame; it must not rerun partially advanced simulation.

A reader's release marks its private flag before releasing its frame token and allocation hold. Duplicate calls do nothing. New capture requires an unreleased reader, active host and matching epoch. Capture reserves separate capture/backend tokens, records the hold and observer, then invokes backend outside the guard. It returns a frozen hold synchronously. A synchronous backend throw is a recorded settled failure; the returned hold remains the caller's release responsibility. Backend rejection terminalizes but cannot clear an unreleased hold. Releasing the reader does not release the capture. Capture release marks external intent; repeated calls do nothing. The capture remains counted until both external intent and backend settlement occur. No capture result pixels are returned.

Images become physical-release eligible only when every nonrelease hold is zero. Mark release attempted and increment cleanupPending before invoking captured release outside the guard. Ordinary backend capacity must not block cleanup. A pending release keeps its allocation token and cleanupPending. A successful settlement releases that allocation token exactly once. A thrown/rejected release decrements cleanupPending, increments releaseFailed and keeps the allocation token. Do not retry it. Reject later host work after such failure.

Retain one normalized cleanup failure per failed allocation, at most 8192. Store only fixed code, version, admitted path/port and a message of at most 1024 characters. An unreclaimed allocation is still visible in `counts.allocations`. Store no arbitrary thrown object. An aggregate cleanup error has a bounded summary message and frozen bounded failure records. Repeated status reads return detached frozen scalar snapshots. Repeated disposal preserves known failure records and unreclaimed counts.

`disposeResourceHost` must return its stored promise directly. It is not an async function. On its first call, allocate and store the deferred completion before any callout. Enter terminal state and revoke issue/publication synchronously. Calls from reflection or backend reentry return that exact promise.

Drain proceeds as follows:

1. Close frame/node admission. Cancel only never-opened destination obligations after marking those nodes unable to open. They cannot have dispatched backend work.
2. Wait each open callback's one notification and every registered producer operation. Closing a scope cannot invent its notification. Keep abandoned work observed.
3. Drop all cache and future retry pins. Retire the terminal frame-final hold. Keep any consumer/backend/read/capture obligations that remain unresolved.
4. Wait readers, captures and their backend work. Start each eligible physical release exactly once. Attempt independent eligible releases even when another release failed.
5. If any callback, backend operation, external hold or release is pending, keep disposal pending. Once all attempts are settled, resolve and enter drained only if allocations are zero. Otherwise reject with bounded cleanup evidence and keep state terminal with unreclaimed counts.

Resource failure automatically starts the same terminal drain path and stores the same disposal promise, with an internal rejection observer. A later explicit dispose returns it. No timer completes this process. An outer process supervisor may have its own policy, but that policy cannot prove in-process physical release.

## Reentry and linearization

Use a host-local admission guard before all caller reflection. Nested new-work admissions reject RESOURCE_REENTRY before inspecting their arguments. Snapshot/status and authentic token lookup use no caller reflection. Complete is a settlement notification, but its output capture still uses the guard and one-shot notification flag.

Dispose and authentic cache/reader/capture release remain permitted during reflection. Commit terminal/released flags immediately. Replace a private mutation marker on each such transition. Queue backend callouts until the guard leaves. Outer admission captures the marker and checks it after every caller-capture phase and immediately before reservation/commit. A trap that disposes or releases required authority prevents stale outer issuance. Do not use an unbounded numeric revision that can silently lose precision.

Commit all reservation/port/obligation state before invoking backend or assimilating its result. Release the guard before callouts. Reentrant backend code sees occupied capacity and the already issued port. Synchronous then-getter failure is a backend failure after dispatch, not an admission rollback. Multiple fulfill/reject calls pass one private settlement flag. Promise continuations recheck publication authority. They never set active after terminal state.

Do not call user code from ledger reservation groups, snapshot construction or once-settlement counter changes. Error normalization is also a callout; guard its reflection, preserve the first failure before normalizing secondary errors, and recheck state before further admission. Drain scheduling must avoid recursive backend-release chains growing with 8192 allocations: queue committed release records and process them iteratively through microtasks, with no timer and no unbounded new operation list.

## C03c2b2: reuse, retry and epoch barrier

Prepare a fresh implementation ticket after b1 source acceptance and integration. Reconcile this contract against the actual b1 API before dispatch. Add only the following surfaces to the same internal module:

```ts
declare const retryBrand: unique symbol;
export type RetryPin = Readonly<{readonly [retryBrand]:true}>;
export function reuseResourceNode(host:ResourceHost,frame:ResourceFrame,nodePath:NodePath,cache:CachedOutputs):void;
export function pinResourceRetry(host:ResourceHost,frame:ResourceFrame):RetryPin;
export function presentResourceRetry(host:ResourceHost,pin:RetryPin):FrameOutput;
export function releaseResourceRetry(host:ResourceHost,pin:RetryPin):void;
export function resetResourceEpoch(host:ResourceHost,nextEpoch:number):Promise<void>;
```

Reuse authenticates host, exact path, current epoch and unreleased cache. It requires the node unselected and predecessors bound. It binds unchanged versions into this frame. It cancels that node's unopened input callback obligations because no callback or backend read occurred. It creates no output allocation and no replacement cache token. Downstream open calls create fresh views. The scheduler alone checks its accepted full cache key: generation, path, definition hash, epoch, tick, ordered input versions and effective control sequence.

Pin requires a completely successful current frame. Allow exactly one retry pin per host. Pin the resolved final allocation before frame finish. The old pin must be explicitly released before replacement. PresentRetry authenticates a live pin and current epoch, then reserves a fresh bounded reader. It executes no callback and changes no version. Reader capacity failure keeps the pin unchanged. Retry release is authentic and idempotent. Terminal disposal releases its pin. These rules preserve the scheduler's last-successful-advance result even when a later present changes controls.

Reset is an internal resource barrier only. Require active host, no open frame/callback and `nextEpoch === currentEpoch + 1` with safe-integer headroom. Set resetting synchronously, revoke caches/views/retry authority and drop pins. Wait all backend, reader, capture and cleanup ownership. Publish the new epoch and active state only if the transition marker still owns state and cleanup succeeded. Versions and evaluation IDs never reset. Dispose during reset wins permanently. Its late continuation cannot reactivate the host; reset rejects RESOURCE_TERMINAL after required drain. Cleanup failure terminalizes. No frame can start while resetting.

This barrier does not reset an authored instance, RNG, controls or simulation time. C03c4 retains effective controls, resets path RNG and invokes instances in plan order, then establishes tick 0/time 0. Do not add targeted reset, time inference, automatic cache-key decisions or promotion here. The scheduler's numeric diamond remains 6 to 8 to 16 under its accepted controls/update rules. No resource test may substitute for that later scheduler evidence.

## Actual planning probes

The probes used the current checkout and actual admission, runtime-plan and ledger owners. They did not implement or execute a resource host. The fake backend is a set of explicit deferred CPU promises. Its manual ledger calls only prove that independent tokens can express independently settled obligations. Labels such as callback finished in that manual probe are fixture events, not authored execution evidence.

| Probe input | Actual result | Artifact |
| --- | --- | --- |
| Image diamond A to B/C, B/C to D.left/right | Four reachable paths, four input addresses, B/C same definition and distinct paths | `feasibility.json`, `fixtures.json` |
| Both D.left/right from B.image | Three reachable paths A/B/D; two destination ports share B's source path/port; C pruned | `feasibility.json`, `fixtures.json` |
| A declares image and unused signal | Both output keys preserved; four wired inputs unchanged | `feasibility.json`, `fixtures.json` |
| Authentic capability clone and Proxy wrapper | Both rejected by current runtime-plan reader | `feasibility.mjs`, `feasibility.log` |
| Five non-enumerable charge data fields | Allocation reservation succeeds and releases to zero | `feasibility.mjs`, `feasibility.log` |
| One manual allocation, one producer and two input tokens | Vectors `(1,1,2,0,0)`, then `(1,0,0,0,0)` after observed produce, then zero only after observed release | `feasibility.json` |
| Full reachable input fixture | 257 leaves, 4096 inputs, zero pruned leaves, raw 88696 bytes | `capacity-feasibility.json`, `capacity-fixtures.json` |
| One leaf with 16 declared image outputs | All 16 output keys admitted; raw 3335 bytes | `capacity-feasibility.json`, `capacity-fixtures.json` |

The 4096-input graph is constructible under simultaneous caps. One producer exposes 16 signals. Fifteen placed groups each contain 16 consumers with 16 signal inputs and one 16-image aggregator. A final node consumes the 15 group images and one producer signal. Root has 17 nodes and 256 edges. Each group has 17 nodes and 16 edges. All 257 leaves are reachable. Expanded input count is `15*16*16 + 15*16 + 15 + 1 = 4096`. Use this authentic fixture to test host frame reservation. A 4097-input graph cannot enter the host because C03b rejects it; use direct ledger evidence for +1.

Exact compact JSON hashes:

| Fixture | SHA256 |
| --- | --- |
| Diamond | `454c136db5262dff7d185c7090f34d8089008e8986ea07ac5589d2b95a3c9bf5` |
| Parallel ports | `e40c0606ca8ea57b0f60e299b055f70fdf9b4fa2d1732409f14b1ce502e8b62f` |
| Unused output | `2c36891c6ced92fa9c02749016527b276a59cd57f33ed704518788d3701420c3` |
| 4096 inputs | `1e585d323020b6503beb3ca19eb869aad1141a2752e7a899034ad59a29189a3c` |
| 16 outputs | `8bf7734269db0c142519c4145e37b52b78f0304a34f1e9737dc86159aa5ba952` |

## Implementation evidence contract

All rows require the assigned isolated checkout containing this independently accepted plan and exact delivered dependencies. Record the actual full source SHA, base, branch, Node/compiler versions, executor identity/session/claim, command, cwd, exit and raw artifact. A distinct reviewer repeats selected known-answer and adversarial cases at the full submitted SHA. Root compares accepted source/owner hashes and reruns focused checks at a separately recorded integration SHA.

Use explicit deferred resolve/reject controls. Wait the registered settlement handler's event before asserting counters. Do not use sleeps or guessed microtask counts. Settle every deliberately pending promise at the end of the test. Keep the original failed assertion logs. A finite pending observation proves only retained ownership at that observation.

| Criterion / leaf | Required setup and method | Literal result / evidence |
| --- | --- | --- |
| H1 attachment and shape / b1 | Two real prepared plans, two hosts with generation 7/epoch 3/1920x1080; original, clone, Proxy and foreign capabilities; frozen/non-enumerable own data profiles | Authentic attach once; repeated/forged attach rejects; wrong shape/dimension causes zero backend calls and unchanged counts; `authority.log` |
| H2 per-port authority / b1 | Real parallel fixture; open A, B, then D with both bound ports; pass distinct views, same view twice, old/foreign views and signal views | Two destination reservations and one source allocation; backend receives two descriptor entries in requested order; rejected cases dispatch zero; `ports-events.json` |
| H3 all outputs and notification / b1 | Unused-output fixture; issue A.image and A.unused signal, then omit either, swap token keys or supply accessor/symbol/extra map; notification after dispose | All declared outputs required. No getter invocation. One notification only. openCallbacks becomes 0 even on malformed capture. Pending producer remains counted; `completion-events.json` |
| H4 abandoned producer / b1 | Diamond: A completes, B starts a deferred image using A, then scheduler calls fail without awaiting image; C never opens | Terminal immediately; publication count 0. C unopened input obligation cancels. A release calls remain 0 while B backend read pending. After produce observer and terminal pin drop, A and B each get one physical release; `abandoned-events.json` |
| H5 two input reads / b1 | Parallel fixture; D uses both views in one pending produce; complete notification occurs before its settlement | Both port input reservations survive callback notification. One backend settlement ends two reads; no duplicate release of B allocation; `parallel-events.json` |
| H6 final hold and cache replacement / b1 | One-node real plan; complete, release its cache before finish; then finish and release reader. Also retain old cache while a new frame replaces it | Final hold prevents early release. Old and new allocations both count during replacement. Unused output loses only its own cache pin. No implicit eviction; `cache-events.json` |
| H7 reader/capture ownership / b1 | One final allocation; release cache; reader captures through deferred backend, then duplicate reader and capture release | Vectors `(1,0,0,1,0)` then `(1,1,0,1,1)` then `(1,1,0,0,1)`. Capture release before settlement keeps that vector. Backend settlement starts one release; successful cleanup yields zero; `capture-events.json` |
| H8 release failure and same disposal / b1 | Produce succeeds; deferred release rejects, and a second case throws synchronously; keep arbitrary error getter sentinel | releaseCalls 1, cleanupPending 0, releaseFailed 1, allocations 1. Dispose rejects, subsequent dispose is same promise, no retry and no getter call; `cleanup-events.json` |
| H9 unresolved ownership / b1 | Separately defer callback notification, produce, capture external release, capture backend and physical release | Dispose stays pending and corresponding counts/records remain. Resolve each controlled source, observe handlers, then zero or recorded known cleanup failure. No timeout conclusion; `pending-events.json` |
| H10 reentry / b1 | Each getPrototypeOf/ownKeys/getOwnPropertyDescriptor hook on path, image descriptor and output map calls dispose. Backend/then getter reenters same port, captures status and disposes | Outer stale publication 0; committed backend reservation visible; terminal permanent; complete notification still drains; duplicate then callbacks settle once; `reentry-events.json` |
| H11 exact host capacities / b1 | 4096-input authentic plan: begin then dispose unopened frame. One-node 16-output plan: 512 sequential complete frames, retain caches, release each reader. Also retain 16 readers from 16 successful frames and 16 captures | inputs 4096 then 0; allocations 8192 then next issue rejects before dispatch; readers 16 then reader17 rejects; captures16 then capture17 rejects with backend unchanged. Release all holders. Record each setup separately; `host-bounds.json` |
| H12 group rollback / b1 | Run exact private group helper in a test-only copied module; make its second internal ledger reserve throw before dispatch; preserve original source | First token released, all counts unchanged, port/version unconsumed, no callout. Restored helper passes. No production injection option; `group-fault.log` |
| H13 bounded retention / b1 | 8192 retained allocations from H11, terminal disposal, each release rejects once; all callbacks/producers already settled | Exactly 8192 failed allocation records, bounded messages, no historical success records, allocations8192, same disposal rejection. No arbitrary causes; `failure-bounds.json` |
| H14 immutable API/type isolation / b1 | Strict negative type fixture plus runtime clones/foreign tokens; mutate original descriptor/profile/output inputs | InputView cannot assign to OutputToken; backend has no token; callback has no scheduler/retain method. Returned snapshots remain frozen, detached and unchanged; `types-negative.log`, `immutable.log` |
| H15 reuse and retry / b2 | A cache from frame1 version1, real frame2 reuses A, downstream gets fresh views; one retry pin, then 16 presentation readers | A produceCalls1, version1; new view identity, old view rejects; pin2 rejects; retry has no callback/version change; old reader cannot revive; `reuse-retry-events.json` |
| H16 epoch barrier / b2 | Epoch3 cache and held capture; request epoch4; then release/settle and separately dispose while resetting | New frame rejected during reset; success epoch4, old tokens stale. Dispose branch stays terminal and rejects reset after drain. IDs/versions advance; `epoch-events.json` |

Backend cap8192 and cap+1 remain direct delivered-ledger tests. Serial host execution permits only one callback with up to16 pending produces plus16 pending captures, so 8192 simultaneously pending ordinary backend operations is not a reachable host-positive fixture in this profile. Do not weaken serial semantics or add a public test-only authority to manufacture that state. Existing ledger tests cover aggregate full vectors and each cap+1. Host tests must still verify use of that ledger and group preflight. Safe-integer exhaustion uses the private checked helper boundary, not impossible runtime iteration.

## Concrete test steps

The implementation worker creates the three selected files only. Build fake backend controls in the test files, without introducing a reusable application backend. A minimal controlled promise is:

```ts
function deferred<T>() {
  let resolve!: (value:T|PromiseLike<T>)=>void;
  let reject!: (reason?:unknown)=>void;
  const promise = new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
const produce = deferred<void>();
const release = deferred<void>();
const releaseEntered = deferred<void>();
const calls: string[] = [];
const backend: CpuResourceBackend = Object.freeze({
  produce() { calls.push('produce'); return produce.promise; },
  capture() { calls.push('capture'); },
  release() { calls.push('release'); releaseEntered.resolve(); return release.promise; },
});
```

Use actual `basic()`, `validateNestedGraph` and `prepareGraphRuntimePlan` for the first terminal assertion. The common profile is the exact eight-field profile above with generation7, sceneSeed0, initialClockEpoch3, width1920 and height1080. The image descriptor is that profile's width/height/format/color/alpha plus kind, with no generation or seed keys.

```ts
const profile: HostProfile = Object.freeze({generation:7,sceneSeed:0,
  initialClockEpoch:3,width:1920,height:1080,format:'rgba8unorm',
  colorSpace:'linear-srgb',alphaMode:'premultiplied'});
const descriptor: ImageDescriptor = Object.freeze({kind:'image',
  width:1920,height:1080,format:'rgba8unorm',colorSpace:'linear-srgb',
  alphaMode:'premultiplied'});
const raw = basic();
const plan = prepareGraphRuntimePlan(validateNestedGraph(raw.graph,raw.definitions));
const host = createResourceHost(profile,backend);
attachResourceHost(host,plan);
const frame = beginResourceFrame(host,3);
const evaluation = openResourceNode(host,frame,[uuid(1)]);
const pending = evaluation.resources.image('image',descriptor,[]);
failResourceNode(host,evaluation.scope);
const disposal = disposeResourceHost(host);
assert.equal(disposeResourceHost(host),disposal);
assert.deepEqual(readResourceStatus(host).counts,
  {allocations:1,backend:1,inputs:0,frames:0,captures:0});
assert.equal(calls.filter(x=>x==='release').length,0);
produce.resolve();
await assert.rejects(pending); // terminal publication is suppressed
await releaseEntered.promise;
assert.equal(readResourceStatus(host).counts.allocations,1);
assert.equal(readResourceStatus(host).cleanupPending,1);
release.resolve();
await disposal;
assert.deepEqual(readResourceStatus(host).counts,
  {allocations:0,backend:0,inputs:0,frames:0,captures:0});
```

The deferred `releaseEntered` control records actual backend release entry. It does not infer settlement from arbitrary microtask flushing.

- [ ] Write H1–H14 tests and the actual graph fixtures. Run the new suites. Retain missing-module failure as setup evidence only.
- [ ] Implement token capture and closed admission groups. Run H1/H2/H11/H12/H14. Retain behavioral failing assertions before fixes.
- [ ] Implement issuance, notifications, caches and final holders. Run H3–H7. Record each destination port and allocation version in event artifacts.
- [ ] Implement terminal drain, cleanup and reentry. Run H8–H10/H13. Each emitted event records notification, issue closure and backend settlement separately.
- [ ] Test copied mutations that free allocation at produce settlement, omit terminal continuation checks and retry failed physical release. Each must fail a behavioral assertion. Restore and rehash the original module. Loader failures do not count.
- [ ] Run the combined CPU suites and both actual TypeScript configurations. Check every protected owner hash and the exact three-file diff.
- [ ] Commit the tested source with full SHA. Submit criteria, raw evidence and remaining b2 scope. Release through submission and stop the worker session.
- [ ] A fresh independent reviewer repeats selected lifecycle, cap, trap and type cases at that exact SHA. Root integrates serially under its own ticket and records exact landed SHA and combined checks.

For b2, the fresh worker adds H15/H16 first, then implements only the five listed functions and their private state. Repeat all b1 tests and owner checks. Review and integrate b2 before preparing c3 source work.

### Backend allocation identity and failed production

Create one frozen `BackendImage` object for each image allocation. Pass that same object to produce, later input lists, capture and release. Its descriptor and path are detached immutable copies. A backend can key a private WeakMap by this object identity. Two hosts with equal numeric profile/path/version values still produce distinct objects. Do not reconstruct backend allocation identity from a concatenated scalar key. Callback descriptor reads return immutable descriptor data and never this backend object.

The trusted backend must accept one release for every registered image produce attempt, including a produce that throws or rejects after partial allocation. Release succeeds only when absent or partial physical state is safely reclaimed. A backend unable to establish that fact must reject or remain pending. The host then preserves unreclaimed ownership. No successful produce result is required before registering cleanup responsibility. Test equal-valued images from two hosts against one fake backend WeakMap. Test rejected production followed by successful and failed cleanup separately.

## Commands, owner hashes and planning handoff

Run from the exact assigned checkout with the existing Node executable. Add the selected host suites only when they exist:

```text
C:/Program Files/nodejs/node.exe --test tests/runtime/graph-resource-accounting.test.ts tests/runtime/graph-runtime-plan.test.ts tests/runtime/node-random.test.ts tests/runtime/graph-validation.test.ts tests/runtime/graph-plan.test.ts tests/runtime/component-single-image.test.ts tests/runtime/nested-graph-validation.test.ts tests/runtime/nested-graph-plan.test.ts tests/runtime/seed.test.ts
C:/Program Files/nodejs/node.exe --test tests/runtime/graph-resources.test.ts tests/runtime/graph-resources-async.test.ts
C:/Program Files/nodejs/node.exe C:/Users/zFlei/repos/lux/node_modules/typescript/bin/tsc --noEmit
C:/Program Files/nodejs/node.exe C:/Users/zFlei/repos/lux/node_modules/typescript/bin/tsc -p tsconfig.examples-v2.json --noEmit
```

Use PowerShell invocation syntax and quote the executable path containing spaces. Use `--ignoreConfig` only for an explicit-file temporary declaration fixture. The first command ran during this planning task: 114 tests passed, zero failures/skips. Both actual TypeScript configurations passed. Those results cover existing owners, not future host tests. The two planning probes also passed. The declaration-only extraction of both proposed API blocks passed a strict TypeScript check against current imports. This checks type consistency, not host behavior. No application source changed.

Planning evidence directory: `C:/Users/zFlei/repos/lux/.worktrees/_coordination/LUX-72`.
Executor: `/root/resource_host_plan`.
Stable agent: `0d7f5d43-135f-42fd-a384-d0ec2d151264`.
Session: `68ff3222-bcf5-48d5-8a26-b06f58d0751d`.
Claim: `9b755234-f4ad-43f8-a42c-841c90af77dd`.
Run: `345554f0-0896-4ea2-8fb4-942317f65fda`.

Evidence files: `ack-input.json`, `ack.json`, `ready.json`, `claim.json`, `feasibility.mjs/json/log`, `fixtures.json`, `capacity-feasibility.mjs/json/log`, `capacity-fixtures.json`, `baseline.log`, `types.log`, `examples.log`, `planned-api.ts/log`, `verify.mjs` and final `verification.json`. The claim receipt follows own epoch1/challenge1 ACK and dynamic ready=true. Root was sent the full receipt before any later child launch.

Accepted ledger evidence remains separate: main `.worktrees/_coordination/reviews/LUX-68/review.md`, main `.worktrees/_coordination/LUX-68/verification.json` and `docs/conductor-onboarding/resource-ledger-main-evidence.md`. Their source and integration executor claims were not reattributed. The current probe matched all 15 accepted ledger-source/owner hash and length entries. The extended current manifest follows.

| Protected path | Bytes | SHA256 |
| --- | ---: | --- |
| docs/implementation/component-scheduler-plan.md | 41233 | `df2a55c17a679f788fea9f5a57ae11063f5a7ffbdf36adeef294f73a09684c69` |
| packages/runtime/src/graph/runtime-plan.ts | 1086 | `9953a2fb8efb31733cfb9ce8bfacca85cfb4de361bcdaa82bdede1a5a7db95be` |
| packages/runtime/src/graph/node-random.ts | 2331 | `a15925201738f3169eb9cc2e11343690cd022d76808d07a2b40f420068526df5` |
| packages/runtime/src/graph/nested-plan.ts | 4753 | `d37eb6ddba5508de1af0ef17289a778226bd032bc9ef73106facd46e9405917e` |
| packages/runtime/src/graph/nested-validate.ts | 22960 | `18d038b69c512629c72e677791af90bb8694a4e5612f8a58fcdce6154bc240fd` |
| packages/runtime-contracts/src/graph.ts | 1583 | `f1a6ed2303146af7f0f5bef31ea2a5f93e4fd094177e91d8b0c98d8113ea73eb` |
| packages/runtime-contracts/src/nested-graph.ts | 2535 | `bdfaaa33ed02583c72e27766b5b7cb1a50917f52d0687a6cfe4e39989b32aefd` |
| packages/runtime-contracts/src/components.mjs | 7226 | `06b8b897b2237b410018aaab81903b45b660ef292867fffb2b2b21a50f00d4bc` |
| packages/runtime-contracts/src/components.d.mts | 1638 | `903e8acbbcfef0479c411787a77a17e5da6b8582d24b4b742e1c473651899c93` |
| packages/runtime/src/seed.ts | 1040 | `bc213d3723fc556ef47b8ed8ef743799e13af94c16330dec919a8fc12037b35a` |
| packages/runtime/src/clock.ts | 2435 | `aa940865afebddad8a02429de553623c5d57fd2a28ef51b022c3552413acbadd` |
| packages/runtime/src/components/single-image.ts | 4761 | `9e246d9f9bc82d0d3e88351feef673f358772c09c9be737104a3123baefc9163` |
| packages/visual-sdk/src/sdk-components.ts | 3121 | `a868cee008d37a3d5f0710d387a20682fa8ca15b0b2023711a47f8cb6df6cff9` |
| packages/runtime/src/graph/resource-accounting.ts | 3922 | `699e8df143d5d9b85fe0f13190e222e938c3f503cd77274d9d7c16c7a8c1a59c` |
| tests/runtime/graph-resource-accounting.test.ts | 13292 | `1e3ff09a5fb4241d1e21927dae86a4bd63b075758278571a2f60fc4cf801749d` |
| docs/implementation/component-resource-plan.md | 38401 | `f32f4a1f5aaa2e54f11aa079570674764521b7e5c60c284b49e5cb17f9ff93f3` |
| docs/implementation/nested-graph-plan.md | 23221 | `7f21b1587cb173ec5526886c80b23a34ac7656be7946d9dc6796b635f9c2c84c` |
| packages/runtime/src/graph/plan.ts | 2755 | `d80ef6ddb955f4d50391d2f957b6ce926da1bb1fade40fed340609101c89d3ac` |
| packages/runtime/src/graph/validate.ts | 12908 | `e0e27434c762e0f689404145424b01700bd884eea6e7b8940faab57d469b4eca` |

Applicable corrections were checked against this Windows checkout and operation. CON-24/LUX-P1/P25 require the exact installed Conductor executable/home, escalation and process-scoped checkout trust. READ-P9/CON-P38 require exact Git -C, safe.directory and empty excludes. LUX-P26 requires root to read the successful claim receipt before another launch. LUX-P62 requires saved ownership evidence and full --commit submission. P32 requires pathToFileURL for Windows ESM. P42 requires raw-clone mutation. P35 names the actual configs and installed compiler. P40 checks length only when present. P49 uses rg file enumeration. P55 requires bounded writes. Their source IDs remain in the launch payload and final verification evidence. No installation, native or GPU correction was invoked because those operations were excluded.

No delivered source prerequisite was found. The ledger can express the required independently settled reservations without change. The first-leaf split is a scope decision for this plan's independent reviewer, not an implementation authorization. Significant review findings require a versioned disposition before source dispatch. Root owns separate b1/b2 assignees, fresh independent reviews and serial integrations. Preserve all original source, worktrees and failure evidence.

The planning self-review maps ledger compatibility to ownership/reservation groups; authority to H1/H2/H14; completion/all outputs to H3–H6; terminal physical settlement to H7–H10/H13; feasible capacities to H11/H12 and the actual 4096-input probe; later cache/reset obligations to H15/H16. The document preserves all prior callable contracts while identifying which leaf delivers them. Plan completion does not mean source acceptance, integration, graph execution or hardware acceptance.
