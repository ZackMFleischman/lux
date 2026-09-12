# Independent source editor audit

12 September 2026. Read-only review of integrated commits `864df0c`, `e2a4662`,
`950d5d1`, `00593fd`, `6e2e27a`; tracer observed at `78c8cb8` during review.
Scope: human/MCP draft mutations, multi-file I/O/history, shared source policy and
editor lifecycle/CSP. No fixes, graphics launches or export UI review.

## Findings

### P1 — repeated rejected edits leave visible text outside the source store

`apps/studio/src/source/SourcePanel.tsx:19` catches edit admission errors and calls
`setError(String(reason))`. `CodeEditor.tsx` accepts the CodeMirror transaction
first (`updateListener`, line 53), then relies on a later layout effect (line 76)
to replace it with admitted `props.text`. The second identical validation failure
sets the same React state string; the store did not publish because admission
failed, so no rerender is required and that rollback effect does not run.

A transient jsdom/CodeMirror CPU probe inserted a lone surrogate twice into
`main.ts`. Result: first attempt `editorText === storedText` was true, second was
false. The visible buffer can now contain rejected text while Save/Build/MCP read
use different bytes. This also applies to repeated over-budget edits with the
same error message.

Recommended patch: make the editor transaction admission/rollback explicit,
independent of whether an error message changes. Avoid resetting good local undo
history just to repaint an error. Add a regression with two consecutive identical
admission failures and assert editor/store/save/read agreement after each.

### P1 — opening invalid source drops its saved controls on subsequent Save

`apps/studio/src/source/authoring-session.ts:62–65` adopts the new source, file token
and clean baseline before activation. If compile/initialization fails, controls
are never applied or retained by the session. `save()` at line 48 reconstructs
document controls from the old still-running preview through `getControls()`.

CPU probe: old preview intensity 0.2; newly opened document intensity 0.8; submit
throws. The UI/session report clean source/controls, but Save writes intensity
0.2 into the new file. This violates full-document preservation even though the
source files themselves survive the failed activation.

Recommended patch: retain opened document controls separately from the retained
previous preview. Saving an unactivated draft must preserve its controls; advance
the live/document binding only on successful activation/control application.
Test failed compile, failed init and failed control application, then Save, using
different old/new control values. Assert disk payload and dirty state explicitly.

### P2 — failed MCP candidate diagnostics target unchanged draft text

`apps/studio/src/authoring.tsx:51` tags an MCP build failure with
`expectedDraftVersion`. That version describes the draft the assistant read,
not the changed candidate it submitted. Failed `workspace.submit` correctly
preserves the old draft/version. `source/diagnostics.ts:14` sees the matching token
and file path and treats the candidate diagnostic as current, enabling navigation
into unrelated old text at the candidate's coordinates.

CPU probe confirmed a diagnostic tagged with the retained version produces a
current navigation target despite representing different candidate content.
Recommended patch: associate diagnostics with submitted source identity/content,
not just the concurrency token. For a rejected differing candidate, retain the
message but mark its target unavailable/stale unless that exact source is visible.
Test a changed helper file at an existing path failing compilation through MCP;
the old draft remains and its text must not receive the candidate's location.

## Reviewed boundaries without additional findings

The pure workspace freezes admitted full bundles, takes the build lock
synchronously, rejects stale draft versions, preserves failed-build drafts,
tracks all files for dirty comparison and keeps whole-replacement undo separate
from per-file CodeMirror history. Existing same-basename cache keys are complete
paths, and document identity clears old histories. Metadata-only navigation does
not advance source version or control runtime lifetime.

Browser admission imports the same compiler source-policy function. Its
`Buffer.byteLength` to `TextEncoder` change preserves UTF-8 byte counting after
the existing well-formed-string check; no second browser policy was introduced.
The editor uses the launch nonce, bundled TypeScript mode and view teardown with
retained editor state. No weakening of script/network CSP was found. Actual native
IME, accessibility, layout/rendering and CSP enforcement are outside this CPU
audit; the coordinator owns those checks. The known palette issue was excluded.

## Follow-up fixes and verification

Finding 1 is fixed in `ac0e5e0`: CodeMirror dispatch admits proposed text before
updating its visible document/history. It also covers undo transactions, which
bypass CodeMirror state filters. The regression failed before the patch and now
passes two identical invalid edits while preserving earlier valid undo history
and whole-document save agreement. No palette changes are included.

Finding 3 is fixed in the follow-up source-aware diagnostic patch: the authoring
handler compares the submitted complete source with the retained draft when
attaching diagnostics. A differing rejected candidate is labeled candidate-only
and cannot navigate into the retained source, even with the same concurrency
version/path. Current-source diagnostics retain existing navigation behavior.
The direct navigation regression failed before the fix; multi-file failed-build
and Problems-panel tests now cover the complete behavior.

Validation after both fixes: Studio CPU/build suite 45/45 general tests plus
7/7 CodeMirror editor tests; TypeScript checking passed. No graphics launches.
Finding 2 is owned by the coordinator's separate document-control preservation
patch and was not edited in this lane.
