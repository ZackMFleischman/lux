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


## Native behavior verification

Executor: independent QA agent /root/typed_controls_qa, checkout Electron with
studioTestEnvironment and the matching external stdio MCP adapter. Preview output
was 640×360. Product source was 7a5bd180a776a00c12109479493b41882212eb34.

- artifacts/studio-story/native-1789652013988-full/result.json passed selection,
  sustained hold beyond scheduled dwell, Story versus Preview pause, and explicit
  repeated-occurrence resume with fresh dwell and automatic advance. Tracked diff
  was empty. Its final pixel comparison was invalid because Preview ambient time
  was still running; this run is supporting partial evidence, not fully green.
- artifacts/studio-story/native-1789652173969-tail/result.json passed the remaining
  timed seek, exact retry, stale rejection, replay, keyboard loop and Return Normal,
  save/reopen, and invalid-build/open preservation checks. This run is fully green;
  its tracked diff was the harness-only Preview-pause/focused-tail correction.
  Harness SHA256: 1b5d25e03ad2c52b5aa0684c630f343c950fc7ad46fd4640cf8d769caa25c324.

Neither run recorded page errors. Both owned processes exited. The original scene
SHA remains unchanged. The migrated copy is now also saved outside test artifacts
at C:/Users/zFlei/repos/lux/visuals/Vinyl Cosmos Story.lux-scene, SHA256
 d005f1d4127ef6006db5ccf46c69c172bc5a9b567925a35be17e9146c1ec23dc.
It requires this development build; the installed app is unchanged.

Native screenshot review identified follow-up UI corrections: Story must keep
Preview visible on first opening, Auto-advance needs a visible label, and timed
scrubbing must precede the beat catalog. Final layout verification remains pending.
