# Background reference render results — 17 September 2026

User authorized execution after the earlier blind-source handoff. This record
supersedes its no-tests status, without claiming full acceptance or independent review.

Both bundles pass TypeScript checks and Lux's CPU source compiler. All five
authored geometry/field-contract tests pass. Fixed missing TypeScript return
type information for three WGSL vec4 color results in Fiber-Optic Heart.

Actual Studio builds ran in hidden windows with unique studioTestEnvironment
profiles. The regular Studio compiler, admission and WebGPU renderer were used.
Only test-window presentation was hidden; the user's profile was not selected.
No Library publication, merge or dependency installation occurred. A local
node_modules junction reads the existing pinned dependencies without changing them.

## Captures

- Fiber-Optic Heart: `artifacts/background/fiber-1789621822584/frame-0.png`
  and `frame-1.png`; capture times 7.8147 and 9.8524 seconds. Paired JSON files
  record controls and immutable revision metadata. Neon, broad ribbons, pulses,
  collars and dust render. Some strip joins are visibly angular.
- Pigment Rivers: `artifacts/background/pigment-native-1789621956156/frame-0.png`
  and `frame-1.png`. Paired metadata and status identify the runtime and controls.
  Broad bands, ink, contours and paper effect render. The appearance is more
  regular and graphic than the painterly reference; it needs artistic iteration.

Both captures are 1920x1080. A preview scale interaction did not establish a
low-resolution capture and caused a stale runtime capture in the first painting
attempt. Removing that interaction produced a successful native-resolution run.

Fiber saved before its reopen attempt failed with `Visual initialization stopped
making progress`. Do not claim successful reopen. Pigment's later native run
captured and saved without faults; reopen was not attempted in that run.
The initial harness also attempted a build during startup; it now waits for an
accepted startup frame before replacing source. All owned test apps were closed.

The repeatable harness is `scripts/render-reference-previews.mjs`, supplied a
prepared JSON bundle and an output label. Its report records observed checks.
CPU compile results are stored in `artifacts/background/{fiber,pigment}-compile.json`.
No native input, full control matrix, performance guarantee, invalid-edit
preservation, independent review or release acceptance is claimed.

## User workflow correction

Do not treat the GPU as a single exclusive slot. Proceed with isolated background
renders and coordinate only if an actual resource conflict appears. This corrects
the unnecessary serialized waiting in this test run. Receipt: LUX-P117,
`56dda7a5-8906-4d92-a7f2-358db35a61e9`.
