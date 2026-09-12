# Versioned source, scene and compiler asset slice

This implements the CPU boundaries in `required-assets.md`; Studio/runtime/export
activation remains gated by the companion integration work. No graphics or native
actions, dependency changes, or installed playback claims are part of this slice.

1. Add strict legacy/v2 source and artifact DTO unions, preserve legacy admission
   and hashes, canonicalize v2 source in ASCII order, and enforce compact budgets.
   Pair scene versions and provide `createSceneDocument(source,settings,controls)`.
   Verify malformed assets, unknown fields/version pairs, saved bytes and conflicts.
2. Share artifact/linked identity bodies between workers and parents, derive and
   verify embedded assets, and pin the asset and identity helper bytes in both
   compiler/linker dependency inventories. Bound JSON reads before parse with fatal
   UTF-8 decoding and preserve all current output/deadline limits.
3. Run CPU source/scene/schema tests and contained compiler/linker integration,
   including byte-only changes, forged/deleted metadata/assets, helper-only byte
   changes, and unchanged legacy canonical vectors. Commit reviewable boundaries.

Contracts keep existing `SourceBundle`/`sourceBundleSchema` union names and export
`LegacySourceBundle`, `AssetSourceBundle`, `legacySourceBundleSchema`, and
`assetSourceBundleSchema`. V2 is exactly
`{sourceVersion:2,sdkVersion:"0.1.0",entry,files,assets}`. Artifact v2 adds
`artifactVersion:2,assets,assetSetHash`; linked v2 starts with `linkedVersion:2` and
retains assets and assetSetHash. All legacy body ordering remains separate.

The pure browser import for scene construction is `packages/core/src/scene-document.ts`;
`scene-file.ts` re-exports the helper/type while retaining Node-only atomic I/O.

`apps/build-worker/src/artifact-identity.mjs` exports `artifactBody`, `linkedBody`,
`verifyArtifact`, and `verifyLinked`. Verification accepts the same trusted
sync-or-async SHA-256 callback as the foundation. `verifyLinked` also accepts an
already-verified expected artifact and checks bundle, format and asset-set identity.
The body constructors alone are not cryptographic admission. V2 artifact body
ordering is the existing seven fields followed by artifactVersion/assets/assetSetHash;
v2 linked body ordering is linkedVersion/code/sourceMap/bundleHash/linker/assets/assetSetHash.
V2 module, map, dependency and asset keys use ASCII order. Legacy bodies keep their
existing record ordering and exact serializer algorithm.

The compiler parent also derives the expected source asset-set identity, preventing
an internally consistent worker artifact from substituting unrelated assets under
the original sourceHash. The compiler and linker inventories both pin
`assets/index.mjs`, `compiler/artifact-identity.mjs` and `compiler/bounded-json.mjs`.
Worker input, supervisor result and compiler/linker output file reads are byte-bounded
before fatal UTF-8 decoding/JSON parsing; actual request/result JSON is checked too.
No ceilings or process deadlines were increased.

The CPU integration test copies the trusted linker closure to a temporary checkout
and changes only its asset helper bytes to prove the existing dependency verifier
rejects the earlier artifact. It never modifies checkout helpers or node_modules.
Run contained tests with `LUX_COMPILER_DEPENDENCIES` naming the actual shared
dependency directory (not a worktree junction alias); existing declaration pinning
intentionally rejects declarations resolving outside the supplied root.

Deferred: Studio/workspace/session/MCP preservation and authoring activation guards
are companion work; workers do not yet consume assets and exports/transports do not
yet carry them. Do not enable v2 activation or export based on CPU compile/link
success alone. This slice produces no new asset fixture or graphics evidence.
