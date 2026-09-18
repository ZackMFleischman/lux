# Feeding Quasar

`visuals/Quasar.lux-scene` is the saved, runnable scene. Its root contains a
Starfield, Orbiting Worlds, and one Quasar composition. Open **View inside** on
Quasar to see its camera controller, lensing, jets, disk renderer, and bloom.

The source packages in `components/` correspond to those boundaries. Quasar's
published package owns `quasar.ts` and `accretion-disk.ts`; its Library dependencies
are mounted beneath `camera-controller/`, `lensing/`, `jets/`, and `bloom/`.
The saved scene embeds that complete source tree and pins its Library revisions.
Edit the source in Lux, or mirror these package files into their mounted paths.
The tuned starfield is scene-local so these defaults do not change existing
users of the shared Cosmos Starfield.

The disk integrates a bounded, approximate bent ray through the world. Planets,
their rings, and the sparse asteroid belt intersect that same ray, so a planet
can pass behind the black hole and form stretched lens images. The old separate
foreground/background images and their crossfade are gone. Lensing and jets are
shader fields for compatible 3D renderers; bloom is a general image effect.

CameraController adds six offsets to the authored camera pose each frame. It
does not accumulate transforms into the base pose. Left drag orbits, right drag
or Shift-left drag pans, the wheel dollies, and Alt-left drag rolls. **Reset
Camera** zeroes those six offsets. The scene's framing, viewing angle, composition
tilt, and drift remain authored controls.

Broad rotating density waves and hot patches make the disk's motion visible
without losing its finer turbulent detail. **Large flow structures** controls
their contrast. **Disk spin** controls their motion and the differential detail.

Performance is bounded by 96 ray segments, with two plasma samples per segment.
Rock intersection tests run only near the belt's plane. Field components add no
render passes: the scene renders the starfield, quasar, and bloom.

This is a cinematic approximation, not a quantitative relativistic simulation.
Lensed bodies can form multiple stretched images; there is no layer crossfade.
The camera gestures activate for a connected CameraController whose six offsets
are exposed. Other 3D renderers must consume that camera contract explicitly.

The scene preserves all 33 tuned values. Its 27 authored values are also source
defaults; the six manual camera offsets default to zero so Reset Camera returns
to the authored pose. The scene uses names such as `quasar`, `disk`, and
`camera-to-disk` for graph nodes and edges. Library revision identities remain UUIDs.

Validated in desktop build `57a7088b-c1f26eb0`: real preview orbit and reset,
save/reopen with all 33 values intact, three root components and five nested
Quasar parts, and sustained 1920×1080 animation without a runtime fault.
See [validation evidence](evidence/validation.json),
[root graph](evidence/root-ui.png), and [Quasar graph](evidence/components-ui.png).
The keyboard modifier mappings also have focused Studio tests; native automation
verified left drag, wheel, and reset, not every modifier gesture.

Visual references: [NASA's warped-world visualization](https://www.nasa.gov/universe/nasa-visualization-shows-a-black-holes-warped-world/)
and [magnetic funnel illustration](https://science.nasa.gov/asset/hubble/magnetic-funnel-around-a-supermassive-black-hole/).
No reference images are embedded in the scene.
