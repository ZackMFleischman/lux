# Distinct installed-source QA fixtures

The triangle and ring are separate saved Lux scenes with different geometry,
colors and source hashes. Each imports a required `palette.ts` module. The
compiler regression verifies complete scene admission and compilation/linking,
then proves removal of that helper fails. This is source dependency closure,
**not required image-asset coverage**.

Run `node --test tests/compiler/export-fixtures.test.mjs` for CPU compilation.
Run `node scripts/prepare-installed-qa.mjs` after preparing current compatible
native/render-host binaries to create two validated packages under
`artifacts/installed-package/qa-fixtures`. It does not install anything or launch
graphics. `result.json` identifies both packages and their shared pinned runtime.

Intended host observation: cyan rotating triangle versus gold ring, both moving
horizontally over navy. Intensity changes brightness. These descriptions express
the fixture intent; actual GPU/host observation is a separate gate. Host schema
defaults remain 0.5 even though the saved source documents use 0.8.

Later host QA installs both named sources with Resolume closed, runs one of each
on separate layers, checks independent controls, then saves/reopens with Studio
absent and all Lux processes initially stopped. Retain the original installed
source and saved composition. Do not count duplicate-copy evidence as evidence
for two different exported implementations.

## Required asset gap

The SDK declares `VisualContext.assets`, but source admission only accepts `.ts`
module text, the saved-scene schema has no asset manifest/blobs, and the current
release inventory permits only its manifest and linked transport file. Supporting
a real required image asset needs bounded asset admission, immutable content
identity and bytes, compiler/runtime resolution, save/export closure and failure
tests. An unused file next to the package or a TypeScript palette is not a pass.
This remains a tracer requirement; the fixture pair does not waive it.

## Required image fixture prepared

`required-image/scene.lux-scene` is a version 2 fixture for the parallel asset
pipeline. Its 3 by 2 BMP contains red/green/blue above cyan/magenta/yellow,
including nonzero row padding. `visual.ts` requires that asset, decodes it through
the submitted `bmp.ts` helper and assigns its pixels to the plane's DataTexture.
There is no fallback pattern or pixel constant in the submitted TypeScript.

`node --test --test-isolation=none tests/assets/required-image-fixture.test.mjs`
checks decoder agreement, missing-asset failure, material/texture ownership and
disposal using CPU renderer substitutes. Independent review approved this bounded
fixture. Real compiler/link, native six-region capture, restart, export and offline
installed playback remain separate gates; the fixture is not yet a working export.

## Current checkpoint — 13 September 2026 UTC

The asset-gap sections above describe earlier checkpoints. Source v2 now admits
bounded BMP, PNG and JPEG originals, and immutable exports include their bytes.
The runtime exposes decoded top-down, straight-alpha sRGB pixels through
`context.images`. The triangle/ring pair still does not exercise image assets.

Real Studio PNG/JPEG workflow and the installed PNG source's native RGBA,
Resolume transparency and composition reopen checks have passed. See
[image evidence](../../../evidence/tracer-0.1/parameters-images-studio/installed-alpha.md).
The separate SDK 0.2 sphere package has five code-defined controls and is installed
for host QA; this does not upgrade the legacy triangle/ring parameter contract.
See [sphere evidence](../../../evidence/tracer-0.1/parameters-images-studio/installed-sphere.md)
and the current [progress table](../../../PROGRESS.md) for remaining host gates.
