# Story implementation evidence (in progress)

Worktree: `.worktrees/story-controls`, branch `codex/story-controls`.
LUX197 owns this slice. Approved contract: the linked `story-revised-contract.md`
and independent revision review in the planning artifact directory.

Completed local verification:
- Scene v6 structural persistence, omission versus explicit clear, and atomic
  source/Story promotion tests pass. Legacy Scene and authoring tests pass.
- Independent persistence review found legacy Open committed a failed candidate's
  file token and draft. Open now commits authority only after candidate success,
  including staged library fallback; reviewer approved the correction.
- Existing scene-file test fixture omitted already-required normalized tempo.
  Added `{bpm:120}` to its expected document, without product tempo changes;
  all twelve scene-file/animation checks pass.
- Example `packages/visual-sdk/examples/story.ts` compiles and links as version6;
  SDK example TypeScript check passes. Discovery exposes it and the Story contract.
- Skill baseline retrieval could not execute the Story workflow from old docs.
  Updated reference passed the same application scenario; added precise receipt
  fields, seek bounds, opaque hash provenance and return-normal cursor behavior
  in response to the retrieval gaps. Repository skill installation and --check passed; installed app compatibility is still checked at use time.

Independent source review approved the contracts/compiler, persistence, runtime,
command receipts, Story UI and MCP wiring. Fresh receipt/runtime/transport checks
passed 9/9; the worker suite passed 21/21. Studio TypeScript and build passed.

Product commit: 90209c5022cb3990be8ce2039b8524cdda8e951c.
The first native run found the authenticated bridge omitted both Story methods.
Commit d4e179676e243c9be3a1733e0e2bf879597991e0 admits them; the independent bridge
regression passed 2/2, including unknown-method rejection.

Native acceptance remains in progress. The second run inherited the original
full-HD output and failed the resize setup after an initialization watchdog fault.
The migrated demonstration copy now starts at 640×360; runtime watchdogs are
unchanged. Native evidence must be read with that output-size limit.

The original Vinyl Cosmos file is not edited. Migration writes a separate copy.
Original SHA-256: b18bdd303430c288bd95c156f35a1bfa5c9f24b90745c3a013a0e79a8b27043e.
