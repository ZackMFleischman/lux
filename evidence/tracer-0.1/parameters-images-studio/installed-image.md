# Installed image: bounded native fixture

13 September 2026 UTC, run `48543b02-8dea-4113-a518-2f219e4aa2b0`. **Functional native fixture passed; actual Resolume and performance acceptance remain pending.**

An exported Studio scene was installed in a private profile and registered in a private plugin folder. The native FFGL fixture activated its bundled installed renderer with Studio closed. The installed module audit allowed package-local modules and Node builtins; it found no development-module lookup. This is not a system loader trace or a physically absent-checkout test.

| Observation | Result |
| --- | --- |
| Package release | `2545b762f774c1b046f576d7e61745765876f6ec6dc4f06410c5c998d52573c2` |
| Runtime | `8205289821b2dc3185a691664749a7e7b191bb269bbbef1533a99883ae7fb539` |
| Pixel samples, top-down quarter positions | `[187,187,255,255]`, `[0,255,0,255]`, `[255,255,255,255]`, `[255,255,255,255]`; exact Studio reference match |
| Native capture SHA-256 | `d5e4d32f7ad74e28cafd3da1862a0f1fedce7075c7210af0c0519921f5975c2e` |
| First output after first native callback | 4,405.5242 ms, measured in native QPC; no file-cache clearing |
| Recorded source callbacks | 343; summary reports zero lost records |
| Exit | Fixture exit 0; outer job confirmed descendant cleanup |

Root visually inspected the captured grid. PNG and oriented JPEG originals are pinned in the release; this particular scene draws the PNG over a white scene background with saved `backdrop=1`. It does not exercise JPEG pixels, transparent host composition, live FFGL parameter gestures, multiple instances, composition persistence or restart recovery. Worker-to-compositor frame correspondence is unavailable and is not inferred from the current control snapshot. The 10-second fixture is not the 300-second acceptance workload.

Exact native package bytes matched the integration native build from `d302558`. Packaged worker includes the capture-alpha correction and predates scheduler-only `60297e1`. The test used those immutable package bytes. The native graphics adapter reported NVIDIA GeForce RTX 2070, OpenGL 4.1, driver 591.44.

Reproduction scripts, authorized inventory, package preparation, raw logs, `inspection.json`, `host.png` and experiment manifest are retained locally at `.worktrees/parameter-integration/artifacts/installed-native-review-2545b762/`. Its `README.md` describes the exclusive reviewed run. CPU-only private installation separately passed shared-supervisor and idle-exit checks: ready in 2,336 ms and exited after 32,435 ms. Installation copying took 28,332 ms, separate from playback startup.
