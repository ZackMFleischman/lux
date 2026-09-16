# LUX-175 independent review

## Verdict

No blocking source, visual, lifecycle, or performance finding remains in the bounded companion-bird change.

## Reviewed scope

- `examples/components/wandering-tracers/ornament-birds.ts`
- bird integration in `ornament-renderer.ts`
- four exposed bird controls in `ornament-composition.ts`
- actual 1920×1080 flight-cycle captures in `birds-1789574954078` and the final speed-control/save/reopen/performance receipt in `birds-1789575134015`

## Findings resolved during review

- The first shader emitted premultiplied RGB under Three's straight-alpha `NormalBlending`, which attenuated antialiased edges twice. The final shader emits straight RGB and retains the expected premultiplied render contribution.
- The first continuous-speed revision predicted heading at a fixed 1× flight rate. The final code passes the live speed separately and advances the look-ahead flight clock by `delta * speed`, matching 0–2× control behavior.
- Flight time is accumulated from artistic-clock deltas, so changing Flight speed no longer phase-jumps the birds. Reset clears that private clock.
- Wing-bank bounds, route extents, perch ownership, ribbon-ink occlusion, destination-facing excursions, and foot reach were tightened before the final capture.

## Source assessment

- Both bird routes reproduce ribbon IDs 9 and 10 with the same angle, amplitude, frequency, phase, second harmonic, seed, and artistic motion inputs. Front/back orbit reads as a coherent loop around the moving ribbons.
- Approach, perch, and departure envelopes are continuous. Perch points are found against the animated region SDF, and heading follows actual displacement before blending to the resting pose.
- Back-half birds are masked through the ribbon fill and ink margin; front-half and perched birds remain readable. Plane bounds contain the maximum wing, tail, and foot silhouette at the supported size/orbit limits.
- The renderer preserves all ten existing graph links. Size zero hides all five subjects. One shared plane geometry and all five materials are disposed by the renderer lifecycle.
- Subject size, flight speed, spiral radius, and perching excursions are grouped, live controls with useful independent effects.

## Actual evidence

- `artifacts/living-ornament/birds-1789574954078/result.json`: `ok: true`; five checkpoints across the cycle; 20.02-second observed rate of 60.785 FPS at 1920×1080; save/reopen and normal playing restoration completed without a fault.
- `flight-6.png`, `flight-15.png`, `flight-25.png`, `flight-32.png`, and `flight-40.png`: the two flocks enter and leave naturally, change apparent depth around both ribbons, remain inside their patches, and include a legible perch without obscuring the painting's focal shapes.
- `artifacts/living-ornament/birds-1789575134015/result.json`: `ok: true`; final source ran for 20.06 seconds at 61.501 observed FPS, exercised Flight speed at 0× and 2×, saved and reopened the ten-link scene, restored normal playback, and reported no fault.
- The final 0× and 2× captures show stable silhouettes and headings at both control limits. Straight-alpha edges remain clean against light ground, dark motifs, and ribbon ink.

## Residual limits

- The birds use deliberate 2.5D compositing: ribbon occlusion is geometric, while bird-to-bird ordering is stable identity order. The reviewed flock spacing makes that distinction visually immaterial in the captured cycle.
