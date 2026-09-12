# C14 asset pipeline independent review

Reviewed `4cb49a8`, `3a83626`, and `8acbbe3` against `37f1188` in
`C:/Users/zFlei/repos/lux/.worktrees/checkpoint-asset-foundation`.
Read the approved `docs/implementation/required-assets.md` and C14 delivery report.

## Result

No material correctness findings in this bounded source/scene/compiler/linker slice.
Approved for integration with the existing unsupported-preview/export guards retained.
This is not approval of asset playback or installed asset releases.

## Evidence checked

- Legacy source validation remains the original implementation in its own branch,
  including locale-based file normalization. Legacy artifact/linked bodies retain
  their original field and record order; v2 sorting is conditional. Newly pinned
  helper/compiler bytes intentionally change build identities without rewriting
  saved legacy documents.
- V2 source captures own data descriptors, checks the unchanged TypeScript limits,
  validates all assets, sorts file/asset keys by ASCII order and measures exact
  compact JSON against 6 MiB. Scene/source versions are correlated. Raw records are
  checked before schema cloning; v2 source canonicalization does not leak into the
  legacy scene source path.
- Scene validation precedes binding/replacement. The existing save queue,
  conflict hash, exclusive temporary file, flush and atomic rename are retained.
  V2 checks both actual opened bytes and pretty-printed save size against 7 MiB,
  retaining the 8 MiB hard bounded read and fatal UTF-8 decoding.
- Artifact and linked bodies include version, original asset descriptors and
  assetSetHash. Verification re-derives byte hashes and dimensions, then rehashes
  the full canonical body. Compiler parent verification also checks the expected
  source hash/version and independently derived asset-set hash. Linked parent
  verification compares the already-verified artifact identity/version/asset set.
- Only TypeScript is materialized. Asset data stays outside emitted executable
  modules. Both dependency inventories include the asset, canonical identity and
  bounded JSON helpers; their import closure introduces no additional unpinned
  local helper. Existing virtual module resolution remains in force.
- Compiler/linker inputs, supervisor results and worker results use bounded reads
  before fatal decoding/JSON parsing. Exact request/artifact/diagnostic/linked
  serialization checks remain, with no enlarged process timeout or output caps.

## Independent verification

Ran these CPU tests from the reviewed worktree using Node `--test --test-isolation=none`:

- `tests/compiler/asset-source.test.mjs`
- `tests/compiler/asset-identity.test.mjs`
- `tests/compiler/bounded-json.test.mjs`
- `tests/core/scene-file.test.ts`
- `tests/compiler/result-budget.test.mjs`

**14 tests passed, zero failed.** This includes legacy canonical-body checks,
forged metadata/version rejection, unrelated-but-internally-consistent asset
substitution rejection, malformed UTF-8/byte bounds, version-pair rejection,
scene conflict/failed replacement preservation and exact escaped result budgets.
Reviewed the contained integration/helper-change test and implementation directly;
did not repeat the implementer's expensive contained compiler/linker suite.

Review was read-only in the implementation worktree; its status remained clean.
No graphics, native host, installs, dependency edits or runtime playback ran.
The full future transport/release/worker consumption chain remains outside this
slice and must retain its separate acceptance gates.
