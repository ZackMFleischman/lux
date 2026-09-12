# Source editor implementation evidence

Date: 2026-09-12. Worktree: `codex/source-editor`, based on `codex/tracer-0.1`. CPU-only implementation; no Studio, Electron, browser, GPU or native host launch by this workstream.

## Implemented

- One immutable full-bundle source workspace with monotonically increasing draft versions, complete saved-content comparison, independent running-source identity, synchronous build exclusion and one whole-bundle replacement undo snapshot.
- A shared authoring session supplies human Build, MCP read/build, Save and Open. Save cancellation/failure retains dirty drafts; stale builds never reach the runtime port; failed activation preserves the previous running identity. Open retains the existing discard confirmation and resets document identity only for an admitted document.
- CodeMirror 6 TypeScript syntax coloring, line numbers, selection, search and undo/redo. Per-file state, cursor and scroll survive closing/reopening tabs and panel remounts. External changed files receive fresh histories; unaffected histories remain. Replacing the document clears the cache.
- Collapsible complete file list with relative paths and Entry/dirty labels, persistent tabs, and new `.ts` file creation using the compiler's exact admission function. The source policy now uses `TextEncoder` in place of `Buffer.byteLength`, allowing the same pure validation in the browser. Malformed Unicode remains rejected before encoding.
- Ctrl+S saves the whole document, composition suppresses save/build, Tab is not bound to indentation, and editing is readonly during admitted builds and document I/O. Failed editor initialization displays an intact plain-text fallback.
- Compiler failures retain structured file/line/column/message data. Problems navigation opens the corresponding file and clamps one-based UTF-16 coordinates. Diagnostics become explicitly stale after draft changes and cannot navigate into unrelated text.
- Whole-bundle compiler/linker/persistence regressions cover helper-only hashes, helper error locations, missing imports, nested emitted modules, helper tampering, alternate entry paths and exact Unicode/CRLF source roundtrips.

## Dependencies and CSP

Registry metadata confirmed MIT licenses for these exact packages; the coordinator owns the manifest/lockfile installation:

| Package | Version |
| --- | --- |
| `@codemirror/state` | 6.7.4 |
| `@codemirror/view` | 6.43.11 |
| `@codemirror/language` | 6.12.4 |
| `@codemirror/commands` | 6.11.0 |
| `@codemirror/search` | 6.7.2 |
| `@codemirror/lang-javascript` | 6.2.5 |

The pinned view types expose `EditorView.cspNonce`. The adapter supplies the existing validated launch nonce; DOM tests observe a nonce-bearing editor stylesheet. The adapter contains no workers, dynamic evaluation or remote assets. Existing script/network CSP remains unchanged. Native packaged CSP acceptance is still pending.

## CPU verification

- `node apps/studio/test-cpu.mjs`: 36 existing/store/session/diagnostic tests plus 5 isolated CodeMirror DOM tests passed. DOM tests have explicit non-rendering geometry shims; they are not native layout or latency measurements.
- `node node_modules/typescript/bin/tsc -p apps/studio/tsconfig.json --noEmit`: passed.
- `node --test tests/compiler/compiler.test.mjs tests/compiler/link-runtime.test.mjs tests/core/scene-file.test.ts`: compiler 9 and persistence 4 tests passed; linker 4 passed after allowing esbuild's legitimate symbol renaming in the helper assertion. Visual source is compiled/linked as data and never executed by these tests.
- `git diff --check`: passed before implementation commits.

For a worktree using a dependency junction, set `LUX_COMPILER_DEPENDENCIES` to the canonical installed directory. This workstream used `C:/Users/zFlei/repos/lux/.worktrees/tracer/node_modules`; supplying its source-editor junction alias correctly trips compiler pinned-root validation. Studio DOM suites run in separate Node invocations so their jsdom globals and Testing Library document binding cannot interfere.

## Remaining acceptance and scope

Native font rendering, accessible keyboard traversal, native IME completion ordering, packaged CSP, narrow-window sizing, source typing latency/memory at maximum admitted size, and actual multi-file MCP capture/revision behavior require the coordinator's bounded UI session. CPU-green does not claim visual QA.

This is the incremental standalone source region. The complete-path file list has no directory-node expansion, file rename/deletion, entry reassignment or file revert command. Problems navigate to a cursor; semantic squiggles and TypeScript language-service completion are not included. Existing Open uses Discard/Cancel confirmation, not the future project-wide Save/Discard/Cancel flow. AI replacement keeps one undo snapshot but does not yet show a pre-build topology diff. Dockview, multi-Scene navigation, graph/component scope and shared-definition operations remain separate milestones.
