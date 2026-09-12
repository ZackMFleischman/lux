# C15 asset authoring companion review

Scope: uncommitted changes against 41768fa in `C:/Users/zFlei/repos/lux/.worktrees/checkpoint-asset-authoring`, including the three new source helpers and eight new CPU tests.

Verdict: no blocking implementation/regression findings; one minor discovery-contract correction requested before final integration.

## Finding

[P2] `scripts/studio-mcp.mjs` discover metadata advertises `assetFileBytes: 1048576`, but approved policy and `packages/assets/src/index.mjs` limit each decoded BMP file to 786486 bytes; 1048576 is the cumulative decoded-file budget. Report per-file and aggregate limits separately, preferably from the shared assetLimits values. Otherwise an assistant following discovery receives an inaccurate admission contract.

## Reviewed behavior

Whole-source equality includes version presence and complete admitted asset descriptors; changedAssets reports additions/removals/byte changes. The source policy freezes asset records/descriptors, and workspace freezes source/files. Text edits retain assets, failed activation retains the complete prior snapshot, successful whole-source replacement supports complete undo, and legacy versus empty v2 remains a meaningful document change. Existing document dirty indication exposes asset changes without pretending they are TypeScript tabs.

Session saves/exports now select matching document versions through the browser-safe scene-document module. Legacy source remains v1. Open replaces the draft before activation, retaining its file binding and pending document controls if the temporary playback gate rejects, so the asset document can still be saved while the old preview remains. Export requires successful activation before publication. New browser imports reach pure schema/policy/asset helpers and type-only scene-file references, with no Node filesystem import introduced into authoring UI.

Diagnostics use whole-source equality for candidate provenance; asset locations cannot target a code tab because target resolution requires a current submitted TypeScript file. MCP uses the shared source schema, requires v2 assets, returns complete source, and caps the escaped tool-result representation rather than merely the inner JSON. Agent bridge now decodes UTF-8 once after bounded chunk accumulation, fails malformed text, and caps serialized responses. Existing bounded replay/queue behavior remains intact.

The explicit client/main/CLI compile/export/transport gates reject versioned/asset-bearing source before old workers or legacy packages can silently omit assets. Invalid legacy payloads still reach existing validation. Gates are intentionally temporary and must be removed only alongside verified full-envelope compile/link/runtime/export plumbing. This patch does not itself claim asset playback.

## Validation boundary

Read the full diff, new helper/test files, session/workspace control flow, shared scene constructor and relevant browser dependency imports. Coordinator reports eight new CPU tests and root/Studio typechecks passing; the full Studio CPU suite is running separately. This reviewer did not rerun that suite or launch graphics. Tests meaningfully exercise asset-only changes, failed replacement/undo, versioning, source preservation, diagnostics, response escaping/Unicode rejection and early playback/export rejection. No code edits were made.

Final review: PASS. Confirmed commit 8e99781 imports shared assetLimits and reports separate per-file (786486) and aggregate (1048576) limits, with shared count/dimension values. The sole review finding is resolved.
