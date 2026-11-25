User result: Understand how Scene relates to the components shown in Graph, while retaining easy access to scene controls.

Observed: Scene is rendered as a disconnected peer node with no visible relationship to the composition. This implies a missing connection.

Acceptance:
- Represent scene ownership or context clearly instead of leaving an unexplained orphan node.
- Distinguish ownership/navigation from actual image or data connections; do not invent a render edge.
- Keep scene controls reachable and clearly mark scene versus component selection.
- Verify direct visuals, multi-component scenes and nested-component navigation in the actual app.

Checklist: short UI design; implement; independent code and screenshot UX review; merge; demonstrate.
Scope: Backlog. Ticket creation requested now; no abstraction refactor or implementation dispatch.
Evidence: User Graph feedback in task 01a09baf-3806-7eb0-8bed-48b8b7f771cf, 16 September 2026.
Source: apps/studio/src/GraphPanel.tsx graph-scene-root.
