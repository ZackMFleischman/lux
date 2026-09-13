# Offline Project Coding Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans for the assigned leaf. The coordinator dispatches fresh workers and independent reviewers; this document does not authorize a second team.

**Goal:** let an ordinary editor resolve exact Lux SDK and Three types from project-local bytes, and let the installed CLI check the same project offline with trusted tooling.

**Architecture:** a deterministic, non-executable declaration pack is produced by the Lux distribution build. Pure project tooling plans editor files and compares their bytes; later installed adapters safely materialize the pack and invoke the existing isolated compiler against an admitted immutable source snapshot. Project configuration remains editor intent, never compiler authority.

**Tech Stack:** Node 24.12.0, TypeScript 7.0.2 native Windows x64 compiler, Three and @types/three 0.186.0, current SDK 0.1.0/0.2.0, existing pure metadata/resolver and Windows Job Object compiler.

**Spec:** [filesystem Slice 4](filesystem-projects-plan.md#slice-4-offline-coding-environment-kit), [ordinary editor architecture](../design/filesystem-projects.md#ordinary-editor-types-and-validation), [accepted metadata](../design/filesystem-project-metadata-v1.md), [resolver plan](project-resolver-plan.md). LUX-25 specification 2; inspected source baseline `f1bbe51a42506dc94ff0e03c7fb8806065a9d705`.

**Planning revision 2:** root incorporates both P2 findings from the independent review of `383015021792b19ab351bff0da4a3bf696d8c787`: exhaustive shipped-declaration resolution and paired emitted/trusted SDK semantic fixtures. The first leaf and later product gates retain their scope.

## Global constraints

- Public filesystem project v1 supports exactly `0.1.0` and `0.2.0`. C02's internal compiler `0.3.0` is excluded even though `sourceSdkVersionSchema` accepts it internally.
- Preserve metadata limits: 1 MiB aggregate metadata; 32 components; 8 scenes; 256 authored files/8 MiB; 16 packages/32 MiB; each compiler closure 32 files/1 MiB source. Toolchain declarations are a separately bounded distribution payload, not authored files or package source quota.
- Allowed authored bare imports remain `@lux/visual-sdk`, `three/webgpu`, `three/tsl`; declared relative `.ts` imports still pass the resolver. Declaration-internal packages do not become authored import capabilities.
- No install hooks, project executables/plugins, automatic network fetch, project `NODE_PATH`, or arbitrary package exports enter the trusted compile path. Open never installs, repairs pins, or overwrites custom editor configuration.
- Native project file acquisition remains a separate blocked lane (LUX-7); no leaf here retries it or substitutes a renamed native acquisition implementation. No graphics, Studio/Resolume activation, portal work, registry download, or dependency installation belongs to this plan's first leaf.
- Root serializes integrations and shared build inventory changes. Acceptance of a declaration pack does not establish a working directory-project service or installed offline product.

## Inspected reality and provenance

`apps/build-worker/src/worker.mjs:74` projects selected SDK source into `types/sdk.ts`, rewrites runtime-contract paths, copies the current Zod-backed `index.ts` into `types/shared.ts`, and adds `parameters.d.ts` for SDK 0.2. It creates its own ES2023/DOM, ESNext/Bundler, strict configuration and runs the native compiler located by `typescript/lib/getExePath.js`. It then inventories actual external declarations with `--listFilesOnly`. This is a useful authoritative projection, but is currently backed by checkout paths and installed dependency bytes, not a redistributable project type kit.

`getExePath.js` resolves `@typescript/typescript-win32-x64@7.0.2/lib/tsc.exe`; standard libraries are in that platform package. There is no old `typescript/lib/tsc.js` runtime assumption. `tsconfig.build.json` emits declarations under `dist`, but its repository-wide output is not a self-contained author kit. `tools/gpu-spike/build.mjs` emits render-host resources; `apps/studio/build.mjs` emits Studio bundles. Neither builds this kit. The previously suggested `scripts/build-runtime.mjs` and `tools/gpu-spike/runtime-package.mjs` do not exist at this baseline.

Planning investigation used existing dependencies only. A nonexecuted type probe importing both supported Three entrypoints plus SDK 0.2 was enumerated by the actual native compiler: **594 files / 4,433,739 bytes**, comprising 513 Three declarations, 62 TypeScript libraries, 14 Zod declarations, one WebXR declaration, and four generated probe/projection files. This is the probe's reached closure, not proof of the complete proposed pack or typecheck success. Prior resolver positives had no Three imports and therefore did not attest Three closure.

Raw investigation is retained relative to the planning checkout in `.worktrees/_coordination/LUX-25/{inventory.mjs,inventory.json,list-files.log,tsconfig.json,probe.ts,types/}`. `inventory.json` records source baseline, executable hash, Node version, exact argv, status, individual file hashes, package metadata and physical paths. Fresh pack builders must derive their own output manifest; these development paths must never appear in shipped files.

| Installed input | Exact version | Required notice inventory |
| --- | --- | --- |
| typescript and @typescript/typescript-win32-x64 | 7.0.2 | Apache-2.0; each package LICENSE and NOTICE.txt |
| three / @types/three | 0.186.0 / 0.186.0 | MIT; each LICENSE |
| zod | 3.25.76 | MIT; LICENSE |
| @dimforge/rapier3d-compat | 0.12.0 | Apache-2.0; LICENSE |
| @tweenjs/tween.js | 23.1.3 | MIT; LICENSE |
| @types/stats.js / @types/webxr | 0.17.4 / 0.5.24 | MIT; each LICENSE |
| fflate reached through @types/three | 0.8.3 | MIT; LICENSE |
| meshoptimizer | 1.1.1 | MIT; LICENSE.md |

The last six entries are declared dependencies of the installed Three types. Include their complete declaration trees even when the representative probe does not reach them. The type-side fflate 0.8.3 is distinct from runtime asset decoder fflate 0.8.2; never deduplicate by package name while dropping version identity. SDK source provenance includes its exact repository source hashes and Lux's distribution notice policy. This inventory records existing license files; it does not grant new publication rights.

## Delivery decomposition and gates

| Leaf | Deliverable and exact prerequisite | Ownership |
| --- | --- | --- |
| **T4a, first implementation-ready leaf** | Reproducible declaration pack builder, bounded pure pack verifier, generated closure tests. Requires independent acceptance of this plan and accepted LUX-24 resolver integration. No directory-project writes or CLI claims. | Four new source/test files below plus SDK skill documentation when declaring the build-time pack behavior. |
| T4b | Pure per-definition editor output and mismatch/repair proposal APIs. Requires accepted T4a; its exact leaf plan must settle package-only definition navigation and root solution semantics using actual mixed-SDK fixtures before implementation. | Extend `packages/core/src/project/tooling.ts`; new `tests/project/tooling-config.test.mjs`; no compiler/service edits. |
| T4c | Verified installed compiler/CLI closure and snapshot check adapter, with tampering tests. Requires accepted T4a/T4b and separately reviewed distribution manifest + command plan. | Proposed `scripts/prepare-project-checker.mjs`, `apps/build-worker/src/project-check.mjs`, `tests/compiler/project-tooling.test.mjs`; shared compiler/build owners approve any edits. |
| T4d | Explicit guarded materialization/repair and installed offline editor/CLI gate. Requires accepted T4c plus independently available guarded file adapter/service contracts. This dependency cannot silently unblock LUX-7. | Existing future filesystem service writer, CLI/discovery/SDK skill/build owner; exact files and wire contract reviewed at that gate. |

Do not mark Slice 4 complete at T4a. T4b–T4d preserve remaining requirements and are not executable merely because named here. A fresh exact specification, required prerequisites and independent critique precede each later worker.

## T4a: deterministic declaration pack

**Create exactly:** `packages/core/src/project/tooling.ts` (pure byte validation and identities), `scripts/prepare-project-tooling.mjs` (trusted distribution build generator), `tests/project/tooling.test.mjs` (pure admission/identity), `tests/compiler/tooling-pack.test.mjs` (actual emitted declaration closure). Test runner `scripts/test-project-cpu.mjs` already discovers `.test.ts`/`.test.mjs`; do not modify shared runners or package scripts for this leaf. Generated bytes go under ignored `dist/project-tooling/` in the isolated build checkout. Commit builder/tests and evidence manifest, not native compiler binaries. Before external author documentation advertises the capability, update repository `skills/lux-visual-creation/` with build-only availability and run installer/check per AGENTS.md; do not advertise project create/check/repair commands in T4a.

**Pure exported contract (new names):**

```ts
type ToolingFile = Readonly<{path: string; byteLength: number; sha256: string}>;
type ToolingPackage = Readonly<{name: string; version: string;
  metadataPath: string; licensePaths: readonly string[]}>;
type DeclarationPackManifest = Readonly<{
  format: 'lux-declaration-pack'; version: 1;
  typescriptVersion: '7.0.2'; threeVersion: '0.186.0'; threeTypesVersion: '0.186.0';
  sdkVariants: Readonly<Record<'0.1.0'|'0.2.0', Readonly<{
    declarationEntry: string; contractHash: string}>>>;
  packages: readonly ToolingPackage[]; files: readonly ToolingFile[];
}>;
type VerifiedDeclarationPack = Readonly<{
  manifest: DeclarationPackManifest; declarationPackHash: string;
  files: Readonly<Record<string, Uint8Array>>;
}>;
export const toolingLimits: Readonly<{manifestBytes: 1048576; files: 8192;
  fileBytes: 8388608; totalBytes: 33554432; pathBytes: 240; packages: 32}>;
export function parseDeclarationPackManifest(raw: Uint8Array): DeclarationPackManifest;
export function verifyDeclarationPack(rawManifest: Uint8Array,
  files: Readonly<Record<string, Uint8Array>>,
  expectedPackHash: string): Promise<VerifiedDeclarationPack>;
```

Returned byte arrays are defensive copies, never caller views. `Readonly` is not a claim of deeply immutable typed-array contents: consumers retain their verified private snapshot; expose new copies on external handoff. No public constructor or boolean makes the project lock trustworthy. A `VerifiedDeclarationPack` attests bytes against the **supplied expected identity** only, not installed authority. T4c obtains that expected identity from the verified installed distribution; never from the same project's lock without independent installed evidence.

**Validation and hash rules:** raw UTF-8 JSON uses existing bounded JSON own-data conventions, rejects BOM/duplicate decoded keys/nonfinite values/accessors and unknown fields. Manifest ≤1 MiB; each file ≤8 MiB; count ≤8192; original aggregate ≤32 MiB; package inventory ≤32. Equality is accepted; limit+1 rejected before full byte copy or hash. Check map key count, dense entries and all typed-array internal byte lengths (reject SharedArrayBuffer/detached/non-Uint8Array) before allocating snapshots. Reject extra/missing files, duplicate/case-colliding paths, file/directory prefix collisions, and duplicate package name+version identities. This closure may include @scopes and dots: use a dedicated relative ASCII path validator, not metadata `sourcePath`; prohibit absolute/drive/UNC/device names, backslashes, empty/dot/dotdot segments, Windows reserved names, colons, trailing dot/space and >240 UTF-8 bytes. Only `.d.ts`, `.d.mts`, `.d.cts`, `.json`, `.txt`, `.md`, and basename `LICENSE` are admitted; reject executable `.js/.mjs/.cjs/.exe/.dll/.wasm/.node`, symlinks and filesystem objects at builder boundary. Package metadata bytes are inert data.

SHA256 returns lowercase 64 hex. Each file record hashes its exact bytes. Sort file records lexicographically by ASCII path and package records by `[name,version]`; no timestamps, absolute paths, `.pnpm` paths or machine names in the hashed output. `declarationPackHash = SHA256(UTF8(JSON.stringify(['lux-declaration-pack',1,manifest])))`, where the validated manifest is reconstructed in the interface's property order and nested objects in their displayed order (SDK variants 0.1 then 0.2, variant entry then contractHash; file path/byteLength/sha256; package name/version/metadataPath/licensePaths). License paths are sorted. `pack.json` contains exactly that canonical manifest plus one LF; it is excluded from its own files list. Canonicalize on admission, so whitespace does not alter semantic pack identity; raw manifest bytes can be separately inventoried by distribution packaging.

For each SDK, `contractHash = SHA256(UTF8(JSON.stringify(['lux-sdk-contract',1,version,inputs])))`, with inputs sorted `[logicalSourcePath,sha256]` for selected SDK source, runtime-contracts `index.ts`, `parameters.d.mts`, and (0.2 only) runtime `parameters.mjs`. This binds generated declaration provenance to the real implementation, not only a package version. Pack file inventory binds actual emitted output. Preserve original hashes in an inert `provenance.json` and include that file in the pack. Existing `DependencyLock['toolchain']` can consume these values later; `runtimeBuildHash` is deliberately not fabricated from Git HEAD or pack hash.

**Builder invocation:**

```powershell
& 'C:/Program Files/nodejs/node.exe' scripts/prepare-project-tooling.mjs --source-root <trusted-checkout> --dependency-root <existing-pinned-node_modules> --out <new-empty-output-directory>
```

Arguments are installation/build operator capabilities, never read from project input. Refuse an existing nonempty output and write into a newly created temporary sibling; publish only after all checks, retain failure evidence. No network/package manager subprocesses. Resolve trusted package physical roots and record their actual versions; resolve transitive type packages from the physical @types/three package root, not its ancestor alias. A package containing types but no runtime entry requires `package.json` resolution. Explicitly reject version mismatches or missing notices. Resolve the native compiler through installed `getExePath.js`, validate both TypeScript package versions and record executable hash; do not ship that executable in the project pack.

Output layout under the content-addressed pack root:

```text
pack.json
provenance.json
sdk/0.1.0/index.d.ts
sdk/0.1.0/shared.d.ts
sdk/0.2.0/index.d.ts
sdk/0.2.0/shared.d.ts
sdk/0.2.0/parameters.d.ts
node_modules/@types/three/<complete declaration tree + inert metadata/notices>
node_modules/@types/webxr/<complete declaration tree + inert metadata/notices>
node_modules/<each remaining exact type dependency>/<declarations + metadata/notices>
typescript/lib/<all installed TypeScript standard lib.*.d.ts>
licenses/<package-key>/<original license/notice bytes>
```

Copy all declaration files of each listed package and retain the declaration-relevant package metadata (`types`, `typings`, `typesVersions`, `exports`, `imports`) as original inert `package.json`. Do not execute or auto-select scripts/plugin metadata. The pack's physical package tree may be flatter than pnpm, but original specifiers and all declaration paths must resolve inside the output. Hash copied raw bytes; if a metadata remap is necessary to close resolution, record original hash plus deterministic transformed bytes in provenance and test it, rather than silently dropping metadata fields. Do not copy runtime JS/WASM from Rapier/meshoptimizer or runtime Three.

Generate declarations separately for both SDKs using the current compiler projection and `declaration: true, emitDeclarationOnly: true`; write its fixed config in the temporary staging directory. Rewrite **only known fixed Lux projection imports** to sibling `.js` declaration specifiers; never regex-rewrite authored source or arbitrary package declarations. Emit `sdk/0.x/index.d.ts` and `shared.d.ts`; copy parameter declaration for 0.2. Resolve Zod within the pack. Standard libs belong in the pack for editor/distribution completeness; actual installed compiler stdlibs remain trusted installed resources for the check path. Test the two sets' byte identities instead of assuming editor TS automatically selects project-local libs.

Do a second native compiler pass over the emitted `.d.ts` pack with representative probes for each SDK and both Three imports, `skipLibCheck:false`, explicit paths, `types:[]`, and standard libs sourced from the staged pack using `noLib:true` plus an explicit list of every standard library in the pinned ES2023/DOM closure captured from the trusted compiler (62 files in this investigation); do not assume noLib follows lib reference directives. Keep `--listFilesOnly` and `--traceResolution` separately. Every resolved declaration must lie within pack/probe staging; failed lookup attempts are allowed, successful outside resolution is not. A failure caused by third-party type closure is a blocker to this pack claim, not permission to enable `skipLibCheck` and call closure checked.

Independently audit **every shipped declaration**, including `.d.ts`, `.d.mts` and `.d.cts`, rather than only declarations reached from representative probes. Enumerate each file's import/export, import-type, triple-slash path/type/lib references and declaration-relevant package metadata targets; retain a bounded ledger mapping each source edge and applicable Bundler import/require/types condition to its resolved staged target. Use the pinned compiler's normal resolution and explicit root files to exercise otherwise unreachable declarations. Partition incompatible standard-library variants into separate configs; do not force all libraries into a single semantic program. Account for every shipped file and edge, reject missing targets or successful resolution outside staging, and report any unsupported resolution form as incomplete coverage. Preserve original metadata conditions, wildcard targets and physical package layout in the audit. It may execute trusted checking tools but never package scripts or authored probes.

Prove this audit is effective by first passing the complete pack, then removing a staged declaration dependency reached only through an otherwise unimported Three example (for example RapierHelper, fflate.module, tween.module or meshopt_decoder.module). The representative SDK/Three probe must remain passing while the exhaustive audit fails with the exact missing edge. Retain both outcomes and restore by rebuilding a fresh pack. These internal packages remain unavailable as authored bare imports. Inventory/list-files output alone is never evidence of exhaustive edge resolution or semantic correctness.

- [ ] Write pure tests first with a minimal manifest fixture and exact expected hash. Required behavior includes byte/hash mismatch, no accessor calls, map/manifest cardinality, hostile paths, omitted notice, forbidden executable, complete quota boundaries, fresh copies and deterministic sorting.

```js
const good = await packFixture(); // fixture helper defined in tooling.test.mjs; one SDK pair and inert files
const verified = await verifyDeclarationPack(good.manifest, good.files, good.hash);
assert.equal(verified.declarationPackHash, good.hash);
const changed = {...good.files, 'sdk/0.2.0/index.d.ts': new Uint8Array([0])};
await assert.rejects(verifyDeclarationPack(good.manifest, changed, good.hash),
  error => error.code === 'TOOLCHAIN_MODIFIED');
assert.notEqual(verified.files['sdk/0.2.0/index.d.ts'], good.files['sdk/0.2.0/index.d.ts']);
```

All errors are `Error & {code:'TOOLCHAIN_INVALID'|'TOOLCHAIN_MODIFIED'|'TOOLCHAIN_UNAVAILABLE'|'QUOTA_EXCEEDED';path?:string}`; malformed shape/path→INVALID, missing declared bytes/package/notice→UNAVAILABLE, byte/hash mismatch→MODIFIED, limit overflow→QUOTA. No filesystem code is added to the pure module.

- [ ] Run `node --test tests/project/tooling.test.mjs` and retain meaningful red failures before implementation.
- [ ] Implement pure verifier then builder; test twice from two fresh output directories. Identical input bytes must produce byte-identical payloads/manifests despite physical source/output path differences.
- [ ] In `tests/compiler/tooling-pack.test.mjs`, build valid 0.1 and 0.2 entry/helper probes, plus Three Scene and TSL float. Include wrong 0.2 parameter key (TS2339 at exact authored file/line/column), wrong SDK pin, and forbidden authored bare import tests through existing `compileVisual`/resolver, separately from raw editor type diagnostics. No authored probe runs.
- [ ] Run paired semantic fixtures against **both emitted declarations and the actual trusted SDK projection**. For each SDK, exercise its concrete `defineVisual`/`create` and frame context shape; SDK 0.2 must preserve a declared parameter's inferred `frame.controls` value type and reject an undeclared key with TS2339 at the recorded authored file/line/column. Include a value-type misuse and a meaningful 0.1-versus-0.2 API-shape negative derived from the actual SDK sources. Freeze exact fixtures and expected diagnostics before generation; compare success/failure and intended diagnostic code/location across both paths without requiring incidental generated-path text equality. A widened or erased generated generic must fail these negatives even when source provenance hashes remain unchanged. Keep policy-only forbidden-import and wrong-pin checks in the authoritative source-policy path; declarations do not enforce import capabilities. Preserve emitted diagnostic logs/declaration hashes separately from trusted compiler results.
- [ ] Run the exhaustive per-file/per-edge audit and its otherwise-unreached dependency mutation; retain the complete inventory, condition/target ledger, bounded coverage counts and precise negative edge diagnostic independently of representative semantic fixtures.
- [ ] Run focused compiler test with existing pinned dependency root, and `node scripts/test-project-cpu.mjs`; save command, compiler/executable/package hashes, emitted manifest, successful resolution inventory, all expected negative diagnostics and source SHA. Run repository two typechecks if the new module enters their inventory.
- [ ] Self-review all emitted paths, manifest hash fixtures and source-vs-generated SDK parity. Commit the bounded source/test/doc files, submit exact SHA for fresh independent review, then stop. Coordinator integrates separately.

## Later leaf interface decisions and preserved requirements

T4b consumes admitted `ProjectMetadata` plus a T4a verified pack and **installed-supplied** `DependencyLock['toolchain']`. Its reviewed contract must return planned bytes without writing them: `createProjectEditorPlan(...) -> {files, definitionConfigs}`. Local components receive nearest `<registered-component-dir>/tsconfig.json`; root `tsconfig.json` has `files:[]` and references each component configuration. SDK path selects `vendor/toolchain/<declarationPackHash>/sdk/<sdkVersion>/index.d.ts`. Relative Three paths select the same pack's `node_modules/@types/three/build` entrypoints. Settings match trusted compiler strict/ES2023/DOM/ESNext/Bundler, noEmit/allowImportingTsExtensions/types:[], and files enumerate the admitted definition closure. Cross-package navigation must retain exact origin paths and each consuming definition's SDK; a mixed-SDK project cannot have one global alias. A solution index is editor navigation, not a claim that `tsc --build` is the authority or that referenced noEmit configs build successfully.

T4b's comparison returns `EDITOR_CONFIG_MISMATCH` per path, expected/actual raw hashes, and bounded suggested replacement bytes/diff. A semantically different edited config or pack byte stays untouched; opening produces diagnostics only. Missing pins report exact SDK/version/pack identity; missing package source stays resolver `DEPENDENCY_UNAVAILABLE`; modified immutable package stays `PACKAGE_MODIFIED`. Explicit repair proposal records old expected hashes, desired installed-supported selection and resulting lock/config changes. Upgrade/downgrade can require source changes and must fail checking without rewriting authored source; preserve custom config bytes until the user explicitly chooses replacement. T4d executes approved replacement with file-version preconditions; drift after proposal aborts rather than overwrites. No new generic writer or file-acquisition fallback is authorized here.

T4c must inventory the **actual installed checker closure**: Node executable plus license/third-party notices, native TypeScript package/executable/libs, Babel parser 8.0.5 and notice, Zod, the existing worker/compile/identity/policy helpers, Windows supervisor script, SDK source/runtime parameter code, and asset decoder closure even for code-only inputs because current worker inventories it unconditionally. Follow `assetDependencyPaths` actual pins fast-png 8.0.0, pako 2.1.0, jpeg-js 0.4.4, runtime fflate 0.8.2, iobuffer 6.0.1 and repository codec notices. Three runtime `three.webgpu.js`, `three.tsl.js`, `three.core.js` are currently dependency hashes even for compile-only output. Linker/esbuild 0.28.2 and platform binary are added only if the reviewed installed command links; a check-only command must not invent a playback claim. Discover static module dependencies and packaged successful loads, no list inferred only from package.json. Windows PowerShell/.NET supervisor remains an explicit supported OS prerequisite.

T4c verifies an installed distribution manifest before exposing supported toolchain, including a separately domain-separated runtime build identity over complete sorted installed runtime file hashes; freezes the exact identity algorithm in its own review, integrating existing `packages/export/src/package.cjs` conventions rather than treating a resolver artifact's dependencyHashes as proof of distribution completeness. Existing `compileVisual({source}, {dependencyRoot,timeoutMs})` remains the execution boundary; `prepareProjectResolution` and `resolveProject` supply admitted snapshots, and `mapProjectDiagnostic` maps back exact origins. The adapter must not reread live working files after snapshot capture. Project tsconfig/package.json/declaration edits cannot alter generated compile configuration or installed bytes; clear hostile environment and never use shell interpolation/plugin/lifecycle hooks. Test with sentinel plugin/preinstall scripts, hostile NODE_PATH, altered sdk declarations and wrong `paths`; trusted semantic result remains based on installed types and sentinels remain absent.

T4d's installed commands are the architecture's proposed `lux project check --project <directory>` and explicit tooling repair, not current commands. Check works without running Studio; apply remains a different authenticated service operation. Discovery exposes compiler/editor version distinction and selected SDK/declaration/runtime identities. Editor completion and go-to-definition require an actual supported editor smoke test for both SDKs and a helper, not a compiler pass alone. SDK skill instructions/examples must describe only delivered behavior and be reinstalled/checked from the final checkout.

## Evidence contract and offline gate

| Criterion | Setup and executor | Required observation and artifacts |
| --- | --- | --- |
| T4a pure admission/identity | Worker isolated source SHA, exact malformed/raw fixtures | Focused red/green logs, expected hash vectors, quota +1/equality behavior, absence of getter calls, no shared views; reviewer repeats meaningful cases. |
| Declaration closure/parity | Existing trusted exact dependency versions; emitted staged pack; paired SDK fixtures and both Three imports; exhaustive shipped declaration/metadata edge audit | Generator manifest and package/notices hashes; paired emitted/trusted positive and wrong-key/value-type/SDK-shape negative diagnostics; complete condition/target ledger with no outside resolution; otherwise-unreached dependency mutation fails audit while representative probe still passes. Emitted/raw hashes and list-files inventories supplement these observations, not replace them. |
| Mixed SDK/custom editor files | T4b fixture two different SDK definitions, shared declared helper/package, original config hashes | Per-definition diagnostics and navigation paths; no global alias leakage; mismatch/repair proposal preserves every original byte; reviewed root index semantics. |
| Trusted compiler separation | T4c actual installed distribution manifest verified, tampered project config/types/package/env and sentinel scripts | Exact same trusted source semantics, precise mismatch codes, no sentinel side effects; supervisor/raw result/diagnostic provenance. Does not establish network denial or disk isolation. |
| Full offline installed workflow | T4d disposable Windows VM or equivalent preprovisioned isolated test host with project + installed Lux distribution only; network disabled by test harness, no development checkout mounted/copied, no ancestor/global node_modules or editor plugins | Independent validator records filesystem/mount/process/environment inventory, network-isolation setup, package/executable hashes, actual editor diagnostics/completion/navigation, installed CLI source/helper pass and wrong-key/import failures, explicit upgrade/downgrade repair preserving edits. Cold restart repeats without registry or Studio. |

A private temporary directory on the current developer host plus clean environment is only a **resolution audit**. It is not clean-room/offline evidence: the checkout and network can still exist. Never hide, move or change ACLs on the user's checkout to simulate absence. If the isolated host/editor is unavailable, leave the full offline gate incomplete with its prerequisite and continue eligible pure work. No successful command substitutes for those setup facts. Every acceptance record names exact executor/session, source and installed hashes, command argv, preconditions, actual results and raw artifact paths; source review and main integration are separate decisions.

## Planning review handoff

This document freezes T4a's bounded API/build/test contract and preserves all Slice 4 obligations through explicit later gates. Independent review should challenge declaration closure completeness, native TS7 layout, package metadata resolution, hash/circularity rules, public SDK boundary, quotas before copying, tamper authority separation and the honesty of offline preconditions. Significant findings revise this exact plan before implementation; root remains sole coordinator and ticket assignees remain explicit.
