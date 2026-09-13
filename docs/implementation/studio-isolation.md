User result: Run /start-lux and create a visual in a stable Studio while agents build and test in other worktrees.

Authorized here by the user on 13 September 2026. This is a separate user-requested startup milestone, coordinated with the sole four-workstream coordinator. No second managed team.

Implementation plan:
1. Add one shared Studio session resolver. Ordinary launches use a deterministic per-checkout profile. Explicit creative launches use a reserved profile and pinned checkout. Automated launchers always generate a unique test profile. Use each profile for userData, the single-instance lock and the endpoint.
2. Bind the MCP adapter to that selected checkout/profile and the first connected process instance. Reject a changed identity instead of silently following an endpoint replacement. Keep credentials private. Preserve other profiles and the legacy user profile.
3. Update all Studio test launchers to pass the same test environment to their app and adapter, and operate only on their own process. Add CPU routing/regression tests and a concurrent Studio demonstration harness. Run the real demo only with executable provenance and a coordinated GPU reservation established.
4. Ship start-lux in the repository. It prepares/reuses a dedicated creative checkout at a recorded commit, with separate build output and dependencies, then delegates to lux-visual-creation. Update both skills with explicit profile/adapter pairing and test ownership. Install and check both from reviewed source after integration.

Validation: CPU tests must show different checkout/test/creative profiles, invalid profile rejection, checkout and endpoint identity mismatch rejection, and no cross-profile MCP routing after replacement. Build/typecheck changed code and run relevant existing Studio/skill tests. A real demonstration must show creative scene/source/playback survival during launch, operation and shutdown of a separate test Studio. Report a missing physical precondition as incomplete, without replacing it with CPU evidence.

Scope excludes SDK/visual semantics, native-input provenance recovery, installed Resolume changes, global environment changes, dependency upgrades and automatic creative upgrades. Coordinator serializes main integration and independent source review.
