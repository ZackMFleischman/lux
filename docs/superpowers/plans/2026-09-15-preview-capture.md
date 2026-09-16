# Preview Capture Implementation Plan

> **For agentic workers:** Execute this plan inline with test-driven development. Keep the main integration and native UI demonstration with the coordinator.

**Goal:** Let a Studio user save the current output as PNG and record a fixed-resolution WebM clip from the Preview menu.

**Architecture:** The renderer reuses the worker PNG capture for stills and records the fixed-size presentation canvas with `MediaRecorder`. A narrow preload API streams bounded WebM chunks to a main-process file store that writes a temporary file and commits it only after a clean stop.

**Tech Stack:** React, Electron IPC, Node filesystem APIs, MediaRecorder, Node test runner.

**Spec:** Conductor ticket LUX-138 revision 4.

## Global Constraints

- Do not launch Studio or use the GPU until the coordinator grants the shared graphics lane.
- Keep clip dimensions fixed at the output width and height captured at recording start.
- Preserve existing destination files until a PNG or video commit succeeds.
- Keep capture traffic bounded; reject oversized chunks and recordings.
- Update the shipped visual-creation skill for the delivered UI behavior.

### Task 1: Safe capture files and trusted IPC

**Files:** Create `apps/studio/src/preview-capture-files.ts`, `apps/studio/src/preview-capture-client.ts`, and `tests/studio/preview-capture-files.test.ts`; modify `apps/studio/src/main.ts` and `apps/studio/src/preload.ts`.

- [ ] Write failing real-filesystem tests for atomic PNG save, streamed WebM commit, cancellation, malformed input, and bounded writes.
- [ ] Run the focused tests and confirm the missing module failure.
- [ ] Implement the smallest file store and preload contract that passes.
- [ ] Add one trusted main-window IPC handler with save dialogs for `.png` and `.webm`.

### Task 2: Fixed-resolution recorder and Preview menu

**Files:** Create `apps/studio/src/preview-recorder.ts`, `apps/studio/src/PreviewCaptureMenu.tsx`, `tests/studio/preview-recorder.test.ts`, and `tests/studio/preview-capture-menu.test.tsx`; modify `apps/studio/src/authoring.tsx`.

- [ ] Write failing tests for MIME selection, fixed canvas dimensions, ordered chunk writes, clean stop, cancellation, backpressure failure, and accessible menu status.
- [ ] Run the focused tests and confirm expected failures.
- [ ] Implement recording against the existing presentation canvas and PNG saving through `client.capture()`.
- [ ] Stop and finalize on runtime/output replacement; cancel temporary output on capture failure or renderer teardown.

### Task 3: Documentation and verification

**Files:** Modify `skills/lux-visual-creation/references/studio-tools.md`.

- [ ] Document the Preview menu, PNG behavior, WebM codec fallback, fixed output dimensions, and stop conditions.
- [ ] Run focused capture tests, the full Studio CPU suite, root typecheck, and direct Studio typecheck.
- [ ] Commit the candidate and submit exact evidence plus the remaining native UI/decoded-media QA to LUX-138.
