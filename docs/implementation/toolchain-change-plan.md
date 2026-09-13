# Toolchain change proposal implementation plan

> For the assigned worker: use conductor-worker and superpowers:executing-plans. Root dispatches the fresh worker and independent reviewer. This document does not start another team.

**Goal:** propose an explicit project toolchain upgrade or downgrade with complete candidate bytes and exact original-value preconditions.

**Architecture:** capture caller-supplied bytes once. Use the existing metadata, source-resolution, declaration-pack and editor-plan owners. Return a bounded review artifact. A later trusted checker checks the complete candidate before a guarded writer can apply it.

**Tech stack:** TypeScript and Node CPU APIs. Current pack profile: TypeScript 7.0.2, Three 0.186.0, Three types 0.186.0, public SDK 0.1.0 and 0.2.0.

**Specification:** LUX-79, specification 2. Read the complete [offline tooling plan](offline-tooling-plan.md), [project editor plan](project-editor-plan.md), [filesystem plan, Slice 4](filesystem-projects-plan.md), and [metadata contract](../design/filesystem-project-metadata-v1.md).

**Inspected base:** `34c53f1ce18db13db74f11508b377c7af556bca2`.

**Delivered editor source:** `dfeadf66fd77338e39971fb78c778ac4640a252e`. LUX-75 integrated this source at the inspected base.

## Constraints and complete delivery sequence

This is a plan. It adds no application implementation. The selected implementation leaf adds only a pure API and its CPU tests. It does not run an installed target compiler, launch an editor, acquire native files, install tooling, write a project, execute authored code, change Studio/MCP/public SDK behavior, operate graphics, or change the portal. LUX-7 stays policy-stopped. LUX-59 stays provenance-blocked. Neither is a fallback dependency to retry.

Upgrade and downgrade include compiler and Three version changes, SDK selection changes, and distribution build or declaration-pack changes. The current owners do not support every such request. Keep the complete surface in this sequence:

| Stage | Exact result and prerequisite |
| --- | --- |
| T4b2, selected first implementation leaf | Pure proposal API below. Requires acceptance of this plan and delivered T4b1. Accepts targets admitted by the current pack profile. Supports a change in build/pack identity and explicit local SDK/source-envelope selections in either direction. Rejects unsupported numeric compiler/Three versions. Does not claim the whole upgrade product is delivered. |
| Target-profile prerequisite, before enabling new numeric versions | Independently review and extend `DeclarationPackManifest`, `parseDeclarationPackManifest`, the pinned builder, editor version/Three-entry checks, and their pack/semantic tests. Define an explicit finite supported-profile contract. Preserve existing hash/version compatibility or introduce a reviewed new pack format. Produce the target pack and its exhaustive declaration/metadata audit plus SDK parity evidence. No arbitrary version-string acceptance. This is a separate missing prerequisite, not part of the selected two-file leaf. |
| T4c implementation | Starts after accepted T4a and both pure T4b leaves. Inventory and authenticate the installed checker/distribution closure. Provide supported current and target selections from that authority. Numeric requests also require the target-profile prerequisite. Define candidate-check receipt identity against this proposal's exact candidate bytes. |
| T4c candidate check | Check the complete candidate under the selected authenticated target. Reject semantic incompatibility, including SDK API changes and changed compiler/Three types. Never rewrite authored source to make checking pass. This gate follows proposal generation. |
| T4d apply and product acceptance | Requires successful T4c candidate evidence and independently available guarded acquisition/writer contracts. Bind project identity, scope, revision, buffers, Git state, installed selection and native file tokens. Apply the approved metadata, lock, configs and verified pack materialization as one guarded operation. Run the actual offline/editor acceptance from the earlier plan. |

The target-profile prerequisite is visible in current code. `tooling.ts:8` fixes all three version types. `tooling.ts:75` rejects any other numeric versions. `createProjectEditorPlan` also fixes the required Three package identity and entry paths. A structurally valid lock can name 7.0.3, but this does not make its pack supported. Probe E2 demonstrates the rejection. Do not weaken these owners in T4b2. A future numeric-version request uses the same proposal contract after those owners gain independently accepted support.

Public SDK admission remains exactly 0.1.0/0.2.0. Internal SDK 0.3.0 is excluded. Package pin or package-export migration is separate package work: content-addressed package manifests and package bytes cannot be edited in place. If the requested SDK would require such an edit, refuse that candidate and report its package/export owner. The author can supply a separately prepared compatible project after that work. No requirement for numeric-version upgrades or immutable package migration is claimed complete by a current-profile fixture.

## Current owners and observed limits

| Owner | Reuse and precise limit |
| --- | --- |
| `contracts.ts` | `admitProjectMetadata(documents, suppliedToolchain)` admits all raw registered documents, pins, SDK closures and saved controls. `validateMetadata` and `parseMetadataJson` preserve strict schemas. `hashMetadata` is semantic identity, not a raw file version. |
| `resolver.ts` | `prepareProjectResolution({documents,files}, suppliedToolchain)` verifies all originals, packages, assets, source envelopes and declared import closures. It checks every definition, including unused exports/helpers. It parses TypeScript but does not typecheck it. Its returned token is private. Do not introspect it. |
| `library.ts` | Package-byte verification remains with `verifyPackageBytes`; resolution delegates to it. Do not create a second package hash rule. |
| `tooling.ts` | `verifyDeclarationPack` checks raw pack bytes against a supplied expected identity. `createProjectEditorPlan` reverifies a pack and plans every definition context. `compareProjectEditorFiles` uses private issued plans and raw observations. These functions do not authenticate an installed distribution. |
| `bounded-json.ts`, `metadata-paths.ts` | Reuse their data grammar and path policy. Add the new API's defensive input capture locally. Never expose private helpers or change these owners for this leaf. |
| `apps/build-worker/src/source-policy.mjs`, `worker.mjs` | Resolution reuses source policy. The worker owns trusted compiler settings and SDK projection. T4b2 neither executes nor duplicates that compiler. |

The project manifest has no toolchain field. Toolchain selection lives in `dependencies.lock.json`. Local component manifests carry `sdkVersion` and `sourceVersion`. Package manifests carry immutable export selections and SDK ranges. Scenes carry implementation references and saved controls. A complete candidate therefore returns unchanged raw project/scene/asset/package manifests as well as any changed local component manifests and the lock. It does not add an invented toolchain field to `project.json`.

A returned proposal has `authority: 'supplied-structural'` and `semanticCheck: 'required'`. A matching hash, a `VerifiedDeclarationPack` object or a caller's `runtimeBuildHash` is not an installed-authority token. T4c obtains expected identities from its authenticated distribution. Never derive `currentToolchain` or `targetToolchain` from the project's lock as evidence that a distribution exists. Self-consistent synthetic selections remain valid CPU fixtures and remain visibly synthetic.

The older metadata and offline-plan prose calls this argument installed-supported. The accepted editor plan explicitly separates supplied structural selection from installed authority and removes installed checking as a prerequisite for pure proposal generation. This plan follows that narrower evidentiary claim. It does not assert that synthetic selections satisfy a real installed caller's precondition.

## T4b2: one implementation leaf, two files

Create `packages/core/src/project/toolchain-change.ts` and `tests/project/toolchain-change.test.mjs`. Do not modify existing owners, barrels, package scripts, builders or product skills. The project test runner discovers the new test file. This internal pure API does not add a shipped author command.

The new module imports the public owners above. Its local functions capture inputs, serialize changed documents, build inventories, normalize errors and hash proposal rows. It has no filesystem, process, network, editor or native imports. Keep byte capture separate from asynchronous admission so caller changes cannot race later reads.

```ts
import type { DependencyLock, ComponentRef } from './contracts.ts';
import type { ProjectResolutionInput, ProjectResolutionCode } from './resolver.ts';
import type { DefinitionEditorConfig, EditorFile } from './tooling.ts';

export type ToolchainSelection = DependencyLock['toolchain'];
export type RawDeclarationPack = Readonly<{
  manifest: Uint8Array;
  files: Readonly<Record<string, Uint8Array>>;
}>;
export type LocalSdkSelection = Readonly<{
  componentId: string; sdkVersion: '0.1.0' | '0.2.0'; sourceVersion: 1 | 2;
}>;
export type FileExpectation = Readonly<{ exists: false }> |
  Readonly<{ exists: true; byteLength: number; sha256: string }>;
export type FileWitness = Readonly<{
  path: string; expect: FileExpectation;
}>;
export type ToolchainChangeRequest = Readonly<{
  direction: 'upgrade' | 'downgrade';
  project: ProjectResolutionInput;
  currentToolchain: ToolchainSelection;
  targetToolchain: ToolchainSelection;
  currentPack: RawDeclarationPack;
  targetPack: RawDeclarationPack;
  localSelections: readonly LocalSdkSelection[];
  observedConfigs: Readonly<Record<string, Uint8Array>>;
}>;
export type ToolchainChangeDiagnostic = Readonly<{
  code: 'EDITOR_CONFIG_MISMATCH' | 'EDITOR_CONTEXT_RETAINED';
  path: string; expectedSha256: string | null; actualSha256: string | null;
}>;
export type ToolchainChangeReplacement = Readonly<{
  kind: 'lock' | 'component-manifest' | 'editor-config';
  path: string; expect: FileExpectation; bytes: Uint8Array; sha256: string;
}>;
export type DefinitionChange = Readonly<{
  definition: ComponentRef;
  before: DefinitionEditorConfig; after: DefinitionEditorConfig;
  sourceVersionBefore: 1 | 2; sourceVersionAfter: 1 | 2;
  affected: boolean;
}>;
export type ToolchainChangeProposal = Readonly<{
  version: 1; direction: 'upgrade' | 'downgrade'; projectId: string;
  authority: 'supplied-structural'; semanticCheck: 'required';
  currentToolchain: ToolchainSelection; targetToolchain: ToolchainSelection;
  currentPackHash: string; targetPackHash: string;
  currentEditorPlanHash: string; targetEditorPlanHash: string;
  baseHash: string; candidateHash: string; proposalHash: string;
  originals: ProjectResolutionInput;
  originalConfigs: Readonly<Record<string, Uint8Array>>;
  candidate: ProjectResolutionInput;
  candidateConfigs: readonly EditorFile[];
  preconditions: readonly FileWitness[];
  definitions: readonly DefinitionChange[];
  diagnostics: readonly ToolchainChangeDiagnostic[];
  replacements: readonly ToolchainChangeReplacement[];
}>;
export type ToolchainChangeCode = ProjectResolutionCode |
  'TOOLCHAIN_INVALID' | 'TOOLCHAIN_MODIFIED' | 'TOOLCHAIN_UNAVAILABLE';
export type ToolchainChangeError = Error & Readonly<{
  code: ToolchainChangeCode;
  stage: 'capture' | 'base' | 'target' | 'candidate' | 'configs' | 'identity';
  path?: string; packageId?: string; expected?: string | number;
  actual?: string | number; owners?: readonly ComponentRef[];
}>;
export function createToolchainChangeProposal(
  request: ToolchainChangeRequest
): Promise<ToolchainChangeProposal>;
```

No apply function or authentication brand is exported. A serialized/cloned proposal is review data. T4c must revalidate any bytes it consumes and bind the resulting receipt to `candidateHash`, target selection and authenticated installed identities. T4d cannot treat this public object as writer authority.

`direction` records explicit caller intent. Hashes do not have a version ordering. Do not infer newer/older from hashes or sort a mixed selection by one version field. Numeric support and compatibility are checked separately. `localSelections` is an explicit bounded list; omission means preserve the local selection. Reject duplicate IDs, unknown IDs, package references, extra properties and unsupported SDKs. Accept either source-envelope version when existing owners admit it; do not invent a fixed SDK-to-sourceVersion pairing. The typical legacy and modern fixture pairs are 0.1.0/1 and 0.2.0/2.

## Capture, candidate construction and exact bytes

1. Capture every request field synchronously before the first await. Require exactly the fields in `ToolchainChangeRequest` and `ProjectResolutionInput`. Use own enumerable string data descriptors, plain/null-prototype records and dense arrays. Reject symbols, accessors, inherited data, sparse arrays, cycles and unexpected fields. Reflection can encounter throwing proxies. Catch without inspecting, stringifying or coercing a caller-thrown value. Normalize it to a fixed `TOOLCHAIN_INVALID` capture error. An internal WeakSet of locally created errors can preserve genuine quota errors without probing an untrusted error object. Follow the corrected `captureJson` design in the delivered editor owner.
2. Preflight every map count, path length, intrinsic Uint8Array length and aggregate budget before copying payloads. Reject shared/detached storage. Use intrinsic `Uint8Array.prototype.set` into new storage. Copy all source, asset, package, metadata, config and both pack bytes before awaiting any digest. Snapshot selections with bounded JSON rules. Never call a caller iterator, typed-array constructor/species or custom byte getter.
3. Validate both selections with `validateMetadata('lock', {schemaVersion:1, toolchain: selection, packages:{}})`. Parse and verify both raw packs against their separately supplied selection hashes. Never execute pack metadata. Current pack verification is required even when the target pack has the same hash. Original raw pack manifests are bounded inputs; semantic pack identity follows the existing verifier. The returned proposal binds their pack identities; its original project-byte claim does not include distribution payload archival.
4. Admit the original raw metadata with `currentToolchain`. Create the current editor plan before expensive source resolution so its definition/traversal limits reject early. Then call `prepareProjectResolution` for the original documents and original content. All three owners must succeed. No metadata-only fixture substitutes for actual source admission.
5. Copy the original document map. Replace only the parsed lock's `toolchain`. Preserve `schemaVersion` and every package pin exactly. For each explicit local selection, replace only that registered component's `sdkVersion` and `sourceVersion`. Do not change names, IDs, paths, entries, file lists, references, assets, scenes, saved controls, package exports or package manifests. Equal semantic values keep the entire original raw document unchanged, including whitespace and CRLF.
6. Serialize a changed lock or component as recursive ASCII-key-order canonical JSON plus one LF, UTF-8 without BOM. Emit object members directly in sorted order, as `canonicalJson` in contracts does. Do not reconstruct an object and assume JSON.stringify preserves numeric-key lexical order. Preserve array order and normalize negative zero as the admitted owner does. This is a complete replacement, not a textual merge. Retain the complete raw original beside it.
7. Before full candidate admission, inspect individually validated candidate component/package documents in sorted definition order. If a required SDK is absent from `targetToolchain.sdkVariants`, reject with `TOOLCHAIN_UNAVAILABLE`, its exact registered component path or `libraries/<hash>/package.json/exports/<id>` and the required SDK. This diagnostic enrichment does not admit the candidate. Re-admit the candidate documents with `targetToolchain`. Create the target editor plan with the verified target pack. Call `prepareProjectResolution({documents: candidateDocuments, files: capturedOriginalFiles}, targetToolchain)`. Both base and candidate cover all definitions, including unused local helpers and package exports. Missing SDK coverage, cross-SDK closures, missing/modified packages, invalid source envelopes, assets and import-policy violations fail with no proposal. The candidate contains every original content path with identical bytes. SDK API/type incompatibilities that cannot be established by these owners remain an explicit T4c check; no claim of semantic compatibility is emitted.
8. Return both complete raw metadata maps and complete original content maps. All unchanged project/scene/asset/package manifests retain their original bytes. The candidate lock and changed component manifests contain all fields, not a patch fragment. The candidate's content map equals the original map byte for byte. Return the full target config inventory and every definition row. No partial output escapes after any error.

Return detached frozen JSON records/arrays. Uint8Array contents are mutable; do not claim they are frozen. Use independent byte storage between originals, candidate, replacement bytes and candidate configs. Mutating one output view cannot change another. There is no persistent module cache or issued writer token in this module. Later calls use their own fresh captures.

## Complete config observations, preconditions and affected set

Compute the union of current and target editor-plan config paths. Require `observedConfigs` to cover exactly that logical observation scope: present keys contain actual bytes; an absent key means confirmed absence. Extra keys reject. The caller must finish acquisition successfully before calling. Absence cannot stand for unreadable, omitted or unknown. Unrelated custom files outside this scope are neither read nor changed.

Call `compareProjectEditorFiles` with the target issued plan and only target-path observations. Reuse its exact desired config bytes and mismatch hashes. A target config mismatch produces one complete `editor-config` replacement with the original expectation. Comments, plugin fields, non-JSON bytes, equivalent indentation, empty files and CRLF are all opaque bytes. Do not parse or execute custom configs. Equal bytes need no replacement.

Changing a pack hash changes package-export config paths. Old-only config paths receive `EDITOR_CONTEXT_RETAINED` diagnostics. Keep their actual bytes, or their observed absence, unchanged. The new root solution index refers only to the target contexts. Do not delete old contexts or old declaration packs. This is explicit retention, not an incomplete deletion proposal. Pack garbage collection and arbitrary custom config cleanup need separate scope. The caller must review replacement of custom target configs before any T4d write.

`preconditions` contains the sorted union of every original metadata path, every original content path, and every current/target config path. Every present row carries exact original byte length and raw SHA-256. Every absent config row carries only `exists:false`. Reject config/metadata/content path overlap, case collision or file/directory collision before output. Include unchanged prerequisite files and unchanged target configs. A source edit or metadata-only drift invalidates the future operation even when the replacement list is unchanged. Each replacement repeats the matching row's exact expectation.

Return all definition rows, sorted by the editor owner's key: `local:<componentId>` or `package:<packageId>:<exportId>`. Join old/new configs by that key. Definitions cannot be added or removed in this leaf. Each row contains both complete origin/owner sets, config paths, entry paths and context selection. Set `affected` if the full toolchain semantic key changes, the local source-envelope selection changes, or its config bytes change. Thus a runtime-build-only change affects every definition even when the editor config bytes are identical. When the selection is unchanged, a custom config mismatch affects that config's definition; root-only mismatch has no invented definition owner. An unused export is not omitted.

The proposal does not contain observations of the target `vendor/toolchain/<hash>` directory. T4d must acquire that complete destination inventory separately. It must verify existing pack bytes or materialize the supplied verified payload under native guards. This prerequisite cannot be represented as an assumed missing directory here. T4c candidate identity binds the pack hash; T4d's transaction binds its actual destination state. Neither old-value hashes nor a proposal's source snapshot are OS race guards.

## Deterministic identity

Use lowercase SHA-256 of exact UTF-8 or raw bytes. ASCII sort paths and definition keys. Do not use locale order. Define these rows:

```ts
fileRows = sortedFiles.map(([path, bytes]) => [path, bytes.byteLength, sha256(bytes)]);
expectRows = preconditions.map(w => w.expect.exists
  ? [w.path, w.expect.byteLength, w.expect.sha256] : [w.path, null, null]);
selectionKey = hashMetadata('lock', {schemaVersion:1, toolchain:selection, packages:{}});
definitionRows = definitions.map(d => [definitionKey(d.definition),
  d.sourceVersionBefore, d.sourceVersionAfter, d.affected]);
replacementRows = replacements.map(r => [r.kind, r.path,
  r.expect.exists ? r.expect.sha256 : null, r.bytes.byteLength, r.sha256]);
diagnosticRows = diagnostics.map(d => [d.code,d.path,d.expectedSha256,d.actualSha256]);
```

Each formula below hashes `UTF8(JSON.stringify(theDisplayedArray))`. `currentKey` and `targetKey` use the owner formula above. `originalDocumentRows`, `candidateDocumentRows`, `originalContentRows` and `candidateConfigRows` use `fileRows`. `expectRows` binds present and absent scoped config observations. The two editor-plan hashes already bind complete origins and contexts.

```text
baseHash = SHA256(['lux-toolchain-change-base',1,projectId,currentKey,
  currentPackHash,currentEditorPlanHash,originalDocumentRows,originalContentRows,expectRows])
candidateHash = SHA256(['lux-toolchain-change-candidate',1,projectId,targetKey,
  targetPackHash,targetEditorPlanHash,candidateDocumentRows,originalContentRows,candidateConfigRows])
proposalHash = SHA256(['lux-toolchain-change-proposal',1,direction,baseHash,candidateHash,
  definitionRows,replacementRows,diagnosticRows])
```

Sort replacements by path, then kind; diagnostics by path, then code. No timestamp, UUID, machine path, compiler result, installed-trust boolean or physical file token enters these pure identities. Input map insertion order cannot change them. Original metadata whitespace changes `baseHash`; candidate whitespace changes `candidateHash`. Changing only direction changes `proposalHash`. A no-op request returns stable identities and zero replacements when observed configs match. It still requires T4c for a later apply claim.

## Diagnostics and limits

Reject with one bounded `ToolchainChangeError`; return no partial candidate. Pack integrity failures retain `TOOLCHAIN_MODIFIED`. Unsupported versions, missing variants or selected entry/contract mismatch use `TOOLCHAIN_UNAVAILABLE` with the selected field/path and expected identity. Malformed pack or request shape uses `TOOLCHAIN_INVALID`. Original lock/current selection disagreement is `TOOLCHAIN_UNAVAILABLE` at `dependencies.lock.json`. Metadata relationship failures use `PROJECT_INVALID`. Preserve resolver codes for missing content, package modification, import policy, parse and asset failures. Missing target SDK diagnostics identify the exact local component or package export and required SDK, as the delivered editor API does.

For the new API, reject a syntactically valid selection whose compiler/Three versions differ from the current profile as `TOOLCHAIN_UNAVAILABLE` before pack verification. The raw existing verifier's `TOOLCHAIN_INVALID` probe is evidence of its current restriction, not the new API's unavailable-target diagnostic. A malformed version string still fails selection shape validation as `TOOLCHAIN_INVALID`.

Use `stage` to distinguish original-state refusal from target or candidate refusal. Inspect errors only after owners have consumed detached plain data. Copy only bounded known scalar fields and validated owner references. Messages have at most 240 Unicode code points. Paths have at most 240 UTF-8 bytes. Do not expose arbitrary thrown values, proxy properties, stack traces or raw project content in diagnostics. Any resource ceiling uses `QUOTA_EXCEEDED` with the bounded field and expected/actual numbers.

Export `toolchainChangeLimits` with these exact values. Preserve every narrower owner limit independently.

| Field | Value | Enforcement |
| --- | ---: | --- |
| `metadataFiles` | 59 | 3 roots + 8 scenes + 32 locals + 16 package manifests; before raw copies |
| `metadataBytes` | 1048576 | Separately for original and candidate metadata |
| `contentFiles` | 65536 | Existing resolver own-record cap; before content copies |
| `contentBytes` | 58720256 | 8 MiB authored + 16 MiB assets + 32 MiB packages; preserve individual owner budgets |
| `localSelections` | 32 | Before array capture; duplicate/unknown IDs fail even below this cap |
| `definitions` | 256 | Each editor plan; before source resolution |
| `configPaths` | 513 | Union of two plans, each at most 257 paths, with shared root |
| `observedConfigBytes` | 262144 | Per observed config; equality valid |
| `observedConfigTotalBytes` | 8388608 | Entire union, not 8 MiB per plan |
| `candidateConfigBytes` | 2097152 | Existing target editor output aggregate; individual config 65536 |
| `replacementFiles` | 290 | 1 lock + 32 components + 257 target configs |
| `replacementBytes` | 3145728 | Candidate metadata 1 MiB + target configs 2 MiB |
| `preconditions` | 66108 | 59 metadata + 65536 content + 513 configs |
| `diagnostics` | 513 | At most one mismatch or retained-context row per config path |
| `projectPathBytes` | 240 | Existing project grammar; declaration payload uses its own existing grammar |

Each pack retains 1 MiB manifest, 8192 files, 8 MiB per file, 32 MiB payload, 32 packages and 240-byte paths. Two pack inputs therefore consume at most 66 MiB before temporary owner copies. Retain pack snapshots only through planning; the returned artifact does not duplicate the distribution payload. Byte budgets count logical data even when the caller aliases arrays. Allocate output copies only after admission and count checks. Do not bypass a dominated ceiling with a new private export or relaxed fixture.

## Reachable fixtures and planning evidence

Evidence root: `C:/Users/zFlei/repos/lux/.worktrees/_coordination/LUX-79`.

Executor: `/root/toolchain_change_plan`.

Session: `6355aa30-6338-4a06-bfe8-0704dba6375e`.

E1: `owner-probes.mjs`. Exact read-only owner probe. It constructs in-memory inputs; its only write is its evidence JSON.

E2: `owner-probes.json`. Six probe groups passed at the inspected base. It records Node version, argv, exact checkout, paths and hashes. It is not installed or compiler evidence.

The existing editor test's `mixedModel()` is a metadata fixture. It changes U's manifest to `src/helper.ts` but leaves source originals from `model()`. Direct source admission correctly rejects `components/u/src/helper.ts` as `CONTENT_MISSING`. Do not copy that fixture unchanged and claim the source path ran. In the new test file, reproduce the model locally and make these explicit source corrections:

```js
delete m.files['components/u/src/main.ts'];
m.files['components/u/src/helper.ts'] = bytes(fixtureText('helper-valid'));
m.files['components/b/src/main.ts'] = bytes(
  fixtureText('entry-v1').replace('./helper.ts','../../u/src/helper.ts'));
```

Retain four locals and the `demo/mixed` old/modern package exports from `project-editor-plan.md`. Use `model`, `inputFor`, `ids`, `local`, `fixtureText`, `bytes`, `hash`, `pinFor` from `tests/project/resolver-fixtures.ts`. Keep package shared-source paths and pins unchanged. The corrected fixture has six definitions, eight original content files, seven configs per plan and nine old/new config paths when the pack changes. E2 admitted it through the real metadata and resolver owners in both build directions. It also verified exact original content hashes after planning.

Build two small real hash-consistent packs locally in the new test. Each has both SDK declaration entries, both required Three entries, inert `@types/three/package.json`, and `licenses/three/LICENSE`. Use declaration bytes `export {}; // old\n` and `export {}; // next\n` respectively. The manifest and package record field order follows T4a exactly. Compute every raw file hash and the existing pack hash formula. SDK contract hashes are synthetic `1` and `2` repeated 64 times; runtime build hashes are synthetic `8` and `9` repeated 64 times. Never use these values as installed trust.

E2 old pack: `a862a42bebcad6a94f67b620b97b49a8f8edfe62efbf1b440d06b1f7bf94f23a`.

E2 target pack: `0701b80d2495896934059d17d77c6da0aebbed887cff4a34384f33299fef6e3c`.

E2 also proves that a forbidden bare import in U's helper is rejected, dropping SDK0.1 coverage is rejected, and a pack declaring TypeScript7.0.3 is rejected. A helper with `export const start: number = "wrong";` passes source-policy admission. This last observation proves why semantic checking must remain a later T4c gate. It is not a proposal compatibility success.

## Test-first implementation steps

- [ ] Create the new test file. Import `createToolchainChangeProposal` and `toolchainChangeLimits` before implementation. Reproduce the corrected fixture and minimal packs above. Retain the missing-module/export red result. Do not alter the existing editor fixture or owner tests.
- [ ] Add exact candidate assertions. Independently construct expected lock bytes by the specified recursive serializer, preserving package pins. Compare all unchanged document/content bytes. For old-to-target and target-to-old, assert six definitions and exact config union/path transitions. Seed custom CRLF/root config bytes and old-only package config bytes. Assert exact `exists`, length and SHA rows; no deletion or source replacement is present.
- [ ] Add local SDK tests. A-only SDK change with an unchanged 0.2 helper must reject the mixed closure. Change all local nodes of a separate helper diamond together and remove package references for a valid structural SDK switch fixture. Keep authored bytes exactly equal and require `semanticCheck:'required'`. Test a sourceVersion1 downgrade with assets is refused. Test a package export requiring a dropped variant is refused with its original package/export path. Do not relabel a parser pass as SDK type compatibility.
- [ ] Add integrity and scope failures before production code: wrong current selection, wrong target hash, modified target payload, missing Three entry, wrong SDK contract, numeric version outside the current profile, SDK0.3, duplicate/unknown local ID, malformed raw metadata, extra document/content/config path, missing/modified package file and invalid unused helper import. Assert code, stage, path and expected/actual values where the owner provides them. No result object may escape.
- [ ] Implement the single sequential pipeline below. Retain bounded local capture/serialization helpers in the same new module.

```text
capture all fields -> validate selections and verify both packs
  -> admit base -> current editor plan -> base source admission
  -> construct complete candidate documents, preserving originals
  -> admit candidate -> target editor plan -> candidate source admission
  -> compare target configs and retain old contexts
  -> build complete witnesses, definition rows and replacements
  -> calculate exact identities -> publish detached copies
```

- [ ] Add mutation/error tests. Mutate inputs immediately after calling without awaiting; output must reflect the original capture. Mutate public originals, candidate and replacements independently after completion; other views must remain unchanged. Test zero getter calls, sparse arrays, symbols, hidden fields, shared/detached buffers, revoked proxies and proxies that throw hostile objects. The error must not inspect the thrown object. Test every request capture field, not only the project map.
- [ ] Add independent hash vectors and determinism tests. Reorder all input map keys; preserve bytes and hashes. Change only original lock whitespace, config existence, target build hash or direction; assert the precise affected identity. For an identical selection and matching configs, assert no replacements. For runtime-build-only change, assert all definitions affected even if every config byte is unchanged. Construct expected rows without calling production formatting/hash helpers except the established owner identity APIs.
- [ ] Exercise reachable limits and retain count proofs for dominated limits. Use one observed config of exactly 262144 bytes and then +1. Use at least 32 paths for exactly 8 MiB observations; use a 33rd byte to reach aggregate +1 while each file remains in range. Pad valid raw metadata with trailing JSON whitespace to exactly 1 MiB and +1. Use the accepted editor export fixture for 256 definitions and a 257th export refusal. Two packs with 256 exports and no locals give 513 union paths; a 514th observation is extra/over-cap and must not be treated as a valid editor path. Repeat relevant malformed pack quota tests through the new boundary. Show why 290 replacements and 66108 preconditions are derived safety caps and may be dominated by admitted metadata/content quotas. Keep the existing 32-file/1-MiB closure, 8-MiB authored, 16-MiB assets and 32-MiB package tests in the owner suite. Do not claim every combined maximum can occur in one valid project.
- [ ] Run the commands below with existing dependencies. The source worker records exact argv, exit status, Node version, base/source SHA and raw logs. TypeScript checks here validate the Lux source change; they do not execute a proposed installed target compiler. Run no pack builder or compiler semantic fixture for this pure leaf.

```powershell
& 'C:/Program Files/nodejs/node.exe' --test tests/project/toolchain-change.test.mjs
& 'C:/Program Files/nodejs/node.exe' scripts/test-project-cpu.mjs
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/zFlei/repos/lux/node_modules/typescript/bin/tsc' --noEmit
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/zFlei/repos/lux/node_modules/typescript/bin/tsc' -p tsconfig.examples-v2.json --noEmit
```

- [ ] Self-review all raw-byte, identity, closure, quota and trust claims against this document. Commit exactly the two source/test files. Submit the full source SHA and criterion evidence. Root assigns a fresh independent review and performs a separate serial integration. Report any prerequisite change outside the two files before editing it.

## Evidence contract and remaining acceptance

| Criterion | Setup, executor and stage | Required observation and provenance |
| --- | --- | --- |
| This executable plan | LUX-79 spec2; exact inspected owner base; planner followed by fresh independent plan reviewer | One coherent first leaf, complete later numeric/SDK upgrade scope, concrete interfaces and target-profile prerequisite. E1/E2 attest only CPU owner feasibility. Source commit identifies this document. |
| Original preservation and complete candidates | Fresh T4b2 worker; corrected actual source fixture; raw CRLF/whitespace/custom config snapshots | Independent byte/hash comparisons for all originals and complete candidate docs/content/configs. Expected changed lock/component fields only. Exact source commit, session, commands and raw assertions. |
| Target and source closure | Both byte-consistent supplied packs/selections, full current and candidate originals, unused definitions and mixed package contexts | Current/target pack refusals and resolver failure codes/paths. No source rewrite. Runtime hash is carried, not authenticated. Type mismatch observation remains semantically unchecked. |
| Full affected set and old-value guards | Six-context fixture and runtime-only/no-op variants; confirmed missing/present observations of the whole config union | Complete sorted before/after rows and prerequisites, including unchanged sources/manifests. Old-only contexts retained. Exact replacement expectations. A hash guard is never reported as a native guard. |
| Determinism and bounded hostile input | Worker and independent reviewer; independently constructed rows; reachable boundary fixtures and count proofs | Stable identity vectors, separated view mutations, zero getter/coercion side effects, bounded errors, meaningful equality/+1 observations. No fabricated combined-boundary success. |
| Source acceptance and main integration | Fresh independent source reviewer; then root at its exact landed SHA | Focused tests, full project CPU suite and both real source type configurations. Compare accepted file hashes with landed files. Keep source review separate from integration evidence. |
| Numeric version enablement | Separate target-profile worker/review; exact new supported profile and target pack | Builder/verifier/editor owner changes, exhaustive declaration closure and paired SDK semantics at that profile. Until available, numeric version changes remain explicitly unavailable. |
| Trusted compatibility and apply | T4c authenticated installed closure plus exact candidate; T4d physical snapshot, request scope, revision, buffer/Git state and file tokens | Actual semantic check receipt binds candidate hash and target authority. Immediately reacquire all prerequisites/destinations before committing. Reject missing/present transitions, same-byte identity changes, symlinks, source/lock/toolchain drift and buffer changes. No partial commit on conflict. |
| Full offline/editor product | Preprovisioned isolated Windows host; network disabled; no checkout, ancestor/global dependencies or uncontrolled editor plugins | Actual editor diagnostics/completion/navigation for both SDK contexts; trusted CLI success/negative fixtures; hostile project config/scripts ignored; explicit upgrade and downgrade preserve originals; cold restart works without registry or Studio. Preserve all inventory, provenance and numerical gates from the earlier plans. This leaf leaves this criterion incomplete. |

T4c retains the complete installed closure from the offline plan: Node/notices, native TypeScript executable/libs, Babel, Zod, worker/policy helpers, supervisor, SDK/runtime parameter code, unconditional asset decoder dependencies and Three runtime hashes. Its review must define runtime build identity and source diagnostic mapping. A declaration pack alone cannot replace that closure. T4d retains explicit project-scoped repair, discovery distinctions, version guards, user choice of custom config replacement and skill reinstall/check when product behavior ships. No earlier requirement is discharged by a pure proposal or this document.

T4c must check every affected definition under its declared SDK, including unused exports and helpers. The current public `resolveProject` selects a scene; it is not a public all-definition compiler-source enumeration API. T4c's separate adapter review must settle that precise bridge without reaching into the resolver's private snapshot or silently checking scenes only. This is a later checker-interface prerequisite. T4b2 uses the already reachable all-definition source-policy admission and makes no compiler-source enumeration claim.
