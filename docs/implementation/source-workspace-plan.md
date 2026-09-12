# Source workspace implementation plan

> For agentic workers: use superpowers:subagent-driven-development or superpowers:executing-plans task by task. This plan is documentation, not authorization to launch Studio during another agent's transport test.

**Goal:** Add TypeScript syntax coloring and reliable multi-file editing to the existing standalone authoring flow, then integrate that panel with the future project/graph workspace.

**Architecture:** A pure source store owns complete draft bundles and concurrency. A CodeMirror React adapter owns editor state; existing compile/runtime/save APIs consume immutable bundle snapshots. File navigation never owns runtime lifetime.

**Tech stack:** Existing React, MUI, TypeScript, RTL and Node test runner; CodeMirror 6 packages pinned at implementation time. No custom editor engine.

**Spec:** [Source workspace](../design/source-workspace.md). Read [CPU audit](../reviews/source-workspace-cpu-audit.md) for current evidence.

## Global constraints

- Work from `codex/tracer-0.1` or its integrated successor; use a dedicated `codex/` worktree for implementation. Do not share a writable checkout with transport agents.
- Do not launch Studio, Electron, browsers or GPU tests while the exclusive transport test is active. CPU tests may run separately; avoid unnecessary heavy compiler reruns.
- Preserve current .lux-scene version 1 and SourceBundle shape: sdkVersion, entry, files. Admit 1–32 .ts files, at most 1 MiB UTF-8 total, canonical relative ASCII paths up to 240 characters and no case-fold collisions, as enforced by source-policy.mjs.
- Runtime execution and capture stay in existing boundaries. No generated code executes inside the editor. No remote assets or relaxed CSP.
- Save and Build consume the full draft bundle. Dirty text survives panel/tab switches; failures preserve drafts and the working preview.
- Retain manual Build & preview. Graph, durable multi-Scene projects, library publishing and automatic compilation are not prerequisites for Tasks 1–5.

## Task 1 — Full-bundle draft store and CPU contract

Create `apps/studio/src/source/workspace.ts` and `tests/studio/source-workspace.test.ts`. Keep the store free of React and CodeMirror. Existing source admission remains authoritative in `apps/build-worker/src/source-policy.mjs`; move/reuse its pure rules only with equivalent tests, rather than maintaining divergent validators.

Proposed exported interface (new names, not existing APIs):

```ts
type SourceSnapshot = Readonly<{
  source: SourceBundle; version: number; dirty: boolean;
  selectedFile: string; openFiles: readonly string[]; busy: boolean;
}>;
interface SourceWorkspace {
  getSnapshot(): SourceSnapshot;
  subscribe(listener: () => void): () => void;
  edit(path: string, text: string): void;
  addFile(path: string, text: string): void;
  openFile(path: string): void;
  closeFile(path: string): void;
  markSaved(version: number): void;
  replaceDocument(source: SourceBundle): void;
  submit(source: SourceBundle, expectedVersion: number,
    activate: (source: SourceBundle) => Promise<void>): Promise<void>;
}
// createSourceWorkspace(source: SourceBundle): SourceWorkspace
```

`submit` acquires busy synchronously, rejects stale versions, clones input, awaits activate, then adopts source once; failure changes neither draft nor version. `replaceDocument` rejects while busy and clears previous document view/history only after a caller-approved document replacement. It establishes a clean saved baseline. `edit` and `addFile` reject while busy. Dirty compares complete content to saved baseline, not whether a tab is open. `markSaved` cannot clear newer edits. Metadata-only tab operations do not increment source version.

- [ ] Write failing Node tests for the following contract before implementing it:

```ts
const w = createSourceWorkspace({ sdkVersion: '0.1.0', entry: 'main.ts',
  files: { 'main.ts': 'export {}', 'lib/color.ts': 'export const red = 1' } });
w.edit('lib/color.ts', 'export const red = 0.5');
w.closeFile('lib/color.ts'); w.openFile('main.ts');
assert.equal(w.getSnapshot().source.files['lib/color.ts'], 'export const red = 0.5');
assert.equal(w.getSnapshot().dirty, true);
const version = w.getSnapshot().version;
w.markSaved(version - 1);
assert.equal(w.getSnapshot().dirty, true);
await assert.rejects(w.submit(w.getSnapshot().source, version - 1, async () => {}));
await assert.rejects(w.submit(w.getSnapshot().source, version, async () => { throw Error('bad'); }));
assert.equal(w.getSnapshot().version, version);
```

- [ ] Add deferred-activation tests: a second submit rejects while first pending; mutation of caller-owned input cannot affect the admitted snapshot; successful submit increments exactly once; modifying a returned snapshot cannot mutate the store. Add valid nested paths, invalid traversal/case collisions, nonfinite versions, absent entry and source size boundary cases.
- [ ] Run `node --experimental-strip-types --test tests/studio/source-workspace.test.ts`, observe failures, implement the store, rerun to pass, and commit `feat(studio): add full-bundle source workspace`.

## Task 2 — One draft authority for human, AI and persistence

Modify `apps/studio/src/authoring.tsx`. Create `apps/studio/src/source/authoring-session.ts` for a testable adapter around the store and existing client APIs. Add `tests/studio/authoring-session.test.ts`; leave transport/native files untouched.

Consume SourceWorkspace. Export `createAuthoringSession(workspace, ports)` with `read()`, `build(source, expectedVersion)`, and `save(saveAs)`; ports inject `submit(source)`, `save(document, saveAs)` and `getControls()`. `read()` returns the existing MCP shape `{source, draftVersion}`. `build()` calls workspace.submit. `save()` snapshots source/version/controls before awaiting the file API and calls markSaved only on successful non-cancelled completion. Keep document token ownership in this adapter and clear it on approved replacement. Main process validates all persisted data as today.

- [ ] Write tests using deferred promises: helper-file edits appear in read/build/save; cancelled or failed save retains dirty state; a stale AI build never calls submit; failed submit preserves every file; accepted whole-bundle replacement synchronizes read and visible file selection. Check source reads are isolated copies.
- [ ] Replace the separate `code`, `bundle`, draft-ref and `currentSource()` authorities with store subscriptions. Route the existing onAgentCommand handler and human Build through the session. The current example/open flows explicitly call replaceDocument; opening another file retains its existing unsaved-change guard until Save / Discard / Cancel is implemented.
- [ ] Test pending Open/Save/Build exclusion without Electron by injecting ports. Do not mark invalid opened source as a running revision; retain existing runtime on failure and label source/running mismatch.
- [ ] Run `node apps/studio/test-cpu.mjs` and `node node_modules/typescript/bin/tsc -p apps/studio/tsconfig.json --noEmit`. Commit `refactor(studio): share draft state across editor and AI`.

## Task 3 — CodeMirror panel and file navigation

Create `apps/studio/src/source/SourcePanel.tsx`, `CodeEditor.tsx`, and `editor-state.ts`; modify authoring.tsx, studio.css, package.json and pnpm-lock.yaml. Extend `tests/studio/interactions.test.tsx` and add `tests/studio/source-editor.test.tsx`; include the new TSX test in `apps/studio/build.mjs` and `test-cpu.mjs` because the current runner explicitly includes only two bundled TSX tests.

CodeEditor receives `{documentKey, path, text, readOnly, onChange, diagnosticTarget}`. SourcePanel consumes the SourceWorkspace and document identity. Editor cache keys combine documentKey/path, never basename. A local typing transaction updates the store without replacing its own history; an external changed document resets the affected cached state and retains a workspace replacement undo snapshot. Destroy views on unmount and retain their state in the bounded current-document cache.

- [ ] Choose exact compatible CodeMirror 6 versions using official package metadata; pin state/view/language/commands/search/lang-javascript packages needed by the adapter. Verify licenses and CSP style API against those versions. This is the sole dependency owner task.
- [ ] Write RTL tests against the panel with a fake editor adapter first: file tab switch retains edits, closing/reopening a dirty tab preserves source, duplicate basenames show distinct labels, New file rejects invalid paths, Ctrl+S calls whole-document save, build lock makes editing read-only. Add real CodeMirror DOM tests for typing and per-file history where jsdom supports them.
- [ ] Implement TypeScript mode, line numbers, selection/history/search and Studio theme tokens. Use the launch style nonce. Configure keyboard access out of the editor and suppress source submission during active IME composition. Avoid replacing editor content on runtime status renders.
- [ ] Mount in the existing Visual source region; no Dockview installation. A failure to initialize exposes the existing textarea with an actionable message and intact text. Keep the Preview component outside this subtree.
- [ ] Run CPU suite and Studio typecheck; inspect local bundle output for remote assets or unexpected workers. Commit `feat(studio): add TypeScript editor and file tabs`. Record native CSP/IME/accessibility validation as pending while Studio must remain closed.

## Task 4 — Structured diagnostics and navigation

Modify `apps/studio/src/standalone-client.ts` to preserve compile diagnostics in a typed failure while retaining a readable message. Create `apps/studio/src/source/diagnostics.ts` and `ProblemsPanel.tsx`; test in `tests/studio/source-diagnostics.test.ts` and source-editor.test.tsx. Consume existing compiler diagnostics rather than creating a second semantic checker.

- [ ] Define `SourceDiagnostic = {file?: string; line?: number; column?: number; message: string; draftVersion: number}` and `diagnosticTarget(diagnostic, snapshot): {path: string; offset: number} | null`. Match compiler's 1-based coordinates; clamp valid file locations and return null for stale versions/missing files.
- [ ] Write tests with `lib/color.ts`, CRLF, Unicode, absent coordinates, removed files and edited versions. Assert click opens the correct file and no current-text underline appears for stale results.
- [ ] Propagate diagnostics from submit failure to the Source panel with the admitted version. Show them without overwriting drafts or asserting a new running revision. Clear or mark stale after edits; retain messages for inspection.
- [ ] Run CPU tests/typecheck; commit `feat(studio): navigate versioned source diagnostics`.

## Task 5 — Multi-file boundary regression coverage

Modify `tests/compiler/compiler.test.mjs`, `tests/compiler/link-runtime.test.mjs`, and `tests/core/scene-file.test.ts`. Do not modify runtime workers merely to make CPU tests easier.

- [ ] Compile a real example importing `lib/color.ts`; change only helper content and assert source/bundle hashes change. Put a type error on line 2 of the helper and assert its path and line are returned. Remove a required helper and assert failure.
- [ ] Link that compiled multi-file artifact, assert helper behavior is included and no relative unresolved import remains; never execute the visual in these tests. Tampering with the helper module must fail artifact validation.
- [ ] Save/reopen a three-file Unicode bundle with nested paths and a non-default entry filename; deep-equal all source bytes, entry, settings and controls. Inject replacement failure and verify the old full bundle remains.
- [ ] Run `node --test tests/compiler/compiler.test.mjs tests/compiler/link-runtime.test.mjs tests/core/scene-file.test.ts`, then CPU Studio suite if integration code changed. Commit `test(studio): cover multi-file authoring boundaries`.

## Dependent integration gates

These are concrete follow-on deliverables, not permission to fabricate project/graph services in the editor patch:

| Gate | Required existing subsystem | Integration and acceptance |
| --- | --- | --- |
| Multi-Scene drafts | Durable project model and selected-Scene runtime operation | Key stores by stable Scene/definition identity; switching A → B → A retains A's dirty files; save/discard/cancel handles all dirty definitions on Project close. Runtime switch failure is labeled. |
| Shared definition scope | Graph Nodes, dependency usage index and transactional project edits | Inspector Edit source opens correct definition; Make unique copies/repoints one Node atomically; shared edit enumerates affected nodes/scenes; usage/revision changes reject stale commits. |
| Dockable panels | Adopted Dockview adapter | Source, Library and Inspector use ordinary panels with drag, resize, tab, split, close and reopen behavior. Move Library and Inspector out of the default side columns, save/reload that layout and verify their state and independent Inspector locks survive. Move Source among groups without text/history loss; laptop tab changes never restart Preview; layout restore cannot select an unrelated file. |
| Interactive acceptance | User releases exclusive transport test and approves Studio launch | Verify native editor rendering, CSP, keyboard/IME, diagnostics focus, fullscreen continuity and typing responsiveness with maximum admitted bundle; then run actual multi-file MCP capture/revision test. |

Before implementing each dependent integration, expand its task against actual project/graph interfaces and update this plan. That boundary deliberately prevents invented methods being treated as already available.

## Orchestration and completion

Tasks 1–2 precede Tasks 3–4. Task 5 can run in a separate test-only worktree alongside Task 3 after contract agreement. Coordinator alone edits the shared lockfile and integrates commits. Review separately for data loss/concurrency, editor accessibility/layout, and compiler/security boundaries. Reviewers report evidence, not only approval.

Finish each task with its tests and a commit. Stop before Studio/native acceptance while another agent owns the hardware test. CPU-green is not visual QA. Completion report lists implemented tasks, exact tests, commits and pending native checks; no claim of complete graph/project authoring from the standalone file editor.
