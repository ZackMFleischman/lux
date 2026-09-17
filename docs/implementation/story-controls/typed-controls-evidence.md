# Persistent typed controls

Implementation worktree: `C:/Users/zFlei/repos/lux/.worktrees/story-controls`.
Branch: `codex/story-controls`.
Product foundation: `660e0db71f5d1b8577d88638a87ef006c31716a7`.

Authors can declare boolean and enum controls beside numeric controls. The native
Inspector renders switches, dropdowns, radio groups and segmented choices.
The generic parameter operation validates values against the accepted schema.
Saved enum values use stable option IDs. Component instances retain separate
values. Numeric modulation remains numeric only. Numeric export is unchanged;
typed schemas fail export preflight before packaging, including hidden node controls.

## Verification

Contract/compiler verification covers literal metadata admission, hostile inputs,
numeric canonical compatibility, migration and SDK type inference. Runtime checks
cover flat and component writes, acknowledgements, stale guards, captures, aliases,
and nonnumeric modulation rejection. Both TypeScript configurations pass.

The first isolated Studio run passed native edits, mixed MCP patches, save/reopen,
stable enum relabel/reorder, invalid-build preservation and component isolation:
`artifacts/studio-typed-controls/native-1789632068797/result.json`.
Its receipt records its exact dirty-source hash, fixture, harness, owned process
and isolated profile. It predates final keyboard-help remediation and is supporting
evidence only.

Final product source: `325be93de6ca0a5e5871b0165358cf91d8cd352b`.
Final native receipt: `artifacts/studio-typed-controls/native-1789632976959/result.json`.
Executor: independent QA agent `/root/typed_controls_qa`, using the committed
product with an empty tracked diff and the harness hash recorded in the receipt.
All eight workflow checks passed. The isolated profile was
`test-cde6908c-4013-48fd-bd25-00f50dd97307`; owned PID 18080 exited. No page errors
were recorded. Normal 1360×900 and narrow 820×720 windows were checked with a
640×360 preview; the narrow Inspector measured 242px. Invalid-build paused
preview hashes matched exactly. Screenshots in that directory show clean wide
and narrow controls, keyboard option help, component isolation and failure recovery.

Independent review identified and prompted fixes for hidden typed export schemas,
stale enum focus acknowledgements, rejected edit focus restoration, and visible
keyboard help for option descriptions. Independent reviewer
`/root/review_typed_controls` approved final source and actual-app UI evidence.
Final TypeScript check and visual-skill install/check passed after remediation.
A focused Tooltip DOM test emits a non-failing React act timing warning.

## Limits

This is development-checkout delivery. The installed creative Studio and saved
user scenes have not been replaced or edited. Actual Resolume host behavior is
outside this slice; number-only packaging and typed rejection use CPU checks.

The existing whole-schema animation identity policy remains: changing enum
metadata preserves the selected option ID but can retain numeric animation
bindings in a disabled state after the schema hash changes. This slice does not
weaken that safety policy.

Focused relevant checks pass; this does not claim the entire repository suite
passes. Broad compiler checks encountered baseline/environment failures, and an
existing DOM tooltip font-size assertion is environment-sensitive.
