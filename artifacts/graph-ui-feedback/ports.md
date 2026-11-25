User result: Read every Graph node port and its final-output label without overlap.

Observed: Ornament Region Styles has enough inputs to extend below its fixed node box. Port labels collide with Final output · image.

Acceptance:
- Size each node to fit its header, largest port column, and optional final-output label.
- Keep ports, labels and wire anchors aligned inside the node boundary.
- Keep Fit, panning and zoom bounds correct for tall nodes.
- Verify the supplied many-input case and ordinary nodes at narrow and wide panel sizes in the actual app.

Checklist: implement; independent code and screenshot UX review; merge; demonstrate.
Scope: Backlog. Ticket creation requested now; no implementation dispatch in this request.
Evidence: C:/Users/zFlei/AppData/Local/Temp/codex-clipboard-57b2c75a-0c1f-4193-adca-aafcd3d921af.png
Source: apps/studio/src/GraphPanel.tsx and graph styles in studio.css.
