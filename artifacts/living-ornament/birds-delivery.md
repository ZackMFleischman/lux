# LUX-175 companion birds

Two flocks (a pair and a triplet) follow the existing animated ribbons. Projected 3D helical positions vary depth/scale and disappear behind ribbon ink. Ink silhouettes have orange or teal breasts, small eyes and beaks, independent wingbeats and glide intervals. One curious companion in each flock leaves to perch on a moving shape, folds its wings, extends its feet, looks around and rejoins flight. Facing follows actual travel direction.

Birds controls: Subject size (zero hides), Flight speed (continuous accumulated clock), Spiral radius, Perching excursions. Shared artistic time obeys play/pause/reset. The renderer adds five small transparent patches, disposes their shared geometry and materials, and queries the painting's exact ribbon/shape helpers. No SDK or architecture changes.

Existing user parameter values (including seed48 and pace2.18) were preserved. Ten Library links remain. The renderer is forked locally for this scene-specific addition; existing published renderer and prior Finished scene remain untouched. Saved Companion Birds scene contains complete source and the ten links.

## Visual iteration and evidence

Initial birds-1789574531050/result.json:59.87FPS, full flight/perch cycle. Fixed exaggerated wing banking/possible patch clipping, moved the high pink perch to a visible yellow contour, tightened route extents to keep subjects in frame, and corrected transparent edge blending. Polished birds-1789574954078/result.json:60.79FPS at1080p, frames6/15/25/32/40 show flight, perching and departure; exact source/link save/reopen passed. Independent review additionally corrected speed-dependent heading prediction; default1x appearance is unchanged.

Final targeted result is linked below after completion. Native full-window chrome was not captured; evidence is actual Lux canvas plus runtime control/source metadata. Three-dimensional motion is projected stylized flight around planar artwork, with ribbon occlusion; the painted scene itself remains flat.

Final exact-source check: birds-1789575134015/result.json, ok:true. Observed61.50FPS in a20-second sample (configured60FPS); flight/perch captures6/25, live speed0/2 control checks, exact source and ten-link reopen, normal playback restored. Review: lux-175-independent-review.md.
