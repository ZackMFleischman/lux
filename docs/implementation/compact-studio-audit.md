# Compact Studio audit

2026-09-12. Audit and proposed slices only; no implementation or new native run.
Read [Studio design](../design/studio.md) and [layout checkpoint](layout-checkpoint.md)
first. The user requests a **+ on every Dockview tab group**, real multiple pane
views, a cleaner Build/Open area and file explorer, icon playback, and compact
defaults. Reopening four singleton panes alone does not satisfy multiple views.

## Evidence and findings

Visual evidence is the existing
`artifacts/studio-ui/docking/desktop.png` (1783 × 974 image pixels). Its apparent
sizes are screenshot measurements, not CSS-pixel or DPI assertions. Code evidence
is the current `apps/studio/src` implementation. Usability consequences below are
design judgments, not measured user-study findings.

| Priority | Observed evidence | Consequence and proposed change |
| --- | --- | --- |
| P1 | Screenshot has an authoring button strip, large brand/scene row, and View & layouts row before tabs; raw authoring text appears visually different from the shell typography. `authoring.tsx` renders adjoining inline buttons with no shared flex/gap layout; `studio.css` gives `.app-bar` 66px height. | The document and primary action lack a coherent hierarchy. Use consistent theme typography in one compact application bar: small brand, File menu, View menu, document/dirty state, one labeled Build action, concise build/connection status. Keep Open, Save, Save as, and Export reachable through File. |
| P1 | Source shows the same file through a source heading, full-width file button, and editor tab. The always-visible add-file form and separate Close tab row push code down to roughly y=509 after the pane begins near y=205. | Use plain compact file rows, a Files heading with a small new-file action, and an inline form only while adding. Put close on the file tab. Move source-replacement Undo to an enabled contextual action/menu with clear semantics. |
| P1 | `StudioDockShell.tsx` has only global Open buttons. `LuxDockLayout.tsx` supplies no group header action. `open(kind)` activates an existing pane without moving it. | Add a group-local + menu whose selected operation targets that exact group; global View remains available when every pane is closed. An Open button that focuses a distant pane would violate the local affordance. |
| P1 | Live shell creates one host/slot per kind and forces every definition to `multiple: false`. | Real duplicate views require IDs and lifetime/state work, not a menu rename or a registry flag. See the next section. |
| P2 | Preview duplicates its tab title in a 53px minimum toolbar; transport has four text buttons in a 62px minimum row. | Use a compact preview toolbar and 32–36px transport row, with labeled icon actions and visible playback state. Keep Reset and Restart distinct. |
| P2 | Screenshot exposes Pop out. `authoring.tsx` supplies a window adapter whose popout action throws an unsupported-checkpoint error; `renderer.tsx` disables the button only when the entire window adapter is absent. | Drive action availability from the actual capability. Hide the unavailable action or disable it with an accessible explanation; keep supported fullscreen reachable. Do not turn a knowingly unavailable action into a routine error. |
| P2 | `.studio-pane-source .source-columns` always stacks; `CodeEditor.tsx` fixes editor height to 280px. Screenshot shows an outer pane scrollbar and editor scrollbar. | Let the editor fill remaining pane height; bound file-list and Problems overflow. Make explorer layout respond to pane width, not only window width. |
| P2 | Inspector spends much of its height on prose, unavailable metrics, and long runtime identifiers; Jobs has its own title inside its tab. `theme.ts` defaults every Button to outlined. | Keep Controls prominent, collapse Runtime/Host details initially, use quieter text/icon actions for secondary commands, and shorten idle Jobs. Preserve actual status and error access. |

The screenshot does not prove focus order, contrast ratios, keyboard behavior,
throughput, or GPU continuity. The checkpoint records prior coordinator validation
of docking, exact restore geometry, editor/canvas identity and advancing output;
that is existing evidence, not validation of these proposals.

## Multiple views: present constraints and intended contract

`registry.ts` permits multiple Inspectors generically, but the live Inspector has
no node lock/selection operation. `LuxDockLayout` passes `panelId` and view state;
the live pane closures ignore them. `personal-layout.ts` validates singleton
counts, retains closed panes, bounds total records at 32, and saves only validated
machine-local data. Preserve those validation and ownership boundaries.

| Kind | Current constraint | Required real-view behavior |
| --- | --- | --- |
| Source | Shared `SourceWorkspace.selectedFile/openFiles`; `editor-state.ts` caches one EditorState/scroll position per file. External text replacement resets editor history. | Each view gets independent file selection, tabs, cursor, scroll and focus. Draft text, dirty tracking, build/save/diagnostic admission remain workspace/session-owned. Define shared-buffer transaction and undo behavior before supporting the same file in two editors; duplicating the current cache would lose or overwrite view/history state. |
| Inspector | One scene-controls renderer; future lock state exists only in generic schema. | Independent real view instances may share scene values and keep separate presentation state. Label them as scene Inspectors. Node locks require the actual selection/target service and missing-target behavior from the design. |
| Jobs | One renderer over the shared job snapshot; schema accepts a filter but live content does not consume it. | Independent filter/selection state over the same job source, with no extra job polling or execution. |
| Preview | One retained canvas/presentation host; moving it preserves its consumer. Fullscreen/maximize assumes that host. | Additional real Preview views need distinct presentation consumers of the same completed output and independent fit/zoom. Do not create another runtime, producer, clock or input subscription. Consumer cleanup, fullscreen target and resource cost need explicit acceptance. |

Use unique stable **view IDs**, separate from pane kinds. Retain a host per view ID
across move/close/reopen; pane DOM mounts only attach it. Keep client, source
workspace, session, renderer producer and editor/buffer owner above the shell.
Do not clone scene/session objects. Route persisted, validated view state into
the actual renderer and back; never put source text or runtime identities in a
personal layout. Preserve existing v1 layouts or provide a tested migration if
the schema changes.

## Proposed compact arrangement

```text
LUX  File  View  Untitled *             [Build]  Preview current  Connected
┌─ Source ───────── + ┐┌─ Preview ───────────────── + ┐┌─ Inspector ─ + ┐
│ Files          [+] ││ FINAL                 [fit] ⋯││ Controls       │
│ visual.ts •        ││                              ││ Intensity 0.50 │
│ [visual.ts  ×]     ││        dominant image        ││ ▸ Runtime      │
│                    ││                              ││ ▸ Host         │
│ editor fills space ││ [▶/Ⅱ] [reset] ⋯        Paused ││                │
└────────────────────┘└──────────────────────────────┘└────────────────┘
Jobs +                 compact status / error count
```

Proposed CSS targets: one 36–44px application bar, 28–32px group/file tab rows,
and 28–32px pointer targets (never below 24px). These are starting acceptance
targets, not screenshot-derived measurements. Preserve readable 13px editor
text. At laptop widths keep the existing tabbed starting arrangement; use compact
pane contents and a small Jobs area when visible. Defaults apply to fresh/reset
layouts only; a resize must not replace a saved arrangement.

## Bounded implementation slices

1. **P1 — group-local +.** Use the installed Dockview React header-action extension
   (`rightHeaderActionsComponent` is present in its local typings), with the
   owning group as the explicit target. Extend the adapter to add/reopen into a
   group rather than depending on whichever group is active. Menu entries say
   Open for closed singletons, Move here for an existing singleton elsewhere,
   and focus an existing pane in the same group. Handle a group removed while
   its menu is open without relocating another pane. Retain View > Add pane and
   directional move commands. This useful interim slice is not multiple-view completion.
2. **P1 — application and Source density.** Consolidate command presentation while
   keeping callbacks in AuthoringApp/session and applying shared typography and
   explicit gaps. Replace file buttons and permanent
   creation form with compact rows and a contextual input; Enter submits, Escape
   cancels, validation errors retain typed input. Fill the pane with the editor.
   Preserve full-path identification, entry/dirty markers, drafts, undo,
   diagnostics, Ctrl+S, IME protection and source-replacement Undo semantics.
3. **P1 — actual multiple views.** Introduce the view-ID host model and implement
   separate real Inspector/Jobs view state first. Then isolate Source view state
   and implement/test buffer synchronization, including same-file edits and undo.
   Expose New Source view / New Inspector / New Jobs view only as each works.
   Additional Preview consumers are a separate native gate, not a duplicate
   producer shortcut. Menus distinguish creating a view from reopening one.
4. **P2 — transport and compact defaults.** Use play/pause icons with names that
   reflect the next action; keep reset available and restart in a labeled overflow
   menu. Preserve command serialization, authority/availability guards, errors,
   paused/playing/failed status and native fullscreen return. Compact secondary
   toolbar/detail spacing and idle Jobs; integrate layout controls into View and
   reflect actual window capabilities before showing/enabling actions.

For the queued C11 first patch, combine slice 1 with slice 2's application bar
and compact file controls, plus icon conversion of the existing transport from
slice 4. Keep the
current singleton content and lifecycle intact, and state that limitation in
the change description. Defer editor buffer/view separation and multi-consumer
Preview work to slice 3; do not represent C11 as completing real multiple views.

## Accessibility and acceptance

All +, close and transport icons need accessible names and focus-visible styles;
tooltips also work on keyboard focus. Group + has a contextual name, menu state,
Enter/Space activation, arrow-key navigation and Escape cancellation. Return
focus to the trigger on cancel and to the new/moved pane on selection. Closing
the focused pane selects a surviving tab or a reachable global control. Provide
keyboard move/split actions, disambiguated duplicate-view titles, and readable
truncated paths. Do not bind bare Space over text editors or input controls.
Menu Escape must not unexpectedly invoke the global fullscreen/maximize handler.

**CPU gates per relevant slice:** extend the real Dockview + CodeMirror DOM tests
in `apps/studio/test-dock-cpu.mjs` for exact target-group membership, a removed
target, all-closed recovery, reopen identity and menu focus. For multiple views,
assert distinct IDs/DOM, independent view state, shared draft edits and defined
same-file undo, persistence, retained closed-view state and bounded cleanup.
Assert unchanged instance/revision/clock epoch and runtime producer/subscription
counts on layout actions; a playing clock keeps advancing. Run the existing
Studio/layout CPU suites and typechecks for
the changed interfaces; DOM tests do not certify pixels or GPU work.

**Coordinator native gates:** capture compact desktop and laptop screenshots at
recorded viewport/DPI; verify actual editor space, no clipped commands, long
paths, menus at right/bottom edges and larger text scaling. Exercise keyboard,
pointer drag/resize, file creation/errors, source focus/undo/IME, transport,
save/open/export and fullscreen/Escape return. Confirm menus leave persisted
bounds unchanged. Check one advancing producer through moves, closure, tabs and
multiple views, and measure consumer/resource counts and hidden-pane cost against
the existing baseline. Any second Preview requires real presentation evidence;
cross-document popouts and monitor-removal recovery remain their separate gates.

## Inspector follow-up from actual use

User feedback, 12 September 2026: Performance, Runtime and Host output consume
space needed by visual properties. Add a bounded polish pass after the compact
shell integration and alongside asset implementation. Keep properties first;
make each diagnostic section independently collapsible and initially collapsed.
Expanded content uses compact label/value rows and minimal vertical padding.
Long revisions/instance identifiers need accessible full-value disclosure/copy
without wrapping into tall blocks. Routine telemetry must not reset disclosure
state. Verify keyboard operation, narrow pane readability and stable property
editing. This is scheduled near-term in roadmap.md; implementation is pending.
