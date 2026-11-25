# Visual-owned Story entry Implementation Plan

> For agentic workers: use the executing-plans skill when implementation is authorized. This document is a planning attachment, not authorization to start.

**Goal:** Smooth arbitrary same-visual beat jumps with explicit preparation, entry progress and editable occurrence inputs.

**Architecture:** Preserve one opted-in visual instance and let it author entry motion. Lux owns time, resources and command admission. Keep the existing compositor path for different visuals.

**Tech Stack:** TypeScript visual SDK and Studio React UI; shared JavaScript runtime contracts; Studio MCP and scene serialization.

**Spec:** [Approved architecture and UI design, revision 2](visual-owned-entry-design.md), including its normative review resolutions.

## Global constraints

- Planning only until the user authorizes implementation. Review and native validation belong inside the feature tickets.
- Protect the active creative session, original Vinyl Cosmos scene and installed app. Use an isolated profile through `studioTestEnvironment()` for QA and its paired adapter.
- Preserve old scenes, legacy visual behavior, two-slot compositor limits, native-input provenance and exact-generation checks.
- No speed, Resolume integration, generic easing editor or arbitrary configuration language.
- Establish the execution checkout and full source SHA before changing code. Planning baseline: LUX-198 accepted source `f214d2f9a2f6a49395dfa175f1e697ebb1313fae`; main currently differs, so verify required story code is present rather than assuming branch parity.

## Slice A — Runtime, typed activation inputs and author example

Tracking: LUX-206, parent LUX-194, depends on LUX-198.

User result: A running ball can enter another movement beat and retarget mid-entry without teleporting or constructing another instance. A solar-system example can receive a prepared label image and palette override.

Files and responsibility:
- `packages/visual-sdk/src/sdk-v2.ts`: optional entry capabilities, request/frame types and preparation hooks.
- `packages/runtime-contracts/src/story.mjs` and `.d.mts`: shared validation/status/command types.
- `apps/studio/src/controls/story-schedule.mjs`, `story-transport.mjs`, `story-generation-runtime.mjs`, `story-render-scope.mjs`: activation lifecycle, clocks, same-instance dispatch and rendered-endpoint completion.
- `apps/studio/src/story/story-runtime-host.ts`, `story-resource-broker.mjs` and `apps/studio/src/assets/story-asset-leases.mjs`: cancellation, prepared asset ownership and bounded retirement.
- `packages/core/src/story-scene-v2.ts`, `scene-file.ts`: persisted typed overrides and entry policy with compatibility migration.
- `packages/visual-sdk/examples/story.ts`: ball/path and palette/label reference behavior; add a focused fixture beside it when the current example cannot contain both clearly.
- Extend existing compiler/worker and MCP discovery/status handlers found through these shared contracts; no duplicate protocol.
- `skills/lux-visual-creation/`: SDK/asset/entry contract and generic tool examples.

Execution checklist:
- [ ] Add focused failing lifecycle tests for retained instance identity, preparation cancellation, stale generation results, endpoint render failure, retarget, unsupported retarget, pause, cut, seek and target clocks staying at zero through entry.
- [ ] Define and implement one shared discriminated contract. Pin finite-duration bound and compatibility capability in the SDK documentation. Validate inputs before author code. Reuse asset leases; never mutate active state during preparation.
- [ ] Implement preparation → entry → committed playback with cancellation and the existing compositor path. Ensure all commands use the same reducer/admission path.
- [ ] Persist control/image overrides and entry policy; resolve activation snapshots independently from visual defaults and live modulation. Add invalid input and old-scene round-trip tests.
- [ ] Expose behavior through existing generic MCP transport/status so this slice is usable before the richer panel lands. Demonstrate ball retarget and label preparation in an isolated app.
- [ ] Update shipped skill and install/check with `node scripts/install-visual-skill.mjs` and `node scripts/install-visual-skill.mjs --check`; independent code/resource review and native demonstration before submission.

Produces: a versioned capability, typed destination snapshot, shared entry status and generic transport actions. Slice B consumes these exact exported types; it must not create a second entry state machine. The design's review resolutions pin duration, schema versions, hook semantics, phase union and clock anchors; record concrete exported signatures on A before B begins.

Extend the existing focused tests: `tests/studio/story-schedule.test.mjs`, `story-generation-runtime.test.mjs`, `story-transport.test.mjs`, `story-asset-leases.test.mjs`, `story-resource-broker.test.mjs`, `tests/unit/story-v2-contract.test.mjs`, `tests/core/scene-story-v2.test.ts`, and `tests/compiler/story-compiler.test.mjs`. Use repository test scripts for their respective runners; do not run TypeScript suites directly with Node.

## Slice B — Story transport and occurrence editor

Tracking: LUX-207, parent LUX-194, depends on LUX-206.

Depends on accepted Slice A. User result: Select, launch, inspect, finish, cut or replay entry from Story; edit two occurrences of one solar-system beat with different palettes and label images, save and reopen them.

Files and responsibility:
- `apps/studio/src/story/StoryPanel.tsx`: persistent transport strip, phase/progress, launch versus selection, entry policy and typed input editor.
- `apps/studio/src/story/story-document-client.ts`, `story-status-admission.mjs` and `.d.mts`: guarded edits and current-generation status.
- `apps/studio/src/source/story-source-workspace.ts`: source/asset declaration connection without bypassing native asset authorization.
- Existing Story styles and interaction tests alongside the panel: responsive layout, keyboard/focus and announcements.
- Generic Studio MCP document-edit handlers and `skills/lux-visual-creation/`: occurrence editing/discovery examples and honest supported/planned distinctions.

Execution checklist:
- [ ] Add interaction coverage for preparing, entering, playing, failed preparation, selection versus launch, disabled retarget, asset-not-ready Cut, and explicit seek-to-end-entry behavior.
- [ ] Build the approved strip/ribbon/editor using A's statuses and commands. Show source playing while assets prepare; reserve progress percentage for timed entry. Keep sustained beats without a fake scrubber.
- [ ] Add declared control/image override editors with visible inherited versus overridden values and reset-to-default. Editing affects next activation; Replay with changes explicitly applies now.
- [ ] Save/reopen edited occurrences and demonstrate palette/label differences, Normal defaults, automatic continuation, live hold, and return-to-normal.
- [ ] Capture actual running UI at normal and narrow window sizes. Independently review layout, focus, keyboard access, disabled explanations and readable progress; resolve findings.
- [ ] Update/reinstall/check shipped skill; submit exact tested source and combined demonstration with A. No separate review/integration ticket.

## Evidence contract for both tickets

At execution, record exact worktree path and full tested SHA, SDK/adapter generation, isolated profile, executor identity, commands and raw artifact paths. Unfilled evidence is not a passing result. Developer runs focused unit/integration checks; fresh reviewer assesses source and actual application evidence before acceptance. Serialize native GPU runs with other active Lux work.

| Criterion | Setup/preconditions and method | Expected observation / stage / owner |
| --- | --- | --- |
| Same-instance bespoke entry | Instrumented ball fixture in isolated native Studio; launch B then C mid-entry; capture frame sequence plus instance counter | No position jump on retarget, one instance; A native QA, worker then independent reviewer |
| Clock/command semantics | Fake-clock reducer tests and native Pause Story/Auto-advance/Finish/Cut/seek interaction | Target local time and dwell remain zero until endpoint commits; ambient behavior matches spec; A unit + native QA |
| Assets and failure | Two declared image inputs; delayed, failed and superseded preparation; lease counters + rendered frames | A keeps playing, stale assets never install, resources release after final use, fault is truthful; A integration + native QA |
| Compatibility | Load existing scene and legacy visual, save/reopen a copy; exercise different-visual transition | Legacy behavior preserved, bounded overlap and retirement remain valid; A regression QA |
| Editable occurrences | Two occurrences with distinct palettes/images, changed saved defaults and active modulation; save/reopen | Overrides remain per occurrence; defaults/modulation not overwritten; B integration + native QA |
| Story UX | Actual UI screenshots and interaction recording at normal/narrow sizes; keyboard navigation and accessibility inspection | Phase and destination unambiguous; stable focus, accessible actions, no per-frame announcements; B independent UX review |
| Agent parity | Paired MCP adapter issues data-driven edits/launch/pause/cut and reads status | Same admission and result as UI; stale commands rejected; A/B integration QA |

Record independent planning review in [review](visual-owned-entry-review.md). Attach this plan and the design to both tickets and the parent epic. No implementation has been performed by this planning task.
