# Five-control sphere export checkpoint

The accepted Studio sphere was packaged with the reviewed health-file contention
fix from stable `683def9`. Root independently validated the resulting immutable
package and its five controls/saved values. No host rendering claim is made yet.

| Identity | Value |
| --- | --- |
| Release | `e8611254431e3544ba01a73e84f0dcecf01b59c057a327a7d9d2c254bfb239f4` |
| Runtime | `db7c70ff2b58e29cd281bd5e2e236266e29d1a6e78d6a3be44f721e8d65f0e90` |
| Source | `cee01f784742b5f445229b1dc2312ac0b4a951cd95e8a9fb0ae0b35e4b5749ab` |
| FFGL identity | `TH01`, Lux Spike Sphere |
| Runtime inventory | 104 files |

Saved values: spike height 0.85, noise scale 8, sharpness 2, motion speed 0.28,
roughness 0.38. Original scene bytes and control provenance were preserved.
The package, privately installed copy and emitted main entrypoint were byte
identical and contained the reviewed transient-rename handling. Registration
was confined to the artifact's private plugin directory.

Artifacts and prepared manual QA instructions:
`C:/Users/zFlei/repos/lux/.worktrees/multicontrol-package/artifacts/sphere-host-qa/`.

## Storage coexistence

A fresh private profile received the older image release `2545b762…` with runtime
`82052898…`, then this sphere release with its distinct runtime. Both installed
releases/runtimes validate. All **107 old installed files**, including manifests,
retain their exact hashes after the second install; both original packages are
unchanged. The new installed files match the new package. The profile contains
exactly two releases and two runtimes, with no instantiated sources.

The implementation agent ran the check; root reviewed its retained verification
script and report. Complete before/after file inventories are in
`C:/Users/zFlei/repos/lux/.worktrees/multicontrol-package/artifacts/installed-coexistence-2545-e861/report.json`.
No runtime/GPU launch, registration, source relocation or network change occurred.
This establishes storage coexistence and immutability. It does not establish
simultaneous playback or execution with the development checkout unavailable.

Root subsequently rehashed all 107 old installed files against the recorded
before-install inventory; every hash and file size matched.

## Packaged supervisor and user installation

The existing `test-installed-package.mjs` passed against this sphere package
using Node 24.12.0. Child Electron ran in **Node mode**, with a fresh private
profile and no source activation: installation took 8,036.92 ms, supervisor
readiness 2,387.29 ms, duplicate-supervisor singleton protection passed, and the
original supervisor exited normally at 32,398.31 ms. These are CPU workflow
observations with warmed/uncleared file caches, not visual startup measurements.

Actual result:
`C:/Users/zFlei/repos/lux/.worktrees/multicontrol-package/artifacts/installed-package/result.json`.
SHA-256: `e48e2c5f3fe105028ab7ce52077a6eb0e2abcd15d66aa2c5c19973328759f995`.
Before/after package validation and installed-copy provenance are in the adjacent
`installed-sphere-node-check/report.json` artifact directory.

After confirming Studio/Resolume and their renderers had exited, root installed
this exact package into `C:/Users/zFlei/AppData/Local/Lux/Installed` and registered
the new **Lux Spike Sphere** source in
`C:/Users/zFlei/Documents/Resolume Avenue/Extra Effects`. Installation exited 0;
FFGL identity is `TH01`, with all five saved normalized defaults in its sidecar.
Existing releases remain installed. This step did not start Resolume or activate
the source; actual host gestures/persistence remain pending.
