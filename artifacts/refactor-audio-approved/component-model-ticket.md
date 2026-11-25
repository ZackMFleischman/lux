Use one component model for code and graph implementations. A node is a component instance; a visual is the runnable graph with public inputs, controls and image output; a scene persists it. Needed now to remove flat/graph behavior differences before audio controls.

Keep defineComponent and defineVisual. Adapt defineComposition and existing direct visuals without rewriting saved files. Reuse current compiler/runtime and preserve stable node paths, aliases, hashes, animation bindings and library sources. No broad graph editor or parallel evaluator.

Acceptance: independently review the identity/compatibility design; implement; test old and new source/scene fixtures; demonstrate equivalent Graph/Inspector editing, save/reopen and failed-build retention in isolated Studio; independently review and integrate; update/install/check shipped skill. Record exact source and actual screenshot/runtime evidence.

Reference: artifacts/refactor-audio-approved/brief.md. Coordinate signal interfaces with Studio audio; preserve LUX7/LUX59 blockers.
