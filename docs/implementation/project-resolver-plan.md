# Pure Project Resolver Implementation Plan

> For agentic workers: use `superpowers:executing-plans` for the separately assigned implementation leaf. This planning ticket does not authorize implementation or further delegation. A fresh independent critique and recorded dispositions must approve this exact plan before dispatch.

**Goal:** resolve an explicitly supplied immutable project into the existing bounded compiler envelope, verifying exact vendored bytes and preserving project diagnostic origins.

**Architecture:** a factory admits the complete raw metadata set and copies bounded content into a private in-memory snapshot. The resolver traverses declared definitions, validates each owner's imports and constructs ordinary project-relative source paths and logical asset aliases. Comparison uses both complete snapshots; no file reads, project service or runtime activation occurs in these modules.

**Tech stack:** existing TypeScript, Web Crypto SHA-256, `@babel/parser@8.0.5`, metadata admission, source policy and pure BMP/PNG/JPEG asset admission. Node `node:test` and the existing contained compiler provide later CPU evidence. No dependency change.

**Spec:** [filesystem architecture](../design/filesystem-projects.md), [metadata v1 addendum](../design/filesystem-project-metadata-v1.md), and [filesystem plan Slice 3](filesystem-projects-plan.md#slice-3-reference-resolver-and-exact-package-closure). These accompany this plan at execution time.

## Status and evidence boundary

Plan revision 2, LUX-12 specification 2. Inspection baseline: `6726f5e420e4136082c864ff85e3216976b3cb63`, branch `codex/project-resolver`, checkout `C:/Users/zFlei/repos/lux/.worktrees/project-resolver`. This is a documentation update over accepted metadata integration `f95f3975892bf612bb63b94111893b18b84fff20` (LUX-6). The planner inspected source only; no application tests, compiler invocation, installation, native artifact inspection or graphics execution occurred. Root synthesized review corrections under claim `bc99a445-05ae-413e-a588-bfda23b40c8c`; original source `4413d8da34f807170b055c806b6941e18a17aa92` and independent round-1 rejection remain preserved. Exact revision-2 recheck is required before implementation dispatch.

Available now: `admitProjectMetadata` checks the whole metadata set, including unused registered components and package exports, exact pin claims, cycles, references, alias collisions, SDK compatibility and saved-control provenance. `hashPackage` checks supplied file-hash claims against metadata; it does not inspect original bytes. The existing compiler accepts a `SourceBundle`, preserves submitted helper paths in structured diagnostics and computes its own source identity. Original BMP/PNG/JPEG codecs and quotas are already implemented.

Planned here: actual in-memory content completeness/hash verification, source decoding/import ownership, complete resolved closures, original-image validation, reversible origin maps and impact comparison. No current directory-project capability is implied. Native acquisition remains a future production consumer prerequisite; LUX-7's separate host safety-classification stop is neither retried nor replaced. Snapshot opacity proves only module ownership of copied input, never filesystem containment, leases, inventory capture provenance, installed toolchain availability, durable acceptance or execution safety.

## Global constraints and ownership

- Project schema v1 remains code-only, SDK `0.1.0` / `0.2.0`. Preserve legacy envelope omission of `sourceVersion` versus explicit `sourceVersion: 2`, including empty assets.
- IDs and pins use exact admitted keys. No prefix lookup, name/path-derived IDs, case-insensitive reference repair, latest-version substitution, cache fallback or network lookup.
- Keep declared unused helpers and validate every managed definition/export, every pin and every original asset. Scene selection cannot suppress invalid project content.
- Preserve original source bytes, CRLF/LF, source spelling, import text and aliases. Root-relative virtual names equal canonical project-relative names. No invisible prefixes or generated wrapper modules.
- Reuse metadata policy and constants; do not modify or copy its schemas. A new project-local SDK guard may assert the two supported literals defensively, but it cannot broaden admission.
- C02 owns `project/contracts.ts`, its tests, compiler/linker/source policy/SDK/artifact surfaces, runtime-contracts index and Studio/transport. This leaf reads those APIs and changes none of them. Reconcile their exact integrated revision before executing compiler checks.
- No `filesystem.ts`, native code, paths adapter, service DTOs, accepted/candidate identities, store, buffers, Git, save/stage/apply, tooling kit, UI/MCP, exporter or skill changes. Internal resolver functions publish no new authoring capability. Runtime smoke, graph composition and installed closure delivery remain future work.

## Selected approach and first coherent leaf

Propose **R3a: pure resolution and verified vendored closure**, one independently reviewable implementation ticket under LUX-2, dependent on accepted LUX-6 and approval of this plan. It includes all code below, focused tests and real compiler diagnostic evidence. Splitting byte verification from resolver ownership would leave a public-looking resolver unable to substantiate its own inputs; keep them in one leaf. Do not expand it to a production consumer just to demonstrate file acquisition.

Alternatives considered: accepting mutable parsed metadata would bypass full raw admission and invite caller mutation; accepting filesystem paths would couple the slice to an unavailable native boundary. The selected copied, raw in-memory input preserves both independent testability and the existing metadata admission contract.

Exact file inventory:

| Action | Path | Responsibility |
| --- | --- | --- |
| Create | `packages/core/src/project/library.ts` | Exact original-file membership/hash verification against one already admitted package and pin |
| Create | `packages/core/src/project/resolver.ts` | Snapshot ownership, whole-project source/asset validation, graph/index construction, envelopes, origins, impacts and mapped diagnostics |
| Create | `tests/project/resolver-fixtures.ts` | Deterministic raw documents/content fixtures, independent expected hashes and valid image builders; do not edit shared `fixtures.ts` |
| Create | `tests/project/library-pins.test.ts` | Raw package integrity, full inventory and bound cases |
| Create | `tests/project/resolver.test.ts` | Complete project, imports, envelope/origins, quotas and old/new impact cases |
| Create | `tests/compiler/project-resolver.test.ts` | Existing `compileVisual` integration, exact helper diagnostic and source identity checks; outside recursive pure project runner |
| Create | `tests/fixtures/project/resolver/README.md` | Fixture meanings, authored input provenance and expected behavior |
| Create | `tests/fixtures/project/resolver/entry-v1.ts.txt`, `entry-v2.ts.txt`, `helper-valid.ts.txt`, `helper-type-error.ts.txt` | Small inert text fixtures; tests read as data and never import/evaluate them |

Do not edit runner inventories or package scripts: `scripts/test-project-cpu.mjs` already recursively discovers the two new project test files. Run compiler integration explicitly. Keep scratch/raw evidence in the implementation worker's ignored, test-owned evidence directory. The implementation submission records its source SHA, not this planning SHA.

## Interfaces to freeze in the leaf specification

All new types live in these two modules and are internal library APIs, not deferred service/wire DTOs. Import existing branded identities, metadata and compiler types from their current owners. `Readonly` is a TypeScript description; implementation copying/private storage enforces ownership.

```ts
// library.ts
import type { DependencyLock, Hash, PackageManifest } from './contracts.ts';
export type PackagePin = DependencyLock['packages'][string];
export type VerifiedPackage = Readonly<{
  packageId: string;
  pin: PackagePin;
  fileHashes: Readonly<Record<string, Hash>>;
  byteLength: number; // declared original files only; see project accounting
}>;
export function verifyPackageBytes(
  manifest: PackageManifest,
  pin: PackagePin,
  files: Readonly<Record<string, Uint8Array>>, // package-relative, originals only
): Promise<VerifiedPackage>;

// resolver.ts
import type { DependencyLock, Hash, ComponentRef } from './contracts.ts';
import type { SceneId, AssetId } from '../../../runtime-contracts/src/identities.ts';
import type { SourceBundle, CompileDiagnostic } from '../../../runtime-contracts/src/index.ts';
export type ProjectResolutionInput = Readonly<{
  documents: Readonly<Record<string, Uint8Array>>; // metadata paths only
  files: Readonly<Record<string, Uint8Array>>; // exact managed content paths only
}>;
declare const resolutionBrand: unique symbol;
export type ProjectResolutionSnapshot = Readonly<{ [resolutionBrand]: true }>;
export type SourceOrigin = Readonly<{
  projectPath: string;
  owners: readonly ComponentRef[]; // deterministic order; shared package files can have multiple exports
}>;
export type AssetOrigin = Readonly<{
  projectPath: string;
  assetId: AssetId;
  owner: ComponentRef;
}>;
export type ResolvedProjectScene = Readonly<{
  sceneId: SceneId;
  source: SourceBundle;
  origins: Readonly<Record<string, SourceOrigin>>; // virtual .ts path -> original
  assetOrigins: Readonly<Record<string, AssetOrigin>>; // logical alias -> original
}>;
export type ProjectDiagnostic = Readonly<{
  diagnostic: CompileDiagnostic; // original retained unchanged
  origin?: SourceOrigin;
}>;
export type ProjectResolutionCode =
  | 'PROJECT_INVALID' | 'DEPENDENCY_UNAVAILABLE' | 'PACKAGE_MODIFIED'
  | 'CONTENT_MISSING' | 'CONTENT_UNDECLARED' | 'SOURCE_BOUNDARY_VIOLATION'
  | 'COMPILE_FAILED' | 'ASSET_BOUNDARY_VIOLATION' | 'QUOTA_EXCEEDED'
  | 'UNKNOWN_SCENE' | 'PROJECT_ID_MISMATCH';
export type ProjectResolutionError = Error & Readonly<{
  code: ProjectResolutionCode;
  path?: string;
  packageId?: string;
  expected?: string | number;
  actual?: string | number;
  owners?: readonly ComponentRef[];
}>;
export function prepareProjectResolution(
  input: ProjectResolutionInput,
  supportedToolchain: DependencyLock['toolchain'],
): Promise<ProjectResolutionSnapshot>;
export function resolveProject(snapshot: ProjectResolutionSnapshot, sceneId: SceneId): ResolvedProjectScene;
export function affectedScenes(base: ProjectResolutionSnapshot, next: ProjectResolutionSnapshot): readonly SceneId[];
export function mapProjectDiagnostic(scene: ResolvedProjectScene, diagnostic: CompileDiagnostic): ProjectDiagnostic;
```

Keep snapshots in a private `WeakMap` keyed by a frozen empty token. Every query checks membership, including forged/type-cast tokens. Deep-freeze returned plain records/arrays and detach them from private indexes. Do not return typed-array storage or mutable Map/Set instances. Query methods perform no asynchronous reads or imports. `resolveProject` returns a fresh detached envelope (or an immutable stored envelope with no exposed mutable fields); do not cache all definition source copies.

The factory copies both byte maps and snapshots the toolchain before its first `await`, using current own-descriptor/typed-array capture behavior (`byteRecord`, `snapshotJsonData`), then calls `admitProjectMetadata` with private document copies. Capture records from own data descriptors; reject getters and extra keys. Additionally reject SharedArrayBuffer-backed views before copying, using the intrinsic typed-array buffer getter rather than an overrideable property; existing `byteRecord` alone does not perform that check. Proxy-trap immunity is not promised. No user callback, live file provider, iterator, lazy byte loader or shared mutable buffer remains in the snapshot. The caller's toolchain is independently selected trusted input, not `documents`' lock echoed back as installed evidence. Tests supply a synthetic trusted fixture selection and label it accordingly.

`verifyPackageBytes` also copies its arguments before awaiting a digest, rejects shared buffers, and calls `validateMetadata('package', ...)`. Its pin uses own-data capture, exactly the three keys `version`, `manifestHash`, `contentHash`, the existing `hashSchema` for both hashes, and exact version equality with the admitted manifest (no new version grammar). It returns only detached metadata/hashes. Errors carry `code`, `message` and applicable `path`, `packageId`, `expected`, `actual`, `owners` using `ProjectResolutionError` in `resolver.ts` and structurally compatible errors from `library.ts`; no runtime circular import or shared error schema is added. Preserve upstream error cause and detailed message; wrap generic metadata errors as `PROJECT_INVALID`. Missing vendored bytes use `DEPENDENCY_UNAVAILABLE` with exact package/version/content hash in the message, changed or extra vendored bytes use `PACKAGE_MODIFIED`. Local missing/extra content uses the corresponding content code. Errors never suggest automatic repair.

**Direct package-helper bounds:** These apply to every exported `verifyPackageBytes` call, independently of the project factory. First capture manifest/pin through bounded `snapshotJsonData` and validate with existing metadata/hash schemas; reject unknown/accessor/symbol fields before reading values. Before copying any file payload or starting any digest, bound the file record to `metadataLimits.nodes` (65,536) own data entries, compare its exact key membership with the captured validated manifest's file inventory, and preflight each ordinary non-shared Uint8Array using intrinsic byte-length/buffer accessors. Sum lengths with overflow-safe arithmetic and cap originals at `projectLimits.packageBytes` (33,554,432 bytes). Then copy the bounded bytes and perform actual hashes; direct calls cannot rely on factory preflight or `byteRecord`'s unbounded default. Missing/extra membership fails before payload copy/digest, including excessive zero-length entries. At most this one package's bounded copy is retained across its digests. The helper receives parsed metadata, so its `byteLength` and original-byte bound exclude raw manifest bytes; the factory separately counts the actual raw manifest bytes in the aggregate package dimension. Direct-call tests exercise exactly the byte ceiling, one byte over, excessive zero-length members, forged length properties, shared buffers and getter counters; rejected preflight cases must not enter payload-copy/digest phase. The exact-bound valid fixture uses declared originals, independently expected hashes and otherwise valid small metadata.

**Admission-failure collision diagnostics:** `admitProjectMetadata` remains the sole admission authority. Its generic failures can precede the resolver graph, so preserving its cause alone cannot provide owners. Add a bounded, diagnostic-only enrichment path inside `resolver.ts` after failed admission, operating only on already captured private metadata bytes. Use existing bounded JSON parsing, individual metadata validators, reference/identity schemas and lexical path helpers to establish exact document registration, owner references and candidate paths/aliases. Walk only bounded individually validated component/export definitions with cycle/depth/count guards; never treat this diagnostic walk as an admitted snapshot or continue resolution. A provable cross-node asset-alias collision attaches both exact ComponentRefs in deterministic order; a provable case-folded canonical source-path collision attaches the owners of both original spellings. Retain the original `PROJECT_INVALID` cause/message and relevant original path, even when a second diagnostic fact is attached. Do not parse error-message text as a policy discriminator or duplicate full metadata acceptance. If the needed individual schema/path/registration evidence is invalid or insufficient, retain the generic rejection without guessed owners. The owner guarantee applies to collisions with independently established ownership, not malformed input whose ownership cannot be established. Tests must exercise actual factory rejection (not a mocked admitted graph): two valid definitions whose reference closure collides in asset aliases, and a reachable case-collision fixture whose owners can be established; also invalid metadata proving no invented owners. If existing metadata invariants make the latter fixture unreachable, document that invariant and test its earlier authoritative rejection instead of claiming an impossible resolver case. The implementation reviewer verifies both the positive enrichment case and these explicit limits.

## Resolution and integrity algorithm

### 1. Complete input capture and byte accounting

Input membership is the exact union of all registered component source paths, project asset descriptor paths and every pinned package's `files` paths under `libraries/<contentHash>/`. Metadata is supplied separately using the addendum's exact document set. Do not accept editor config, declaration packs, ignored files or unspecified workspace inventory through `files`; a future trusted acquisition adapter must partition its captured inventory deliberately. Reject metadata/content path overlap, case-fold collisions, extra content and missing content. Presence uses own-key membership, so an empty source file is present and valid text.

Before copying large payloads, use own descriptors to count bytes and enforce a conservative aggregate content bound of `authoredBytes + assetBytes + packageBytes` = 58,720,256 bytes (56 MiB). Metadata is separately bounded at 1 MiB. Bound record cardinality before copying zero-length values: metadata documents cannot exceed `3 + projectLimits.scenes + projectLimits.components + projectLimits.packages` = 59; content records use the existing `metadataLimits.nodes` value 65,536 as a conservative preflight ceiling. This cannot exclude a valid inventory: each package original consumes at least its 64-byte hash in the aggregate 1-MiB raw metadata budget, plus at most 256 local files and 64 local asset records. Exact admitted membership then replaces this loose ceiling. Reject extra top-level input fields and oversized records before allocating the owned byte copies.

After admission derives exact categories, enforce each dimension, including package manifests in the total 32 MiB vendored-byte dimension; package original assets count toward both package and project-asset dimensions but are copied once in the complete content map. Local authored source alone counts toward 256 files / 8 MiB; package source counts toward package storage and every using closure's source budget. Reject boundary overflow before hashing/decoding. No normalization of raw hashes.

Copies do not increase semantic authored-content quotas. They do consume memory: caller buffers plus the factory-owned content copy can coexist; per-package verification takes one additional package copy, processed sequentially (at most 32 MiB). Thus factory-owned raw bytes are bounded by 57 MiB plus one 32 MiB package verification copy, with an additional at-most-1-MiB temporary metadata admission byte copy. Parsed metadata, JS strings, ASTs, image decode buffers and returned envelopes are additional bounded-work overhead, not a claim that process RSS is 90 MiB. Parse/check one definition closure at a time, release temporary ASTs/images/package copies, avoid all-closures source/asset caches, and retain only owned bytes, admitted metadata, graph/path indexes and compact comparison hashes. A closure remains capped at 1 MiB UTF-8 source, 1 MiB originals and 2 MiB decoded RGBA. Tests check alias accounting and exact content bounds; do not invent a measured heap budget.

Use fatal UTF-8 decoding for every declared source file, preserving BOM and CRLF by configuring `TextDecoder('utf-8', { fatal: true, ignoreBOM: true })`; reject malformed UTF-8. Hash raw bytes before decoding; UTF-8 re-encoding must equal originals, including BOM. A Git LFS pointer used as required content fails completeness explicitly by recognizing the standard pointer header plus oid/size lines; do not treat it as actual source/image/package content or fetch its object. Do not classify arbitrary license prose as an LFS pointer.

### 2. Exact package originals

For every pinned package, including unused packages, require precisely all declared original file paths and hash actual bytes with SHA-256. Compare each to `manifest.files`; then call existing `hashMetadata('package', manifest)` and `hashPackage(manifest, actualHashes)` and compare both to the exact lock pin, together with package ID/version. Hash non-source originals such as a license too. Package `package.json` is metadata, not an additional original supplied to `files`; a manifest claiming that path as an original fails the metadata/content overlap check. No self-hash convention is introduced.

Reuse `admitProjectMetadata` for dependency pin agreement, package cycles, export availability, package-to-local prohibition and SDK range validation. The new helper does not resolve an alternate dependency lock or mutate a pin. A pin update changes the virtual package prefix and must have the corresponding explicit source/import changes in the candidate.

### 3. Whole-project graph and import ownership

Create nodes keyed by `local:<componentId>` or `package:<packageId>:<exportId>` and directed metadata-reference edges. Build lookup indexes using exact admitted keys; never normalize an ID to repair a mismatch. Metadata admission already rejects cycles and SDK/envelope incompatibility. Reuse its outcome; a private traversal guard can defend against an implementation bug without defining a second policy.

For each local component and each package export as a root, traverse every declared reference and collect **all** declared files, including unimported helpers. For a scene, select `SceneFile.implementation`, including a direct package export. Paths are `<registered component directory>/<file>` and `libraries/<exact content hash>/<file>`. Distinct components/packages with the same basename remain distinct canonical paths. One physical file shared by exports of the same package occurs once in the bundle; retain the sorted list of declaring export owners. Other ambiguous/case-colliding ownership fails with both owners. An existing asset alias collision still fails even if two distinct nodes bind identical pixels; a repeated visit to one shared node is deduplicated.

Parse each file as Babel TypeScript module data (`sourceType: 'module'`, `plugins: ['typescript']`, `errorRecovery: false`), matching the compiler's current static import forms. For `ImportDeclaration`, `ExportNamedDeclaration` and `ExportAllDeclaration` with a source, use the AST's decoded string. Allowed bare imports come from `sdkMetadata.allowedImports`; do not hardcode an expanded set. All other imports must start `./` or `../`, end in `.ts`, and normalize with slash-only virtual segment logic to an admitted source path. Reject escapes, URLs, absolute paths, backslashes, extensionless imports and arbitrary bare imports. Reject dynamic import, TS import-type and import-equals forms; do not attempt regex-only parsing. No compiler, script or imported visual is executed by the resolver.

Membership in the scene union is necessary but insufficient: resolve each import against the importing definition's own transitive declared reference closure. A helper cannot import a sibling dependency declared only by its caller. For a file claimed by multiple package exports, validate under every declaring export root; an import must be permitted for each owner. A package's dependency pin alone does not select every export into source: the reference graph identifies admitted exports/files. Same-package cross-export imports require corresponding reference reachability. Type-only static imports receive the same check. Ordinary cyclic TypeScript module imports within a permitted definition are left to the existing compiler; forbidden **definition/reference** cycles remain metadata errors.

Compiler-only policy (privileged identifiers, entry `defineVisual`, full TypeScript checking and result sealing) stays with the existing compiler. The factory's validation means metadata/byte/import/envelope validity, not type correctness. A type-error helper can therefore reach the real compiler diagnostic test.

### 4. Assets, envelopes and origins

Every project/package asset descriptor must have original bytes with matching byte length and SHA-256. Validate every asset, including unbound assets, through existing asset admission using a single temporary legal alias matching its media type; no browser/native codec or format extension. Decode bounded images sequentially. Assemble each closure's actual authored aliases and call existing `validateSource` on the final source envelope, enforcing combined source and asset quotas across packages/references. Per-binding quotas apply even when several aliases use the same original asset. Never rename aliases to make a collision pass.

Use the entry definition's exact SDK and envelope: v1 `{sdkVersion, entry, files}`, v2 `{sourceVersion:2, sdkVersion, entry, files, assets}`. Include no `sourceVersion:1` field, generated entry wrapper, scene controls or scene settings. Metadata already rejects images acquired by a legacy v1 root and mixed-SDK references; two independent scenes may still use different supported SDKs. Preserve valid older saved-control provenance unchanged; deriving new AcceptedScene control state belongs to later compile/stage integration.

Let `validateSource` provide compiler-canonical file ordering; its existing legacy locale ordering and v2 code-unit ordering must not be silently replaced. Do not publish another sourceHash algorithm. Asset base64 uses exact originals and canonical padding, with bounded chunk encoding; no normalization/transcoding of pixels. Existing `deriveAssets` may verify raw claims where useful; final envelope validation remains mandatory. Enforce existing 32-file / 1,048,576-byte source, 4-image / 1,048,576-byte original / 2,097,152-byte RGBA, 512 dimension, 786,486-byte per-image, 240-character path and 6,291,456-byte v2 JSON caps. Existing compiler still enforces its 8,388,608-byte request, 131,072-byte diagnostic, 4,194,304-byte output and 30,000-ms deadline limits; the resolver does not bypass them.

Each source path maps directly to its original project-relative path and declaring owners. Each asset alias maps to the original descriptor path, stable asset ID and declaring node. No line rewriting occurs, so line/column remain the compiler's one-based values. `mapProjectDiagnostic` attaches an origin only for an exact known `diagnostic.file`; unknown/generated/fileless diagnostics remain unmapped. Do not guess based on basename, strip arbitrary prefixes, rewrite message text or attach a package source origin to generated SDK diagnostics.

### 5. Affected scenes from both snapshots

Require both inputs to be issued snapshots with equal project IDs; otherwise throw `PROJECT_ID_MISMATCH`. Return sorted unique scene IDs from the union of old/new scene sets. Include additions/removals and any scene whose own semantic scene metadata, registry path, root implementation, reachable definition metadata/path, original source bytes, asset binding/descriptor/provenance/bytes, used package pin or exact toolchain selection differs. Scene settings and saved controls matter independently of source; no global built-in intensity is invented.

Use per-node change seeds plus reverse reachability in **both** graphs, or equivalent exact per-scene closure comparison over both snapshots. For each scene compare sorted tuples of existing metadata hashes, path/raw hashes, bindings and used exact pins. These internal comparison keys are not accepted/candidate/revision/source identities and must not be exported as such. Changed toolchain selection conservatively affects every scene. Project display-name changes or unused package/component edits alone need no affected scene, but future project-scope validation still sees their raw/metadata changes; this API does not authorize scope. A pin update affects every user of that package even when only an unexported license changed. A component rename preserves its ID but changes virtual paths and therefore affects users. A removed reference can affect an old user even when it is no longer reachable in the new graph.

Invalid candidates never become snapshots. Removal of a still-bound asset therefore returns an error during preparation; a valid candidate that removes/repoints the binding and asset affects all old/new users. Do not return an empty impact set to represent invalid input.

## Implementation steps and executable fixture contract

- [ ] Record the assigned implementation checkout/branch/base, live ticket specification and C02 compatibility checkpoint. Read this plan and its three specifications. Verify pinned Node/toolchain availability; no installation follows merely from missing dependencies.
- [ ] Add the inert fixture texts and `resolver-fixtures.ts`. Use fresh deterministic UUIDs; independently compute package metadata/content pin bodies in fixture code (never use the implementation under test to supply its own expected hash). Build a legal 1x1 BMP (58 bytes: 54-byte header, one padded 24-bit row), retain fixed existing PNG/JPEG fixture bytes by reference/copy provenance, and use known byte/hash literals for at least one original. The source files are data, not imported test modules.
- [ ] Add failing library and snapshot/membership tests first; run their exact files and retain observed failure. Implement `library.ts` and input preparation until these tests pass. Add graph/import/envelope/origin/impact tests, observe failures, then implement the corresponding resolver phases. Do not commit knowingly failing intermediate public APIs.
- [ ] Add distinct compiler integration tests after pure tests pass. Run the actual public compiler entrypoint with the explicit trusted dependency root; compare complete raw CompileResult and mapped result. Do not invoke `worker.mjs` directly, weaken its sandbox, mock its diagnostics, link/evaluate the artifact or launch graphics.
- [ ] Run focused pure project inventory, compiler integration serially and both existing typecheck configurations. Review exact tracked diff/file ownership. Request independent implementation review; resolve covered findings before submission. Commit only the enumerated implementation files and report exact source/provenance. A coordinator controls any later integration and combined recheck.

Minimal fixture texts (the filename marker comments below identify separate files and are not part of their contents; the `// helper` comment is part of each helper, making its declaration line 2):

```ts
// entry-v2.ts.txt
import { defineVisual } from '@lux/visual-sdk';
import { start } from './helper.ts';
export default defineVisual({ controls: {}, async create(context) {
  return { update(frame) { const value: number = start; }, render(target) {}, reset(seed) {}, dispose() {} };
}});
// entry-v1.ts.txt
import { defineVisual } from '@lux/visual-sdk';
import { start } from './helper.ts';
export default defineVisual({ async create(context) {
  return { update(frame) { const value: number = start; }, render(target) {}, reset(seed) {}, dispose() {} };
}});
// helper-valid.ts.txt
// helper
export const start: number = 0.25;
// helper-type-error.ts.txt
// helper
export const start: number = "wrong";
```

The shared two-scene fixture uses component A and component B referencing helper H. Their files import `../../helper/src/helper.ts` from `components/a/src/main.ts` and `components/b/src/main.ts`; both are scenes' root entries. A third scene uses independent component U. A package fixture has direct export entry `src/main.ts`, a helper, a license original and a BMP asset. Pin hashes are derived from its actual fixture original bytes. Separate fixtures use legacy v1 and empty v2; do not mutate the shared metadata-only fixture's fake image/hash claims and mistake them for valid bytes.

Representative tests use these exact API patterns (fixture builder `resolutionFixture()` returns `{input, supportedToolchain, sceneA, sceneB, sceneC, helperPath}`; its `change(path, bytes)` creates a wholly new input):

```ts
const f = resolutionFixture();
const base = await prepareProjectResolution(f.input, f.supportedToolchain);
const next = await prepareProjectResolution(
  f.change(f.helperPath, new TextEncoder().encode('// helper\nexport const start: number = 0.75;\n')),
  f.supportedToolchain,
);
assert.deepEqual(affectedScenes(base, next), [f.sceneA, f.sceneB].sort());
assert.equal(resolveProject(next, f.sceneA).origins[f.helperPath]!.projectPath, f.helperPath);
// Compiler integration fixture switches only the helper's initializer to "wrong".
const scene = resolveProject(await prepareProjectResolution(f.typeErrorInput(), f.supportedToolchain), f.sceneA);
const result = await compileVisual({ source: scene.source }, { dependencyRoot });
assert.equal(result.ok, false, JSON.stringify(result));
const d = result.diagnostics.find(d => d.code === 'TS2322' && d.file === f.helperPath);
assert.ok(d, JSON.stringify(result));
assert.equal(d.line, 2);
assert.equal(d.column, 14); // start identifier in the exact helper text
assert.equal(mapProjectDiagnostic(scene, d).origin?.projectPath, f.helperPath);
```

Fixture API also supplies `typeErrorInput(): ProjectResolutionInput`. Successful compilation of both SDK entry fixtures is required before interpreting the negative diagnostic. If current TypeScript reports a different location, retain raw evidence and reconcile the exact source text/expected identifier location; do not loosen the assertion to arbitrary positive columns or accept a setup failure as the expected type error.

## Criterion-to-evidence contract

All rows are **planned**, not passing results. Executor is the separately registered R3a worker in its exact claimed checkout at its final submitted SHA; a fresh independent reviewer validates the evidence. For each row record setup, command, start/end, exit code, actual observation, full source SHA and raw artifact path/hash. The implementation submission must fill these fields; a missing prerequisite leaves that row incomplete. No planning source read substitutes for a test run.

| Criterion | Setup and preconditions | Method and exact expected observation | Role / stage | Raw artifact provenance |
| --- | --- | --- | --- | --- |
| Complete owned snapshot | Valid synthetic trusted toolchain distinct from project lock; full raw fixture maps | `resolver.test.ts` cases reject missing/extra/case-colliding files, shared buffers, malformed UTF-8, metadata overlap and invalid unused component/export; zero-length helper accepted. Mutate caller maps/bytes/toolchain immediately after calling factory and after resolution: prior snapshot remains unchanged. Forged token rejected. | Worker / pure CPU; reviewer checks assertions | `pure-project.log`, fixture-source hash inventory, exact implementation SHA |
| Exact package integrity | Independent literal pin golden; original source/helper/license/asset bytes; package with dependency and unused pin | `library-pins.test.ts`: byte edit under same pin, missing license/bytes, undeclared extra file, wrong version/ID/hash, pin mismatch and dependency cycles fail; correct full bytes pass. CRLF/LF differ. Retained input originals unchanged. | Worker / pure CPU | `library-red.log`, `pure-project.log`, literal golden body/hash and actual fixture hashes |
| Graph and import ownership | Two shared scenes, independent scene, shared helper/export and direct package entry | Exact reachable files/owners asserted; unknown/prefix IDs, undeclared sibling import, package-to-local, missing export, escaped literal decoding to a forbidden target, re-export of an undeclared target, extensionless/dynamic/absolute/URL import fail. Valid decoded static escaped literals/re-exports, relative `../` and supported SDK/Three pass. Reference cycle rejected; no transitive SDK widening. | Worker / pure CPU | `resolver-red.log`, `pure-project.log`, emitted closure/origin JSON fixtures |
| Envelope and aliases | Independent SDK .1/.2 roots, legacy and empty-v2 direct package exports, duplicate basenames in distinct dirs/packages | Exact object keys and entry path asserted; two independent SDK scenes pass, mixed closure fails. Same-node shared helper deduplicated. Provable alias/case collision returns both owners through the bounded admission-failure enrichment contract above; malformed ownership remains generic rejection, never guessed. Bound asset removed => preparation error; renamed path has unchanged ID and updated exact origin. | Worker / pure CPU | `pure-project.log`, exact serialized envelope/origin snapshots |
| Original media and all quota dimensions | Legal BMP/PNG/JPEG plus malformed originals; limit and limit+1 sized source/package fixtures; compressed valid images for RGBA test | Equality accepted, next byte/file/binding/dimension rejected. Cover 32/33 files, 1 MiB/+1 closure source across packages, 8 MiB/+1 local source, 32 MiB/+1 vendored originals plus manifests, 16 MiB/+1 project images and 64/65 records; 4/5 aliases, 1 MiB/+1 original binding total, 2 MiB/+RGBA, 512/513 dimension, per-image 786486/+1. Repeat aliases count per binding; unused assets validated. Metadata/serialized source caps are reused and covered by current admission tests; assert final envelope passes existing `validateSource`. | Worker / pure CPU; reviewer confirms overflow precondition is actually reachable and independently established | `pure-project.log`, budget-fixture ledger listing exact raw lengths, dimensions and compressed provenance; metadata rejection is distinguished from new raw-byte rejection |
| Old/new impact | Two valid snapshots; edit helper/reference/binding/pin/controls/settings/toolchain, rename/add/remove scene, unused definition | Exact sorted old+new impacted IDs, no unrelated scene. Removed edge still impacts former users; changed license/pin impacts package users; invalid removed asset never returns snapshot; changed project ID rejected; no-op identical snapshots return empty. | Worker / pure CPU | `pure-project.log`, before/after fixture hashes and exact expected ID sets |
| Actual compiler and diagnostic mapping | Windows; pinned Node24.12.0; installed exact TS7.0.2/Babel8.0.5/Three0.186.0 types/runtime; existing compiler Job Object setup works; declared dependencyRoot recorded. Positive fixture succeeds first. | `tests/compiler/project-resolver.test.ts` via `compileVisual`: both SDKs compile without evaluation; helper type error is raw `TS2322`, exact canonical helper path, line2/column14; mapped origin preserves path/owners/location. Direct package helper error also maps. Unknown/fileless diagnostics stay unmapped. Repeat identical source yields equal compiler sourceHash; raw helper change changes it. | Worker / contained CPU compilation; reviewer / result validation | `compiler-setup.json` (OS, executable/dependency paths/versions, source SHA, executor), `compiler-project.log`, exact input source JSON/hash, complete raw CompileResult JSON and separately mapped JSON. Never only a summarized PASS. |
| Compatibility and integration handoff | Exact C02 integrated API source or recorded unchanged baseline, no reserved edits; required dependencies available | Focused project runner and both `tsc` configurations exit0; real compiler tests have no skipped criteria. Independent reviewer checks full file inventory and this plan's meaning. Coordinator repeats required affected tests at combined integration SHA after serialized merge authorization. | Worker / submission; independent reviewer / acceptance; coordinator / later integration | `typecheck.log`, `git-diff-check.txt`, exact submitted SHA, fresh review/dispositions and later distinct target-SHA evidence |

The quota ledger must distinguish overlapping bounds: e.g. source schema can reject the 33rd file before the new resolver sees it; that is valid reuse evidence, not proof of new byte accounting. To reach 2 MiB RGBA while staying within 1 MiB original bytes, use bounded compressed PNG fixtures with recorded decoded dimensions; BMP alone cannot establish that setup. Exact v2 JSON/request limits may be unreachable with all stricter current source/media limits simultaneously; preserve owners' checks and record that relation instead of fabricating a passing over-limit envelope.

Later commands, executed only with a separately authorized leaf and matching recorded setup:

```powershell
& 'C:/Program Files/nodejs/node.exe' --test tests/project/library-pins.test.ts tests/project/resolver.test.ts
& 'C:/Program Files/nodejs/node.exe' scripts/test-project-cpu.mjs
& 'C:/Program Files/nodejs/node.exe' --test --test-concurrency=1 tests/compiler/project-resolver.test.ts
$env:COREPACK_HOME='C:/Users/zFlei/repos/lux/.worktrees/_tooling/corepack'
& 'C:/Program Files/nodejs/corepack.cmd' pnpm run typecheck
```

Set `LUX_COMPILER_DEPENDENCIES` only to the coordinator-verified existing dependency root; the integration test reads it as existing compiler tests do. Do not assume the absent planner-worktree `node_modules` exists. Do not install to make the planning record green. No public compiler API or trusted supervisor replacement is part of this leaf; if that existing setup is unavailable, report the compiler criterion incomplete and ask the coordinator for a bounded environment disposition.

## Source inspection ledger and remaining gates

All source observations below were made in the exact baseline checkout above; scratch `source-hashes.json` records SHA-256 for the cited files. These are static inspection facts, not new test results.

| Source | Fact used by this plan |
| --- | --- |
| `packages/core/src/project/contracts.ts:13`, `:152`, `:158`, `:215`, `:227` | Existing limits, metadata return type/admission and complete package/definition cycle/closure checks |
| `packages/core/src/project/contracts.ts:127`, `:137`, `:144` | Existing versioned metadata, inventory and package hash ownership |
| `packages/core/src/project/bounded-json.ts:135`; `metadata-paths.ts` | Own byte-record copying and canonical path grammar; no physical provenance |
| `apps/build-worker/src/source-policy.mjs:1` | Envelope validation, canonical source ordering and actual source/asset/JSON quotas |
| `packages/assets/src/index.d.mts`; `index.mjs`; `limits.mjs` | Original media APIs, pure decoder admission and dimensions/byte/RGBA policy |
| `apps/build-worker/src/worker.mjs:36`, `:47`, `:103` | Babel static import resolution and actual structured TS diagnostic extraction |
| `apps/build-worker/src/compile.mjs:36` | Public compile entrypoint, Windows setup requirement and contained execution; compiler result is distinct from runtime validation |
| `packages/runtime-contracts/src/index.ts:29`, `:38` | Existing SourceBundle and CompileDiagnostic fields |
| `packages/visual-sdk/src/metadata.mjs:1` | Existing three allowed bare import names |
| `tests/compiler/compiler.test.mjs`; `parameter-compiler.test.mjs` | Existing real contained compiler fixture patterns and helper diagnostic expectations |
| `tests/project/fixtures.ts`; `scripts/test-project-cpu.mjs`; `package.json`; `tsconfig.json` | Existing metadata fixtures intentionally have synthetic source/image claims; pure runner discovery and pinned toolchain/typecheck commands |

Routine design decisions proposed for delegated approval: separate raw document/content maps, opaque copied snapshot, strict owner-relative transitive import checks, shared package-file multiple origins, sequential temporary decode/verification, internal comparison keys and mapped-diagnostic wrapper. They introduce no reserved contract mutation. Source inspection found no required shared API change for this approach; a reviewer finding one must return its exact interface requirement to the coordinator before code is touched.

Remaining gates: fresh independent critique of this plan and recorded findings/dispositions; freeze the R3a leaf specification and exact ownership; establish compiler setup/source revision at execution; independent implementation review and separate integration evidence. Native acquisition, trusted offline type packaging, service DTOs, persistent acceptance and full filesystem Slice 3 consumer integration stay open. A passing R3a result establishes only the pure resolver and existing compiler CPU boundary on the tested source and setup.
