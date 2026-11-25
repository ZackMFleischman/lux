# LUX-9 independent plan critique — round 1

Decision: CHANGES REQUESTED. Two P2 findings; no P0/P1 finding. This is a planning review, not implementation acceptance.

Reviewed document: C:/Users/zFlei/repos/lux/.worktrees/creative-inputs-plan/docs/implementation/creative-inputs-plan.md
Reviewed commit: 61305e081ac3e9bba91055b93ec63912d43a718b
Verified SHA-256: 33b7af89d51c8f607230d82b664c2f721eb36379b184fc5ad55e75b5acbf08a5
Ticket: LUX-9 / bffba6dc-4b06-49c8-9623-dc425f72889d, specification revision 2, observed ticket revision 4; active planning owner retained.
Reviewer: e00b2f25-2206-4729-b632-a7b59e641774 / lux-inputs-plan-review-01a09967
Session: 4c6cefd5-15f6-453d-8a6e-0e28d00c5fa9
Fresh native context: /root/inputs_plan_review
Run/launch: 345554f0-0896-4ea2-8fb4-942317f65fda / 38116d6c-c81b-4f99-84f2-9d00a2090b4a
No implementation participation, ticket claim, planner-file changes, tests, dependencies, graphics, merge or push.

## Findings

### R1 — P2: Give I02 a per-binding smoothing integration seam

Source: plan line 65 (I02 owned files), lines 108–128 (binding/frame interface), line 239 (required smoothing position).

I02 promises smoothing per binding after range/curve shaping and before replace/add/multiply, but its owned boundary lists only new timeline/replay files. I01 accepts one raw signal value per source tuple and performs shaping/mixing atomically. Two bindings sharing one source but carrying different curves or smoothing constants cannot receive their independent smoothed mapped values through that single shared raw sample. The outlined implementation would need to edit the mapper outside I02's stated boundary, synthesize misleading source identities, or duplicate its arithmetic/traces.

Correction: explicitly reserve an I02 extension to mapping.mjs/declarations and relevant tests under a reviewed version/interface change, or define another concrete compositional seam that keeps shaping and mixing semantics in one owner. I01 may remain entirely stateless. Require a known-answer case with two bindings sharing one raw signal but different curves/tau, and partition tests under an identical piecewise-held input trajectory (unconstrained changing-input partition invariance is not a property of this formula). Preserve reset/disconnect and host-bypass state rules. Detailed I02 patch planning can remain a later gate, but the current whole-lane boundary must admit the necessary work.

### R2 — P2: Assign tempo/phase/LFO/curve source coverage

Source: plan lines 68–72 (I05–I09), line 270 (I05 validation), line 289 (claimed S02 coverage).
Requirement source: docs/requirements.md line 42; docs/design/studio.md line 149 at reviewed source baseline.

S02 explicitly includes tempo, phase, LFOs and curves as signal sources. The lane table and validation mapping cover audio/MIDI, recorded/synthetic fixtures and mapping exponents, but never allocate these producers or their acceptance evidence. An exponent used for mapping is not a clocked LFO/phase/curve source. Every current slice could pass while these required features remain absent.

Correction: assign these producers to I05 or another bounded later leaf, state canonical animation/input clock and reset/replay behavior, identify deterministic known-answer fixtures and role/artifact evidence, and connect source settings to I06 authoring, I07 persistence and I09 compatibility classification. No expansion of I01 or immediate device work is needed.

## Reviewed strengths and bounded conclusions

- First I01 four-file scope is independent of C02 compiler/SDK/runtime-contracts index/worker/public guards/project-contracts and native filesystem reservations.
- Actual runtime implementation is clock.ts and seed.ts; the plan correctly labels instance.ts as absent/proposed (LUX-P3), not shipped. Current empty worker events and SDK readonly never[] are confirmed.
- Existing parameters.mjs/.d.mts support the reused number/live schema, finite ranges, nonquantizing step, no default intensity, immutable results and strict own-data admission.
- Arithmetic examples at lines 198–203 and A1/A2 are consistent with macro-first order and one final clamp. Host subset bypass, authored base traces, source/target collision keys and upstream alias resolution are explicit.
- Both entry points validate input data. Bounds, accessors, invalid numeric values and finite intermediate overflow have acceptance cases. Readonly alone is not presented as runtime validation; output detachment/freezing is required.
- Replay distinguishes events from coalesced continuous values, repeats/zero boundaries, source/runtime generations, monotonic calibration, lateness/drop counters, controlled versus live overload and paused redraw versus step.
- Native event capability, device, GPU, installed/offline and numerical latency claims require actual setup evidence; CPU pass cannot stand in for them.
- Persistence is deferred to canonical filesystem transactions with clone roots, expected heads, migration and dirty-gesture preservation. Looks retain one active instance.
- Later I02–I09 still require their own current-code patch plans, review and resource windows; approving this plan would authorize neither all files nor hardware claims.

## Evidence and inspection notes

Read conductor-plan, conductor-work and their commands/workflow/team/startup-corrections references. Installed CLI reports 0.2.0-dev/schema4/layers-v1; project discovery succeeded after process-local exact main safe.directory. Every installed executable/home invocation used require_escalated, matching CON-24. Exact reviewed-worktree Git commands used -C, empty core.excludesFile and identical safe.directory, matching READ-P9/CON-P38; no global Git trust was changed. The main context ownership failure is observed, not unknown registration silently treated as false.

Read main onboarding/orchestration checkpoints and actual ticket/team state. Read plan, requirements T11/S02/S03/S04/U09 and Studio/runtime input contracts; inspected parameters, current clock, SDK/worker admission signatures, project contracts and canonical identities, package script/typecheck metadata. Reviewer initially probed a nonexistent core/src/ids.ts, then inspected the actual identities import from project/contracts.ts (runtime-contracts/src/identities.ts); no behavior was attributed to the nonexistent path. An rg invocation with a PowerShell-only flag failed and supplied no evidence; subsequent conclusions do not rely on it. No source dependencies were installed.

Git HEAD and document digest matched the supplied review target. Working tree status showed only untracked .superpowers/ evidence; no tracked planner changes were observed. No implementation tests were rerun because this is a documentation review.

## Disposition tracking

Findings sent to root and planner through collaboration. Await exact revised commit/digest for a focused recheck in this same independent context. Do not erase this round. The reviewer remains available until root instructs session stop.
