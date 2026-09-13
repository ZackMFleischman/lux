# Source-slot retirement implementation plan

> **For agentic workers:** Use conductor-worker for one assigned leaf and superpowers:executing-plans for the steps. Root dispatches fresh independent review and serializes integration.

**Goal:** Reclaim completed obsolete source publications without releasing the selected image, another reader, a producer in progress, or shutdown protection.

**Architecture:** Adapt the retained ownership helper onto current main after R1. Reclamation claims each candidate atomically before inspecting its frame metadata and releases only an older completed publication. This source-only leaf does not adopt historical timing instrumentation or make a throughput claim.

**Tech stack:** Windows x64, C++20, MSVC 19.50, interlocked shared-ring state transitions, native CPU fixtures.

**Spec:** R2 in [reliability-plan.md](reliability-plan.md). Planning revision 1, LUX-20. Root authored this plan; independent critique is required before dispatch. The user authorizes all four workstreams and root is the sole coordinator.

## Inspected source and split delivery

Planning baseline is main `d101a16483e354a3612806eb03cbc1107785bc25`, with R1 source `c17e679824a0fed79ce52621a0df4fe85cd659d7` independently reviewed and LUX-18 integration accepted after a fresh pinned build, five native CPU checks and seven JS checks. Main's `shared_ring.h` contains no obsolete-slot helper. Its receiver sets the selected import's admission, lease and exact FrameKey before validating provenance and starting the local copy. The R1 body/finalization boundary and copy outcome classifier must remain intact.

Root re-inspected retained source `8c55c506bacf9e6511d1cd19360c8ccc6042db8c` in `C:/Users/zFlei/repos/lux/.worktrees/source-slot-retirement`. Its tracked tree is clean; untracked artifacts remain. That commit changes four files by 81 additions: helper, one production call, test and additive CMake registration. Relative to current main, the shared-ring change is exactly the 23-line helper. Retained source is a candidate requiring ownership review, not prior approval. Historical test/performance logs remain historical and must not be overwritten.

R2 is delivered in two distinct parts. **R2a**, fully specified here, covers ownership source correctness and integration. **R2b** retains the timing reconciliation, exact package/build provenance and controlled paired graphics diagnostic from the parent plan. It requires its own preparation and root reservation after R2a. R2a acceptance cannot establish image freshness, physical GPU completion, callback cost or performance improvement. It also cannot satisfy R2b by reusing the two incomparable historical cold runs.

Alternative considered: overwrite old Ready metadata in place. That races with another reader or producer and is rejected. Selecting the newest Ready image without reclamation leaves obsolete slots occupied. Reclamation therefore uses the existing Ready-to-Reading ownership transition and existing generation/key-checked retirement operation.

## Constraints, files and interfaces

Exactly five source paths are allowed:

- Modify `native/texture-bridge/include/shared_ring.h`: add the bounded inline helper adjacent to `retire`.
- Modify `native/ffgl-source/src/FrameReceiver.cpp`: one call immediately after selected ownership and key are recorded.
- Modify `native/CMakeLists.txt`: additive CPU target, includes, C++20, `/UNDEBUG` and five-second CTest timeout.
- Create `tests/native/source_slot_retirement_test.cc`: production-helper CPU regressions.
- Modify `native/LIFECYCLE.md`: document selected versus obsolete ownership and CPU/hardware limits.

No ring version/layout, public protocol, source selection algorithm, timers, polling strategy, telemetry, installed runtime, compiler/SDK, Studio, native filesystem, vendor or other test/config changes. In particular this is not a retry of blocked LUX-7. Root has exclusive integration ownership of the shared CMake hunk; other workers do not edit these paths. Preserve user artifacts and retained branches. No dependency download, installation, host playback, GPU execution or remote push.

The new production interface is:

```cpp
inline bool retireObsoleteReadySources(SharedRing& ring, FrameKey selected);
```

The caller must already own `selected.slot` in Reading and hold a live read admission for that exact key. It retains that lease and admission until its existing copy completion/cleanup path releases them. The helper's temporary admission protects only its own inspection/reclamation work; it never consumes the caller's admission.

Use the exact 23-line candidate helper from retained commit 8c55c506 as the initial adaptation, subject to independent review. `beginRead` failure performs no mutation and returns true: closing or exhausted admission means reclamation is skipped, not that copying or shutdown succeeded. On successful temporary admission, verify selected slot `<3`, nonzero frame, ring generation, output generation, selected Reading state and exact selected frame before touching other slots. Invalid selected keys return false after balancing the temporary admission.

For each other slot, atomically claim Ready-to-Reading. Only after successful ownership may the helper read that slot's frame. Retire through existing `retire` only when its frame is nonzero and numerically less than the selected frame. Equal, newer and zero frames are restored to Ready. Writing, Free, other Reading and the selected slot remain untouched. Frame order remains the existing non-wrapping generation-local publication convention; this patch introduces no wraparound ordering or generation rollover mechanism.

Failed key-checked retirement is an invariant failure, not permission to force Free. Restore candidate Reading-to-Ready if possible and return false. If restoration itself fails, retain the temporary admission for containment; never decrement it while ownership is unknown. Under valid protocol participants, owned Reading slots and ring generation stay stable. Do not introduce a race test that writes non-atomic owned metadata concurrently merely to reach corruption branches. Review those defensive paths explicitly and label them source-inspected if no legal production operation can produce them.

Receiver wiring is exactly:

```cpp
imported.ownership.admission=true;
imported.ownership.lease=true;
imported.key={ring->generation,ring->outputGeneration,source.frame,uint32_t(newest)};
require(retireObsoleteReadySources(*ring,imported.key),"obsolete source ownership mismatch");
```

Preserve surrounding existing code. A false helper result flows through R1's failure/finalization boundary and existing import cleanup. The helper never marks selected copyPending complete or frees its lease. A candidate Ready publication is already producer-complete under the existing protocol; this patch does not manufacture GPU completion.

## Steps and evidence contract

- [ ] **1. Fresh checkout and claim.** Start from root's then-current integrated main with accepted LUX-18. Record full SHA, branch, clean/dirty inventory and ownership reservation. Read this exact approved revision. Claim the assigned R2a ticket once after managed registration/ACK. Do not cherry-pick entire retained branches.
- [ ] **2. Production-used red regression.** Add the retained 51-line test from `git show 8c55c506bacf9e6511d1cd19360c8ccc6042db8c:tests/native/source_slot_retirement_test.cc`, with its CMake target, before adding the helper. Build only `lux_source_slot_retirement_test`; expected red is missing `retireObsoleteReadySources`, recorded separately from setup failures. The retained fixture already exercises 50 reclaim/reuse cycles, selected protection, Writing/other-reader preservation, newer/equal/zero frames, invalid keys, closing admission and concurrent producer reuse. Check each assertion's setup rather than trusting its comment.
- [ ] **3. Adapt the helper and call site.** Add the retained helper as specified and wire it after both ownership flags and FrameKey are stored. Confirm R1's classifier, current-run attribution and finalization remain byte-identical outside the single new call. Add concise lifecycle documentation.
- [ ] **4. Extend negative coverage.** Use fresh rings per case; never mutate metadata of a concurrently owned slot. Add selected zero-frame and selected wrong-state failures, each leaving candidate slots untouched and temporary admission balanced. Add admission saturation (`RingClosing-1`) skip with all slot states unchanged; reset only the isolated fixture after assertion. Verify the selected frame/key and original admission count on each success. Preserve the bounded producer reuse test, using the existing one-second producer deadline and five-second CTest timeout; join before metadata assertions.
- [ ] **5. Demonstrate cleanup independence.** Run existing receiver lifecycle tests that retain selected lease/admission for Pending and Failed completion and release only after Complete, alongside new reclamation checks. Review the actual call-site ordering to show reclamation cannot bypass these tests' production ledger. Model tests establish ledger behavior; they do not establish driver completion or a physical stop deadline.
- [ ] **6. Build and test exact source.** Use the pinned source-only vendor prerequisite and commands below. Record complete source manifest, vendor manifest comparison, compiler flags, binary hashes and raw outputs. Whitespace/scope-check, commit the five bounded files, rerun focused checks against unchanged committed source, then submit with `--commit` and exact criterion status. Stop the session; fresh reviewer and root integration follow separately.

Additional negative fixture shape:

```cpp
SharedRing r; r.generation=17;
publish(r,0,1); publish(r,2,3);
auto selected=claim(r,2);
const auto admissions=r.admissions;
assert(!retireObsoleteReadySources(r,{17,1,0,2}));
assert(r.slots[0].state==Ready && r.slots[2].state==Reading);
assert(r.admissions==admissions);
done(r,selected);
```

`publish`, `claim` and `done` are the retained test's helpers and use actual shared-ring operations. Expand cases independently with exact keys and expected states; do not replace the production implementation with a mock algorithm. Release compilation must retain assertions through `/UNDEBUG` for this new target.

## Build prerequisites and commands

Root must prepare a source-only copy of the already inspected FFGL `source/lib` closure into the fresh worktree's `native/vendor/ffgl/source/lib`, checking all 203 files against `docs/conductor-onboarding/receiver-vendor-source-manifest.json` in main (manifest SHA256 `0C1925968568652331DC9E4245854D7C1B5D64D88AD59A9339A13AD6E1892356`). Canonical source repository is `C:/Users/zFlei/repos/lux/.worktrees/transport/native/vendor/ffgl`, commit `fda8d4a5904eaf09dd97ac0f95c246bd7f9f9a46`. Inspect current source and hash equality; old binaries or copied Git metadata are excluded. Source availability is not installation or host-execution authority.

Use CMake/CTest under `C:/Program Files (x86)/Microsoft Visual Studio/18/BuildTools/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin`. Existing process-only Path/PATH normalization is applicable only after inspecting the actual shell environment; preserve its value and do not change installed settings. Configure a fresh isolated build directory with these pinned options and guard every native exit code:

```powershell
& $cmake -S native -B native/build -G 'Visual Studio 18 2026' -A x64 -T 'v145,version=14.50.35717' '-DCMAKE_SYSTEM_VERSION=10.0.26100.0'
& $cmake --build native/build --config Release --target lux_source_slot_retirement_test lux_receiver_run_test lux_receiver_lifecycle_test lux_shutdown_race_test lux_shared_ring_test lux_context_handoff_test LuxTracerTR02
& $ctest --test-dir native/build -C Release --output-on-failure -R '^(source_slot_retirement_cpu|receiver_run_cpu|receiver_lifecycle_cpu|shutdown_admission|shared_ring_ownership|context_handoff_cpu)$'
```

Expected: seven targets build and six CPU tests pass. Verify `/EHsc`, normal Release optimization flags and enabled new-test assertions. No standalone host or graphics command belongs to R2a. Source acceptance requires the exact committed patch, raw logs, independently checked ownership and criteria; root later records a separate integration ticket and repeats the six tests/build at the landed main SHA.

## Acceptance boundaries and review questions

The worker maps all six steps to actual setup, execution, observation and exact source evidence. Independent reviewer checks candidate ownership acquired before metadata reads, selected/caller admission lifetime, shutdown refusal, stale-key and immediate-reuse handling, normal and containment admission balance, and real receiver wiring. Significant findings require a corrected version and fresh recheck before implementation. A passed retained test alone is insufficient.

R2b remains open after R2a: reconcile historical timing source changes and complete build/package inputs, prepare paired exact-reference diagnostic with fresh-image identity and supervised cleanup, preserve failures, and review measurement validity. No causal performance statement follows from reclaimed slot counts, selected transport IDs or CPU success. Sustained numerical acceptance and real-host/clean-machine gates remain the parent plan's later work.
