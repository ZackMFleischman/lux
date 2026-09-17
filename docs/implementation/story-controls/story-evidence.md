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

Native Story demonstration, full runtime review, and acceptance remain pending.
The original Vinyl Cosmos file is not edited. Migration writes a separate copy.
