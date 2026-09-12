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
