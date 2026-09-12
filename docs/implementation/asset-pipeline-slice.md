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
