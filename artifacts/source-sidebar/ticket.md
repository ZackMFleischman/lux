Refactor the Source panel into a persistent left sidebar. Keep Files above a bottom-anchored collapsible Assets section. Let Files use the remaining height. Add an accessible collapsed icon rail. Move source replacement undo to an icon action in the Files header. Keep asset import and validation feedback compact and accessible. Preserve source, asset, and undo behavior.

Acceptance:
- Wide and narrow layouts keep the sidebar left of the editor.
- Expanded Files uses available height; Assets stays at the bottom and collapses.
- Collapsed mode shows an accessible icon rail and preserves all data.
- Import, empty state, transient asset status, and undo remain usable by keyboard.
- Focused tests and isolated actual Studio screenshots cover the changed layout.
