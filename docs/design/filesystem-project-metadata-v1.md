# Filesystem project metadata v1 foundation

This addendum records the coordinator's Task 1a concretizations of [filesystem projects](filesystem-projects.md). It describes the pure metadata implementation only. It does not publish directory operations, resolver/compiler integration, acceptance, sessions or Studio capabilities. The rest of implementation Slice 1 remains open.

`packages/core/src/project/contracts.ts` owns strict `ComponentRef`, `ProjectManifest`, `SceneFile`, `ComponentFile`, `AssetManifest`, `DependencyLock`, `PackageManifest` and `CodeExport` schemas and their derived types. Neutral entity/revision UUID brands live in `packages/runtime-contracts/src/identities.ts`. Record keys validate UUID syntax; entity fields carry the corresponding brands. IDs are never derived from names, folders or hashes. Revision UUID allocation and session capabilities belong to later services. `SavedControlIntent` is an alias of the existing `SavedControlSnapshot`; output settings, hashes, SDK selection, control normalization/hash verification and supported asset paths/codecs reuse their current owners.

## Admission and authority

`validateMetadata(kind, input)` and individual schemas perform synchronous, strict own-data shape validation and relationships within a document. They are not persisted metadata admission. `admitProjectMetadata(documents, supportedToolchain)` takes a record of metadata-relative paths to raw `Uint8Array` bytes. It parses the complete manifest set, rejects extra/missing metadata documents, validates registry IDs, all local/package/export/asset/provenance links, pin claims, cycles and SDK/envelope compatibility, and awaits `verifySavedControlSnapshot` for every scene. A valid older `sourceHash` cache is retained unchanged; this operation never attributes that cache to newly authored source.

`supportedToolchain` must come from the caller's installed, verified runtime/declaration selection. Admission requires exact agreement with that supplied selection, including variant entries and all hashes/versions. Passing the project's lock back as evidence of installation would violate this API precondition. This pure module does not determine local availability or verify declaration bytes. Consumers must supply that evidence from the later trusted tooling boundary.

The document map contains `project.json`, `assets/manifest.json`, `dependencies.lock.json`, each registered `scene.json`/`component.json`, and each pinned `libraries/<contentHash>/package.json`. It deliberately contains metadata only. Unused registered definitions and exports still undergo admission; scenes can independently use SDK 0.1.0 or 0.2.0, but each reference closure uses one SDK. Every export/definition retains explicit sourceVersion 1 or 2, including empty assets. A v1 entry cannot acquire images through a transitive reference. No SourceBundle reconstruction occurs yet; the eventual v1 envelope omits sourceVersion and v2 retains it.

Native path containment, complete source/original-image inventory capture, raw source/image/declaration hash verification, decoding, source import resolution and compiler sourceHash remain later boundaries. Lexical paths or metadata hashes grant no permission. Source byte quotas, decoded dimensions/RGBA quotas and vendored source byte quotas cannot be proven from metadata alone. This code enforces available entity/file/binding counts, original-asset declared lengths, and transitive compiler file/image binding limits without claiming pixel validation.

## Bounded JSON and paths

Exported `metadataLimits` fixes raw document and aggregate project metadata at 1,048,576 bytes, nesting at 32 containers, total value nodes at 65,536, decoded string values at 65,536 UTF-8 bytes and decoded object keys at 240 UTF-8 bytes. The root counts as a value node. Arrays/objects each count once, as do their contained values. Object keys have a dedicated decoded-byte limit and **do not** count as value nodes. A root container has nesting depth one; a primitive has zero. Limits accept equality and reject the next byte/node/container.

The parser rejects BOM, fatal UTF-8 errors, lone Unicode surrogates, nonfinite numbers and duplicate decoded keys (including escaped-equivalent names) before assignment into a null-prototype object. JSON.parse is used only to decode an individual bounded string token; it never constructs metadata objects. Direct JavaScript input is captured through enumerable own data descriptors, with dense ordinary arrays and plain/null-prototype records. Getters, inherited values, custom array members and unsupported values are rejected. Byte snapshots use typed-array internal contents, without caller iterators or getters. Arbitrary JavaScript Proxy-trap immunity is not claimed; raw JSON bytes are the primary wire format.

Paths are relative slash-separated ASCII, at most 240 characters, with closed alphanumeric/underscore/hyphen segments and supported file suffixes. Absolute/drive/UNC/device paths, traversal, backslashes, reserved Windows names, colons, trailing dots/spaces and case-colliding paths are rejected. Scene/component registries are namespace-confined, unique and nonoverlapping, including an ancestor separated by another sibling in sort order. Full prefixed module/metadata paths also satisfy the bound. TypeScript paths inherit the compiler's `.ts` grammar and reserved `__lux` prefix. These checks are lexical; the later native boundary must establish physical-root containment and safe handles.

## Initial exact package grammar

The implemented metadata shape is:

```ts
type PackageManifest = {
  format: 'lux-package'; schemaVersion: 1;
  packageId: string; version: string;
  sdkRange: '0.1.0' | '0.2.0' | '0.1.0 || 0.2.0';
  exports: Record<string, CodeExport>;
  files: Record<string, Hash>;
  assets: AssetManifest['assets'];
  dependencies: DependencyLock['packages'];
};
// Same authored source metadata as ComponentFile, without schemaVersion/ID/name:
type CodeExport = Pick<ComponentFile,
  'kind' | 'sdkVersion' | 'sourceVersion' | 'entry' | 'files' | 'references' | 'assets'>;
```

`packageId` has two lowercase ASCII segments separated by `/`; each segment matches `[a-z][a-z0-9-]{0,63}`. Export IDs use existing control-ID grammar `[a-z][A-Za-z0-9_]{0,63}`. Versions have three nonnegative decimal integer parts, no leading zeros, tags, ranges, prereleases or build suffixes. These are the initially supported exact metadata grammars, not arbitrary npm semantics. SDK range membership must include each export's authored SDK. Packages cannot reference local components, and other packages require matching declared dependency pins in the project lock. Cycles fail. No packages are installed, fetched or executed.

`files` is the package's original file hash inventory (relative to its package directory); export files must be declared `.ts` members. Other original files, such as licenses, can be retained and hashed without becoming compiler modules. Asset file hashes must agree with asset descriptors. Original assets retain ID, hash, byte length, provenance and `srgb`/`straight` interpretation, with BMP/PNG/JPEG extensions matching their media types. Logical image bindings reuse `assets/*.bmp|png|jpg|jpeg` path admission. There are no inline base64 project assets. Metadata's claimed asset sizes remain claims pending decoder admission.

## Versioned identity bodies

SHA-256 operates on UTF-8 JSON arrays. Object keys sort by JavaScript code-unit order recursively; arrays preserve order. The encoder emits object members directly, so integer-like names such as `10` and `2` retain that lexical order instead of JavaScript's numeric property enumeration order. Numeric semantic metadata normalizes negative zero. Raw file bytes never normalize, and compiler sourceHash uses its existing algorithm unchanged.

| Operation | Exact body |
| --- | --- |
| `hashInventory(rawFiles)` | `['lux-project-inventory', 1, [[path, rawSha256], ...]]`, paths sorted |
| `hashMetadata(kind, value)` | `['lux-project-metadata', 1, kind, canonicalValidatedValue]` |
| `hashPackage(manifest, fileHashes)` | `['lux-project-package', 1, canonicalManifest, [[path, rawSha256], ...]]`, paths sorted |

Metadata kinds are `project`, `scene`, `component`, `assets`, `lock` and `package`. A scene semantic hash also verifies the saved-control schema hash. Package hashing requires exact membership/hash agreement between its supplied hash inventory and manifest `files`; full metadata admission verifies its computed semantic manifest hash and package content hash against the pin. This computes identity from supplied claims, not evidence that source/image bytes have been captured. Inventory hashing preserves CRLF/LF and all other byte differences, but makes no completeness claim. There is no generic arbitrary-object authority hasher or candidate identity in this slice.

## Remaining contracts and validation

BufferStatus, discovery/locations, reference-index/diff, JobState, StoredCandidate, derived AcceptedScene and full stage/apply result shapes remain explicitly deferred to a reviewed follow-up contract slice. AcceptedProject persistence/allocation and session capability issuance are also absent. Consumers must not invent or import permissive placeholders.

Run `node --test tests/project/contracts.test.ts` or `node scripts/test-project-cpu.mjs`. The runner recursively collects only `.test.ts`/`.test.mjs` beneath `tests/project`; package.json integration remains later work. These CPU tests do not attest to native filesystem, renderer, offline packaging or full-project acceptance.
