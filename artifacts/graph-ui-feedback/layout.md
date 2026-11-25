User result: Inspect a branching composition without an unnecessarily long single row of nodes.

Observed: Graph places every node left-to-right at the same height. Parallel branches could use vertical space more clearly.

Acceptance:
- Retain left-to-right flow while vertically stacking parallel or independent branches where useful.
- Use actual node sizes. Avoid overlapping nodes, ports and routed wires.
- Keep deterministic placement, selection, nested navigation, Fit, pan and zoom usable.
- Compare a linear composition and the user's branched ornament composition in actual-app screenshots.

Checklist: implement; independent code and screenshot UX review; merge; demonstrate.
Scope: Backlog. Build on corrected node sizing; no graph editing or manual-layout framework required. Ticket creation only now.
Evidence: C:/Users/zFlei/AppData/Local/Temp/codex-clipboard-57b2c75a-0c1f-4193-adca-aafcd3d921af.png
Source: apps/studio/src/GraphPanel.tsx.
