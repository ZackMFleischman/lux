# Cosmos flare components

Independent creative worktree: `codex/cosmos-flares`.

Two independently reusable SDK 0.4 transparent image sources:

- **Layered Optical Flare**: hot point core, softly tinted aperture ghosts following the source–image-center axis, varied circular/rounded-hexagonal ghosts, optional subdued horizontal streak.
- **Webb Diffraction Star**: six primary tapered rays, a separately adjustable faint horizontal pair, soft core and faint near-core ring. A visual approximation, not a calibrated optical point-spread function.

`*-component.json` is the Library source bundle. `*-visual.json` is a runnable standalone study with an opaque near-black backing so low-alpha PNG quantization does not obscure faint gradients. The published source itself has no backing. `build-bundles.mjs` regenerates these readable wrappers from the shared helper. `verify.mjs` owns and closes only its unique test-profile Studio process; never selects the user's desktop session.

## Scene-local integration (SDK 0.2 or 0.4)

Copy `flare-rig.ts` into the source bundle. Create once:

```ts
const star = createFlareRig('diffraction');
scene.add(star.root);
```

After final camera placement each frame:

```ts
star.update(camera, worldLight, {
  brightness: 0.55,
  visibility: 1,
  scale: 0.055,
  tint: paleBlue,
  rotation: 0,
  secondarySpikes: 0.08,
});
```

`scale` is relative to screen half-height and does not change with world distance. `visibility` is the caller's occlusion/reveal envelope; these optical artifacts intentionally ignore the scene depth buffer. Do not show a flare when the source is obscured. The helper fades smoothly near the frame edge and rejects sources behind the camera. Call `dispose()` when removing it.

For optical flares also set `ghosts` (0–3) and `streak` (0–1). All controls are numeric and available to existing Lux modulators. The helper owns no wall clock, autonomous flash, or temporal flicker. Avoid feeding raw high-frequency audio into star brightness; use a slow envelope if modulating.

## Restrained cosmos integration proposal

Preserve the current small stars. Give them a stable mix of near-white, pale ice blue, faint ivory, and rare warm amber. Add diffraction only to a handful of bright stars, with approximately 0.025–0.06 scale and 0.2–0.65 brightness. No global twinkle; if desired use only a few percent of slow 12–30 second variation.

Attach sky directions to a coherent distant sphere: `worldLight = cameraWorldPosition + fixedDirection * skyDistance`. Camera translation then does not distort the sky; rotation moves the whole constellation correctly. Use one orientation transform for all catalog positions, never independently reposition constellation stars to fill the frame.

Reserve a stronger optical flare for a bright off-axis source or sun rim during a slow camera phrase. Reduce its visibility as it approaches the center so it never washes out the hippo. Start with ghosts 0.2–0.4, streak 0, scale 0.16–0.24. The sun remains the focal subject.

Orion is a strong next detail: a restrained warm Betelgeuse, blue Rigel, three belt stars, and a tiny diffuse sword nebula. Keep the actual relative arrangement and omit connecting lines by default. No constellation has been added to the live scene by this package. A catalog-backed whole-sky placement should be a separate integration edit rather than a made-up ornamental pattern.

## Reference basis

- NASA, [Webb's diffraction spikes](https://science.nasa.gov/asset/webb/webbs-diffraction-spikes/): hexagonal optics and support-strut contributions.
- ESA/Webb, [FAQ](https://esawebb.org/about/faq/): six large rays are associated with primary-mirror hexagonal symmetry; the additional pair is intentionally subtler here.
- NASA, [Orion constellation](https://science.nasa.gov/asset/hubble/orion-constellation/): warm Betelgeuse upper-left and blue Rigel lower-right in the conventional chart view.
- CDS/SIMBAD, [Alnilam](https://simbad.cds.unistra.fr/simbad/sim-basic?Ident=Alnilam): authoritative catalog coordinates for eventual spherical placement. Use the corresponding catalog entries for the other stars when implementing that placement.

The active solar scene and its files were not touched during this component development.
