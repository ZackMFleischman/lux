# Docked authoring checkpoint

The real AuthoringApp now supplies Source to StudioApp's Dockview shell. Preview,
Source, the existing scene Inspector, and Jobs use the existing MUI components.
View & layouts exposes reopen, keyboard-accessible directional/tab placement,
named save/restore, and desktop/laptop resets. Desktop starts with the approved
preview-dominant splits; windows narrower than 1100 CSS pixels start as tabs.
Changing window width later does not discard a personal arrangement.

The authoring client, workspace, session and editor cache remain above the shell.
The shell owns stable DOM hosts and React portals for the four real panes. Panel
mounts only attach these hosts; closing a pane removes its host from the document
without destroying its React contents. This retains the actual canvas, consumer
lease, CodeMirror view/history and form state. App teardown still releases the
PreviewBinding consumer once. No runtime invocation occurs during docking.
Native fullscreen and workspace maximize temporarily move the same preview host
into the shell's expanded container, then return it to its dock slot. The dock tree
stays mounted and hidden during this operation. Existing source/export/MCP and
native fullscreen actions retain their owners.

This live checkpoint registers one scene Inspector (the current UI has no node
selection/locking operation). The generic adapter still supports multiple locked
inspectors for future real node renderers. Floating/popout Dockview groups remain
disabled. Personal layouts use the existing validated machine-local browser
storage boundary and do not enter scene or release content.

## CPU verification

- `node apps/studio/test-dock-cpu.mjs`: real Dockview React + jsdom, real SourcePanel
  and CodeMirror, Preview with a fake CPU presentation port appending a canvas
  element (no canvas context). Close/reopen, tab placement, save/restore, both
  reset modes, fullscreen/maximize return, live snapshot updates and app teardown
  preserve the expected DOM identities and one runtime subscription/consumer.
- `node apps/studio/test-cpu.mjs`: 62 Studio tests plus 7 editor tests pass.
- `node apps/studio/src/layout/test-cpu.mjs`: 4 adapter tests and React/CSS bundle.
- `node node_modules/typescript/bin/tsc --noEmit` and `-p tsconfig.build.json` pass.
  The Studio CPU runner also builds the actual production renderer/CSS.

## Remaining coordinator graphics/UI validation

DOM identity is not GPU presentation proof. In packaged Electron, exercise actual
pointer drag, split resizing, tab keyboard/focus navigation, close/reopen, laptop
and ultrawide sizing, menus and source focus/undo. Confirm the nonce-protected
Dockview styles render under packaged CSP. Verify actual canvas output and one
producer/clock through dock moves, closure, tab changes, fullscreen/return and
maximize; inspect long-lived hidden-consumer cost and cleanup. Check Escape and
native return, DPI/monitor changes, and performance with active source editing.
Cross-document popouts, monitor-removal recovery, and GPU/context portability
remain the separate U04/U05 gates, not claims of this checkpoint. No Electron,
Studio, graphics or native producer was launched for this implementation.
