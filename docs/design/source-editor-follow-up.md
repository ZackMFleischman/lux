# Source editor follow-up

Status: captured QA request and open design work; no implementation authorized by this note.

User requests TypeScript syntax highlighting as future Studio polish. The current multiline source field edits only the entry module. Source bundles can contain additional files, which are preserved, but there is no file browser/editor UI for them yet.

The existing [Studio design](studio.md) defines Library, Graph, Preview and selection-following Inspector. The [project model](project-model.md) distinguishes Projects containing Scenes from Scenes composing Component instances (Nodes). A Scene produces one final image; selecting a Node does not replace that final preview. Explicit Inspect output selects an intermediate output. Files implement components; files are not automatically graph nodes.

The detailed source navigation experience is not specified in those designs. Before implementing it, resolve:

- A dockable Source panel with syntax highlighting and an off-the-shelf open-source editor; editor choice remains open.
- Navigation from a selected Node to its Component definition, entry file and helper files, with clear instance-versus-shared-definition scope.
- File tree versus file tabs, opening multiple definitions, and retained unsaved buffers when switching scenes or panels.
- Clear edit impact when multiple Nodes or Scenes share a definition, consistent with project-local overrides and explicit library publishing.
- Source diagnostics navigating to the relevant file and line.

These are proposed elaboration topics, not additional settled UX decisions. Studio remains closed during the separate transport test; this note requires no app launch.
