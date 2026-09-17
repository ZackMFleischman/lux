# Main integration

The portable flare package and its two published Library entries are integrated together. The active desktop solar scene is unchanged by this repository integration.

Canonical entries:
- Layered Optical Flare: `8e164579-b8cf-4daf-9891-be59630e91e3`, revision 1.
- Webb Diffraction Star: `cff54fa9-b913-43bf-aeee-626d4e1f8968`, revision 1.

`build-bundles.mjs` regenerates the component wrappers and runnable studies. `verify.mjs` now resolves Playwright through the repository package hierarchy instead of assuming a nested worktree path.

The original isolated installed-Studio verification is preserved in `evidence-1789627510046/result.json`, alongside its two 1920×1080 composite captures. Paths in that report identify the original executor checkout. These are original render results, not a new GPU test of main. Integration checks regenerate bundles and compare their helper and wrapper contents with the published immutable Library revision.

The two composite captures show restrained optical ghosts and fine six-ray diffraction against a colored background. No Orion placement or solar-scene attachment is implemented by this package.
