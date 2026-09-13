# Installed alpha and control checkpoint

On 13 September 2026 UTC, reviewed diagnostic `f100c7f` plus inspector `ba4f923`
passed one supervised native run with Studio and Resolume closed. Integration
commits are `8a10134` and `a800294`. The test reused the unchanged image release
`2545b762f774c1b046f576d7e61745765876f6ec6dc4f06410c5c998d52573c2`
and runtime `8205289821b2dc3185a691664749a7e7b191bb269bbbef1533a99883ae7fb539`.
This runtime predates the latest liveness/sampling changes; this is image/control
evidence, not validation of those later runtime changes.

The native fixture first observed the expected PNG over white. It then called
the actual FFGL setter for parameter 0, Backdrop, with normalized value 0,
mapping to authored value -1. After setter success it required actual transparent
pixels, then rechecked the final full readback. Top-left/right, bottom-left/right
raw premultiplied encoded-sRGB RGBA matched exactly:

| Position | Expected and observed |
| --- | --- |
| Top left | `[0, 0, 128, 128]` |
| Top right | `[0, 255, 0, 255]` |
| Bottom left | `[0, 0, 0, 0]` |
| Bottom right | `[64, 64, 64, 64]` |

Run `002bc611-9aa3-4a0e-b5dc-777a8d1712d6` exited 0 without timeout. Native
deinstantiation/deinitialization succeeded; the outer Windows Job confirmed
cleanup. Draw/capture work took 4,286 ms including source startup; the whole
supervised operation took 8,664 ms including preflight. These are not measured
control latency, physical fault-stop timing or normal idle-supervisor lifetime.
GPU: NVIDIA GeForce RTX 2070. No concurrent graphics test ran.

Artifacts are under
`C:/Users/zFlei/repos/lux/.worktrees/native-alpha-probe/artifacts/native-alpha-review-2545b762/`:
`review-authorized.json`, `last-experiment.json`, `inspection.json`,
`final.rgba.alpha.json`, `final.rgba`, `host.png` and the run's manifest/logs.
Raw capture SHA-256:
`7d79b03f23afcc75d4c4f0cd45ae6f7cf1f0e7a2436042da29a797b04be085d6`.
Inspection SHA-256:
`fea44f5084604eee395594e2318c5bc5bd4dd4034fa41a4091f02f9218708c6a`.

The PNG preview divides encoded RGB by alpha and canonicalizes zero-alpha black;
the acceptance comparison uses original native premultiplied bytes. Three CPU
inspector tests reject stale white output, wrong alpha/premultiplication, stale
capture identity/timing and failed cleanup. The native matcher was also compiled
and CPU-tested independently. Actual Resolume composition, JPEG rendering in the
host, multiple live controls, updated-runtime recovery, complete GPU cleanup and
performance gates remain separate.
