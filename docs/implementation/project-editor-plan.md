# Project editor byte planning — T4b

> For the fresh implementation worker: use conductor-worker and superpowers:executing-plans for the assigned leaf. Root alone dispatches fresh review and implementation contexts. This plan is preparation, not execution of T4c/T4d or the stopped LUX-7 acquisition lane.

**Goal:** produce deterministic per-definition TypeScript editor configuration bytes and a bounded explicit replacement proposal while preserving all observed custom bytes. **Source inspected:** `b02622d23576ffb9376ce7ee853eee5e7f1c248b`; LUX-50 specification 2. **Prerequisite:** independently accepted T4a source `ed474e61c853cbbfbb8f71f1bc4b8976cc8a7dc9`, integrated by LUX-45. This document requires independent review before its implementation leaf is dispatched.

**Authority and non-goals:** all four roadmap workstreams are authorized; this leaf only extends pure tooling. It performs no filesystem read/write, compiler execution, editor launch, installed-distribution attestation, CLI/service behavior, source rewrite, native acquisition, network/install, Studio/graphics, public SDK addition, or portal operation. Exact raw configuration planning is useful before those later adapters exist. T4b2 pure upgrade proposals, T4c trusted installed checker and T4d explicit guarded materialization plus real offline/editor acceptance remain separately reviewed gates in [offline-tooling-plan.md](offline-tooling-plan.md).

## Existing owners and the chosen boundary

`packages/core/src/project/contracts.ts` owns ProjectMetadata, DependencyLock, raw-document admission, package pins and the complete definition/reference graph. It accepts both public SDKs but rejects a reference closure mixing them, including an unused helper or export. It validates all local definitions and package exports, not only scenes. Project registries provide actual nonoverlapping local directories. Package origins are `libraries/<pin.contentHash>/<declared-file>`; an export key is not a source directory. Package exports of different SDKs may legally share the same physical helper file.

`resolver.ts` owns actual source/package/asset byte admission, import-policy checks, immutable snapshots, complete scene origins and diagnostic mapping. Its snapshot is a private WeakMap token; the planner must not introspect it, copy its compiler role, or pretend metadata proves source availability. `library.ts` verifies actual package bytes. `tooling.ts` verifies a declaration pack against a supplied expected identity; its structural VerifiedDeclarationPack type and mutable Uint8Array contents are not authority. `apps/build-worker/src/worker.mjs` owns the trusted compile configuration and SDK projection. `packages/visual-sdk/src/index.ts`, `sdk-v2.ts`, `metadata.mjs`, and runtime-contracts parameter declarations/implementation are SDK owners; discover the selected file names in worker.mjs when checking parity. Do not edit these owners for T4b.

The selected approach keeps nearest configs for local components and creates one external config per package export, referencing original package source paths. This avoids adding editor files to content-addressed immutable package/pack inventories. A single global SDK alias cannot describe mixed SDKs; a config written inside each package cannot represent overlapping exports reliably. No copied source mirror is introduced, so relative imports and go-to-definition origins remain original paths.

## T4b1: one implementation leaf, two exact files

Modify only `packages/core/src/project/tooling.ts`; create only `tests/project/tooling-config.test.mjs`. Existing `scripts/test-project-cpu.mjs` discovers the new test. Keep every T4a public signature, verifier/hash rule and builder unchanged. No barrel, package script, resolver export, product skill, compiler or service change is required for this internal pure API. If a necessary change escapes these two files, report the prerequisite to root before doing it.

```ts
// All new types below are exported from tooling.ts. Existing types are imported
// from contracts.ts; ComponentRef identifies local IDs or package/export pairs.
type EditorFile = Readonly<{ path: string; bytes: Uint8Array; sha256: string }>;
type EditorOrigin = Readonly<{ projectPath: string; owners: readonly ComponentRef[] }>;
type DefinitionEditorConfig = Readonly<{
  definition: ComponentRef; sdkVersion: '0.1.0'|'0.2.0'; configPath: string;
  entryPath: string; origins: readonly EditorOrigin[];
  selection: 'nearest-local'|'explicit-package-context';
}>;
declare const editorPlanBrand: unique symbol;
type ProjectEditorPlan = Readonly<{
  [editorPlanBrand]: true; version: 1; projectId: string;
  toolchain: DependencyLock['toolchain']; files: readonly EditorFile[];
  definitionConfigs: readonly DefinitionEditorConfig[]; planHash: string;
}>;
type EditorObservation = Readonly<Record<string, Uint8Array>>;
type EditorConfigMismatch = Readonly<{
  code: 'EDITOR_CONFIG_MISMATCH'; path: string;
  expectedSha256: string; actualSha256: string|null;
}>;
type EditorReplacement = Readonly<{
  path: string; expect: Readonly<{ exists: false }>|Readonly<{exists: true; sha256: string}>;
  bytes: Uint8Array; sha256: string;
}>;
type EditorRepairProposal = Readonly<{
  version: 1; planHash: string; proposalHash: string;
  desiredToolchain: DependencyLock['toolchain'];
  diagnostics: readonly EditorConfigMismatch[]; replacements: readonly EditorReplacement[];
}>;
export function createProjectEditorPlan(metadata: ProjectMetadata,
  pack: VerifiedDeclarationPack,
  suppliedToolchain: DependencyLock['toolchain']): Promise<ProjectEditorPlan>;
export function compareProjectEditorFiles(plan: ProjectEditorPlan,
  observed: EditorObservation): Promise<EditorRepairProposal>;
export const editorLimits: Readonly<{
  definitions: 256; configFiles: 257; configBytes: 65536;
  totalConfigBytes: 2097152; originRows: 8192; traversalSteps: 65536;
  observedFileBytes: 262144; observedTotalBytes: 8388608;
  projectPathBytes: 240; relativePathBytes: 1024;
}>;
```

These names describe planned behavior, not existing exports. Files contains only generated JSON configs, not a duplicate declaration payload or lock mutation. The already verified pack is separately materialized by T4d. The proposal is a config-only repair for the currently supported selection. Actual upgrade/downgrade proposals that change lock/manifests require the separately reviewed T4b2 pure proposal leaf below; T4d executes them only through its guarded writer. This API must not silently generate or apply them. T4b1 acceptance alone does not finish T4b or unblock T4c.

## Admission and identity before planning

1. Synchronously capture every input before the first await. Use own-data descriptor inspection, rejecting accessors without invoking them, inherited/symbol/nonenumerable fields, sparse arrays, cycles and extra/missing fields. Capture suppliedToolchain and all metadata through existing bounded JSON conventions. Metadata must have exactly project/scenes/components/assets/lock/packages. Root maps must exactly match registered IDs and pinned package IDs; no extra unmanaged definition can be silently ignored. Freeze detached data, never caller objects.
2. Reconstruct the original *logical* raw-document mapping from that snapshot: project.json, assets/manifest.json, dependencies.lock.json, registered scene/component JSON, and each pinned libraries/<hash>/package.json. Encode with JSON.stringify and check aggregate <=1 MiB before calling `admitProjectMetadata(documents, suppliedToolchain)`. This is fresh relationship validation of semantic metadata, not preservation or attestation of original raw metadata bytes. Reject mismatched metadata map keys/embedded IDs rather than selecting an arbitrary owner. Carry admitted data forward; do not rely on a caller's TypeScript annotation or claimed admission boolean.
3. Snapshot pack manifest own data and each payload's actual intrinsic byte length before awaiting. Re-encode its bounded manifest and call existing `verifyDeclarationPack` with the snapshot and **suppliedToolchain.declarationPackHash**. Existing 8192 file/32 MiB payload limits apply before copies/hashes. Reverification is necessary because a public VerifiedDeclarationPack may be forged or its byte arrays mutated. Never use lock.toolchain as a fallback expected identity. All metadata, supplied selection and pack inputs must already be captured when asynchronous digesting begins.
4. Require exact lock selection equality to the supplied selection through admission, then compare pack Typescript/Three/Three-types versions and every selected SDK declarationEntry/contractHash with the supplied selection. Supplied selection may select a nonempty subset of the pack's two public variants; every definition must be supported. Require the verified file inventory to contain the selected SDK declarations and fixed Three entries `node_modules/@types/three/build/three.webgpu.d.ts` and `three.tsl.d.ts`. Require those fixed entries to be covered by `@types/three@0.186.0` package identity. No invented SDK 0.3, runtimeBuildHash or automatic version coercion. RuntimeBuildHash is carried through exact equality but is not attested by a declaration pack.
5. Missing or inconsistent selected SDK/version/entry records fail before output with `TOOLCHAIN_UNAVAILABLE` and exact expected selection/path; modified payload/pack identity remains `TOOLCHAIN_MODIFIED`. Invalid shapes use `TOOLCHAIN_INVALID`; metadata relationship failures use `PROJECT_INVALID`; ceilings use `QUOTA_EXCEEDED`. Attach bounded path plus expected/actual scalar identities when applicable. Do not reinterpret an unavailable installed distribution as project corruption. Since no source bytes are consumed here, missing package source and modified package source remain the resolver's `DEPENDENCY_UNAVAILABLE`/`PACKAGE_MODIFIED`, not diagnoses this metadata-only planner fabricates.

The name suppliedToolchain denotes caller responsibility, not a verified installed token. Tests use explicitly synthetic selections. An attacker able to fabricate *both* the project and supplied selection can pass a pure equality/integrity check; this function cannot establish installation trust. T4c must derive the supplied selection from its independently verified installed distribution. Neither a self-consistent project lock nor a successful pure test proves that setup.

## Complete definitions, closures, origins and bounds

Enumerate all local definitions and every pinned package export, including unused definitions and package-only scenes. Count before creating configs; at most 256 total definitions and therefore 257 total config files. Preserve existing metadata/project limits independently: 32 locals, 8 scenes, 16 packages, 32 files per compiler closure and source quotas owned by the resolver. The new editor count cap is explicit and can reject metadata otherwise admitted by v1; do not silently omit overflow exports.

Build keys as `local:<componentId>` and `package:<packageId>:<exportId>`. Sort them with ASCII lexical comparison (`a < b`, no locale-dependent ordering). For each root, visit its transitive declared references with active/done sets; count each visited node and examined reference against an aggregate 65,536-step budget across all roots, rejecting before the next step. Deduplicate physical project paths, not ownership rows, within a closure. An origin's owners are every reachable definition declaring that file, deduplicated and sorted by the same key. Origin rows are sorted by projectPath; count each per-config path row against the aggregate 8192 bound before allocation. An unrelated export that shares a package file is not an owner in this root's closure. Validate all root/target existence, SDK consistency, path/case collisions and cycles via admission; planner traversal also has these bounded guards.

Files are all declared `.ts` files of reachable definitions, including unimported files and helpers. Do not use globs, scene selection, entry-only enumeration, package-wide inventories or a compiler tree-shaken subset. Package LICENSE/assets/unexported inventory files do not enter a definition's config. These origins attest metadata membership only; they do not attest actual bytes, semantic validity or authored import policy.

Local config path: `<project.components[id]>/tsconfig.json`. Package config path: `vendor/editor/<declarationPackHash>/packages/<contentHash>/<exportId>/tsconfig.json`. No file goes inside libraries/<hash> or vendor/toolchain/<hash>. Generated project paths use existing metadata path grammar/case rules and <=240 bytes. Relative paths are computed only between those already validated project paths, using lexical POSIX segments. For same-directory descendants emit `src/main.ts` (no redundant prefix); preserve necessary `../` segments, slash separators and exact case. Relative paths are <=1024 UTF-8 bytes and must resolve lexically to the intended confined project target. Never accept an absolute, drive, UNC or caller-supplied relative traversal as a base.

Package contexts are explicit selections: the same helper may belong to SDK0.1 and SDK0.2 projects. The planner reports both contexts; it cannot promise which context an editor chooses when that helper is opened alone. It supplies package-only scene configs even with no local components. Future editor smoke tests must select each context and prove diagnostics/navigation. No symlink, source mirror or automatic editor plugin resolves this ambiguity here.

## Exact configuration and raw hashes

Each definition config has **exactly** this field construction order; there is no extends, include, exclude, references, composite, baseUrl, plugin or project executable selection. JSON uses two-space indentation, LF, one trailing LF, UTF-8 without BOM. `files` consists of sorted relative paths computed from the full origin set; the origin rows themselves retain project-root paths.

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "types": [],
    "lib": ["ES2023", "DOM"],
    "skipLibCheck": false,
    "paths": {
      "@lux/visual-sdk": ["<relative verified selected SDK entry>"],
      "three/webgpu": ["<relative fixed verified Three webgpu entry>"],
      "three/tsl": ["<relative fixed verified Three tsl entry>"]
    }
  },
  "files": ["<sorted exact relative source closure>"]
}
```

The JSON above displays values compactly; normative bytes are `JSON.stringify(constructedObject, null, 2) + '\n'`, which expands nonempty arrays onto multiple lines. Prefix each selected declaration entry with `vendor/toolchain/<packHash>/` before computing paths. The SDK entry comes from the verified selection; fixed current pack entries are sdk/0.1.0/index.d.ts and sdk/0.2.0/index.d.ts. Do not use test fixtures' old sdk/index.d.ts paths when referring to the actual T4a pack. `skipLibCheck:false` makes the editor configuration exercise declaration semantics, while the current trusted worker uses true; matching shared target/module/strict settings is not a claim of byte-identical compiler options. Editor lib directives select its TypeScript engine's standard libraries; copying pinned libs into the pack does not make an arbitrary editor engine use them. T4c's compiler version remains separate.

Root `tsconfig.json` is exactly `{files:[], references:[{path: configPath}, ...]}` in that property order, with references sorted by configPath and the same JSON/LF encoding. It has no global SDK alias. It references every local and package-export config. Zero definitions yields files:[] and references:[]. This is a solution navigation index; `tsc --build` is neither a supported command nor an acceptance test for these noEmit, non-composite projects. Raw `tsc -p` on one context may validate an editor fixture later; it never becomes trusted project source-policy checking.

For every output, `sha256 = SHA256(exact UTF8 bytes)` lowercase hex; whitespace, BOM and line endings matter. Sort files by path. Plan identity is SHA256 of UTF8 JSON.stringify of `['lux-project-editor-plan',1,projectId,toolchainKey,definitionRows,fileRows]`, where toolchainKey is `hashMetadata('lock',{schemaVersion:1,toolchain:suppliedToolchain,packages:{}})`, definitionRows are `[definitionKey,sdkVersion,configPath,entryPath,selection,originRows]`, originRows are `[projectPath,sortedOwnerKeys]`, and fileRows are `[path,byteLength,sha256]`. All rows use stated ASCII ordering. This binds origins and runtime selection as well as raw output, but is not a project revision, file-version token, source hash or installed attestation.

Preflight output count, all path lengths and bounded constructed JSON size before publishing or hashing complete output. Each config <=64 KiB; aggregate <=2 MiB. Equality passes, +1 fails with no partial plan. Retain private byte copies in a module-local WeakMap keyed by the returned plan object; comparison requires this issued object. Public bytes are separate copies and may be edited by the caller, without changing the private expected plan. Freeze JSON records/arrays only; do not claim Uint8Array contents are frozen. Reject cloned/forged plan tokens with `TOOLCHAIN_INVALID` in comparison.

## Mismatch proposals preserve edits

`observed` is a caller-provided snapshot of only planned config paths. Absence of a key means the file was observed missing, never unreadable or omitted for convenience; the future adapter must abort acquisition errors before calling. Present values are raw bytes, not parsed JSON. Extra keys reject as `TOOLCHAIN_INVALID`; caller retains unrelated custom files outside this bounded view. Preflight descriptors, count<=257, per-file<=256 KiB and aggregate<=8 MiB plus intrinsic Uint8Array storage (no shared/detached buffers) before copying/hashing. An oversized custom config produces a quota error and remains untouched, not a truncated proposal. All copies are taken synchronously before first await.

For each planned path in sorted order, compute raw actual SHA256 or null for absence. Exact byte equality produces no diagnostic or replacement. Any other bytes—including equivalent JSON indentation, comments, CRLF or a plugin field—produce one EDITOR_CONFIG_MISMATCH with expected/actual hashes and one complete replacement containing a defensive copy of expected bytes. No custom bytes are parsed or executed. `expect` is exists:false for absence, or exists:true and the observed raw hash for a present file. Replacement hash is the expected raw hash; no deletions, source/lock/package writes or partial text merges are proposed. Return at most 257 diagnostics/replacements and <=2 MiB replacement bytes; no unbounded text diff is necessary.

proposalHash is SHA256 of UTF8 JSON.stringify of `['lux-editor-repair-proposal',1,planHash,rows]`, with sorted rows `[path,actualSha256OrNull,expectedSha256]` for mismatches only. An empty result still has a deterministic identity. desiredToolchain is the detached plan selection; mutation of observations, public plan bytes or returned proposal bytes cannot alter subsequent results. Returned replacements contain copies; they are a review artifact, not writer authority.

T4b2 must first settle and independently review a pure project-scope upgrade/downgrade proposal contract, using raw original lock/manifest bytes and hashes plus separately supplied supported target selection. It must return exact proposed lock/manifest/config bytes and the complete affected-definition set, carry per-file old existence/raw-hash expectations, preserve every authored source byte and refuse incompatible source/SDK closures. It needs target-pack verification and trusted-candidate checking through the separately reviewed T4c adapter before any T4d apply; proposal generation itself must not wait circularly on installed checking. T4c implementation may begin after both pure T4b leaves are accepted, while actual candidate validation is its own execution gate. Exact files and the target identity selection contract require that fresh leaf review; this document authorizes only T4b1 implementation. Config repair at the current selection has no lock changes, and T4b1 reports none.

T4d must independently bind an approved proposal to canonical physical project identity, complete metadata/lock/config snapshot and project revision, current installed selection, authenticated request/scope and dirty-buffer/Git conflict state. Immediately before a guarded commit it must reacquire and compare existence, raw hashes and native file-version/identity tokens for every affected path and all proposal prerequisites. Missing-to-present, present-to-missing, replacement-by-symlink, same-byte different file identity, source/lock/toolchain drift or dirty-buffer change must abort. A hash-only record here is not an OS race guard. Explicit upgrade/downgrade must propose lock/manifest/config changes together under project scope, preserve raw originals and run the T4c trusted checker against the complete resulting candidate; incompatible sources fail rather than being rewritten. Those commands/writers are absent from this leaf and cannot retry LUX-7.

## Concrete fixtures and independent planning feasibility

Use existing `tests/project/resolver-fixtures.ts` model/inputFor/ids/local/fixtureText/bytes/hash/pinFor as the fixture foundation; all fixture hashes are synthetic, not installed trust. Retained planning evidence is MAIN `.worktrees/_coordination/LUX-50/{feasibility.mjs,feasibility.json,fixture-input.json,show-config.log,configuration-vectors.mjs,configuration-vectors.json}`. The script is throwaway test evidence, not an implementation. At the inspected SHA it successfully admitted metadata and source snapshots, rejected the cross-SDK helper mutation, and ran only the pinned TS7 `--showConfig` mode (no typechecking, editor or offline claim). The separate configuration-vectors script independently enumerated all six definition configurations, checked each relative source target against its exact original path, and ran --showConfig successfully for all six. The root index vector is 672 bytes; no build-mode result is claimed.

Construct four local definitions from model(): A=`components/a` and H=`components/helper` remain SDK0.2; B=`components/b` and U=`components/u` become SDK0.1/sourceVersion1. U's entry/files is src/helper.ts with helper-valid text; B references U and its entry-v1 text imports ../../u/src/helper.ts. A retains H and additionally references package demo/mixed export modern. The package is version1.2.3/range `0.1.0 || 0.2.0`, exports old={SDK0.1/sourceVersion1, entry src/old.ts, files [src/old.ts,src/shared.ts]} and modern={SDK0.2/sourceVersion2, entry src/modern.ts, files [src/modern.ts,src/shared.ts]}; both references/assets are empty. Entries use entry-v1/entry-v2 with './helper.ts' replaced by './shared.ts'; shared.ts is helper-valid; LICENSE.txt is UTF8 `Fixture only\n`. Hash every exact LF-normalized source and license with existing fixture hash; pinFor yields package content hash `2875931077728a7b32459498550e4e7ff2f23cfca70bed9fb2e4bdbde0aada5f`. Scene C directly uses package old. Keep the existing three scenes' valid controls/settings. A's closure has exactly its main, H's helper, package modern and shared; B has exactly its main and U's helper; scene C has exactly package old and shared. A package helper therefore has separate old/modern context rows without an invented global SDK.

For config byte-vector testing only, use pack identity `a` repeated64 and selected entry sdk/0.2.0/index.d.ts. This vector tests formatting/path arithmetic independently of actual pack admission; **it is not a claim that an arbitrary pack hashes to all-a**. The independently constructed A config is exactly 1088 bytes with SHA256 `7bd04405d5fc6a0af0f100922e683387ab28d7103514504d7a966591b6e245af`. Its sorted files array is:

```json
[
  "../../libraries/2875931077728a7b32459498550e4e7ff2f23cfca70bed9fb2e4bdbde0aada5f/src/modern.ts",
  "../../libraries/2875931077728a7b32459498550e4e7ff2f23cfca70bed9fb2e4bdbde0aada5f/src/shared.ts",
  "../helper/src/helper.ts",
  "src/main.ts"
]
```

The first declaration path is `../../vendor/toolchain/` + 64 a's + `/sdk/0.2.0/index.d.ts`; both Three paths use the same prefix plus the fixed entries above. Do not force this synthetic hash into a valid pack end-to-end test. The implementation test must build a small real hash-consistent pack in the same new test file using the T4a canonical manifest formula, both SDK declarations, the two Three entry files, inert package.json and LICENSE, with actual payload hashes. Use that computed pack hash to fill the exact expected config template and compare bytes, all relative targets and independently computed hashes. Wrong expected hash, forged VerifiedDeclarationPack and mutated payload tests must reject. No dependency install or full pack builder is required for this pure test.

## Test-first steps and evidence contract

- [ ] Add fixture construction and explicit expected config objects in the new test file before adding exports. Import Node assert/test plus createProjectEditorPlan/compareProjectEditorFiles and existing admission/pack helpers. Run `node --test tests/project/tooling-config.test.mjs`; retain the missing-export failure. Expected template construction must not call any planner formatting/path helper.
- [ ] Write positive assertions over exact bytes, origin owner sets and per-context paths for the four-local/two-export fixture, package-only project with no locals, empty project, a legal same-SDK shared helper diamond, nested registered component paths and unused export inclusion. Use `assert.deepEqual(plan.definitionConfigs.find(c=>c.definition.kind==='local' && c.definition.componentId===ids.A).origins.map(o=>o.projectPath), expectedAPaths)` with the four explicit project-root paths above; assert root has six references and no compilerOptions. Assert the package old and modern configs remain outside immutable inventories and select different SDK entries while preserving shared.ts's original path.
- [ ] Before production changes, encode meaningful negatives: B→H mixed-SDK reference; forged metadata extra definition or changed pin; local path collision; unsupported SDK0.3; missing selected variant/Three entry; supplied-vs-lock runtimeBuildHash disagreement; forged/modified pack; closure graph cycle. Assert exact rejection codes/paths for planner-owned failures, preserve admission context for metadata failures. A self-consistent synthetic caller selection is explicitly allowed and is not an installed-authority test.
- [ ] Implement only bounded snapshot/revalidation, closure enumeration, relative path construction, deterministic config/hash construction and private issued-plan storage. Test input mutation immediately after Promise creation cannot change results. No source content/parser/compiler or filesystem import enters tooling.ts.
- [ ] Add comparison behavior tests before implementation: identical bytes return no rows; missing root returns expect.exists:false; custom config with comments/plugin marker, same semantic JSON with CRLF, and empty bytes each return correct exact actual hashes and expected replacements while preserving original arrays. Alter observed bytes immediately after call and public plan bytes before comparison; the result must use private expected bytes and captured actual bytes. Reject a spread-cloned plan, extra observation key, accessors with zero getter calls, sparse metadata arrays, SharedArrayBuffer and detached typed arrays.
- [ ] Exercise every new numeric bound at equality and +1 with meaningful setup. Definitions256/257 and observed256KiB/aggregate8MiB have direct public fixtures. Other maxima may be dominated by tighter metadata/closure limits: configs257 derives from definitions256 plus root, and originRows8193 cannot pass both definitions256 and closureFiles32. Retain a concrete accounting/proof artifact for dominated limits and exercise the first reachable public rejection; do not export a bypass, weaken metadata, or fabricate an end-to-end +1 result. Generate dense reference cases for the traversal budget and record the exact number of examined nodes/edges independently. Config64KiB/aggregate2MiB checks remain publication defenses; if a valid construction cannot reach a ceiling under tighter path/closure limits, explicitly record that fact and review the bound before publication. Assert no partial plan/proposal escapes on every reachable failure.
- [ ] Run `node --test tests/project/tooling-config.test.mjs`, `node scripts/test-project-cpu.mjs`, main absolute `node_modules/typescript/bin/tsc --noEmit` and `-p tsconfig.examples-v2.json --noEmit` from the isolated checkout. Record exact argv, versions and full source SHA. No need to rebuild the unchanged T4a compiler pack for this pure leaf; repeat its existing pure tests through the project runner.
- [ ] Self-review snapshot ordering, quota checks, output/path hashes, graph completeness, custom-byte preservation and absence of source-policy/installed authority claims; commit exactly the two files and submit for fresh independent review. Root performs separate serial integration with source hash comparison and focused checks.

| Criterion | Preconditions, method, executor and stage | Required observation/provenance |
| --- | --- | --- |
| Reviewed executable plan | Root and independent planner reviewer inspect this exact plan commit, ticket spec2 and accepted T4a; no implementation participation by reviewer | All scope/identity/config/context decisions are concrete; significant findings disposed before dispatch. Planning feasibility raw artifacts attest only the stated metadata/resolver and showConfig observations. |
| Metadata/pack separation | Fresh source worker at recorded baseline, valid synthetic fixtures plus independent supplied selection and byte-consistent minimal pack | Exact snapshot/revalidation failures, expected vs actual identity/path evidence; modified arrays/forged handles cannot alter private expected bytes. No installed assertion without T4c setup. |
| Full config coverage | Mixed-SDK local/helper/package-only and unused-export fixtures using actual contracts and original paths | Exact independently expected config bytes/hashes, complete per-definition origin rows, no global alias, all six fixture references, no immutable package additions. Reviewer repeats a shared physical helper in both SDK contexts. |
| Diagnostics/repair preservation | Captured config byte arrays, exact missing observations, custom raw JSON/comments/CRLF and race mutations | Correct mismatch codes and raw hashes, complete bounded replacements, unchanged caller bytes, no filesystem effects; cloned plan rejected and public-byte tampering cannot change expectations. |
| Bounded data | Real reachable boundary fixtures plus independent count proofs for limits dominated by earlier constraints | Reachable equality/+1 logs, no getters/copied overflow/partial output, retained originals and precise quota error; count proofs identify impossible combined maxima without claiming public end-to-end cases. |
| Main integration | Independently accepted source SHA then root's exact landed SHA and file-hash comparison | Focused pure tests/project runner and both TS configurations pass at landed SHA; distinct source review and ordinary integration evidence. |
| Remaining product behavior | T4c verified installed checker; T4d guarded acquisition/writer, explicit project-scope repair and isolated preprovisioned Windows host/editor | This leaf leaves these criteria incomplete: real diagnostics/completion/navigation for both contexts, trusted check ignores hostile project configuration, offline cold restart with no mounted checkout/ancestor dependencies or network, upgrade/downgrade preservation and actual file-version conflict guards. No successful pure command substitutes for these setups. |
