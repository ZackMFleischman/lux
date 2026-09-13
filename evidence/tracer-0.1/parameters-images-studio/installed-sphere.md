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

## Actual native rendering

Reviewed run `08dadd7d-ff77-4090-a1f7-6b7f063dfdd1` activated this exact package
in the normal native diagnostic host with a fresh private profile. No control
gestures or failure injection were enabled. The 10 s work/30 s outer limits and
231 recorded input hashes were independently checked before launch.

The fixture returned a fresh 1920×1080 RGBA capture, reported 339 final callbacks,
exited 0 and confirmed outer cleanup. Its last periodic counter reported 332
callbacks and 107 consumed frames; that sample is not the final total. Total supervised
operation was 15,480.3433 ms. The inspector found nontransparent/nonconstant
output with no native failure record. Root viewed the converted PNG and observed
the expected purple spiky sphere on a dark background. Final process inventory
contained no Studio, Resolume or installed renderer process.

Artifacts: `C:/Users/zFlei/repos/lux/.worktrees/multicontrol-package/artifacts/sphere-native-render/`.
Inspection SHA-256:
`47d892f17ccdbf6e56c053e968052cdbef13fccfb09f3b45a699fd9f292ef4a8`.
This validates functional installed native output, not actual Resolume gestures,
composition persistence, GPU resource accounting or performance budgets. The
user explicitly deferred the separate five-control Resolume check.

Independent raw-log review found no faults or retries. Release source/linked/schema
identities and all five initial values match the package's float32-normalized
FFGL mapping. Producer summary reports `closed: true`, `failed: false`; receiver
opportunity sequence is contiguous with zero reported loss. Child QPC duration
was 11,511 ms; first present output was observed 5,670 ms after child start.
These are short-run startup observations, not quantitative acceptance. The
attempt has a normal stop request but no independent exit record; outer Job
cleanup and root's subsequent no-process check establish the stated cleanup.

Raw review: `artifacts/sphere-native-render/actual-log-review.json` in the worktree
above. PNG SHA-256: `ea3a671dbeb1b9b8206d872963637e1b90f5f0ddf30e8f702ea7030bda10188d`;
raw RGBA SHA-256: `923862fa05de0c3547cd8be965cf74e9baa5b0f88b9574e53d9800bdf8f0528b`.
