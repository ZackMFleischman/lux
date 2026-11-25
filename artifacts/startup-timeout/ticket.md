Normal palette and texture edits repeatedly fail with initialization stopped making progress while the previous preview survives. Diagnose the stalled stage and fix the cause so valid visuals start reliably without weakening authored-loop containment.

Acceptance:
- Reproduce or isolate the startup failure with stage evidence in an isolated profile.
- Add regression coverage and verify valid startup plus hung authored initialization retention.
- Preserve the current preview and user files on failure.
- Complete independent review and package handoff; record remaining installed validation.
