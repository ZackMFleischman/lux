# Private installed native fixture

Preparation is complete. No GPU or host has been launched. Everything in this directory is an untracked QA artifact; the registered DLL and sidecar are private to `plugins/` here.

From the integration checkout:

```powershell
# Optional repeat of CPU validation/registration/inventory; regenerates the unauthorized request.
node artifacts/installed-native-review-2545b762/prepare.mjs
node artifacts/installed-native-review-2545b762/inspect-selftest.mjs
```

Review `preparation.json`, `configuration.json`, and `review-request.json`. Copy the request to `review-authorized.json` after review, setting `authorized:true`, a nonempty `reviewer`, `hostClosedConfirmed:true`, and a future `expiresUtc`. Preserve the exact executable, arguments and hashes. Confirm the current Studio QA session has finished. The existing experiment runner still rejects conflicting graphics activity and an occupied global experiment lock. No preparation command invokes the launch entrypoint.

```powershell
# Root/coordinator executes only after the review and graphics isolation checks.
node artifacts/installed-native-review-2545b762/launch.mjs artifacts/installed-native-review-2545b762/review-authorized.json
node artifacts/installed-native-review-2545b762/inspect.mjs
```

Launch sanitizes inherited Lux/Node options, uses the same private LOCALAPPDATA as the already installed package, restricts PATH to Windows system tools, and invokes the existing Windows Job experiment runner. It runs the native fixture for 10 seconds inside a 30-second outer budget. The registered source activates its installed supervisor; there is no separate checkout producer. Existing final-frame/log/result files are refused so a rerun cannot silently reuse evidence.

Inspection requires successful experiment exit and confirmed outer-Job cleanup, checks final capture size/time and receiver consumption/failures, flips the GL bottom-up RGBA8 image into `host.png`, and compares its four quarter-center RGBA samples with the exact `reopened` record in `artifacts/studio-common-images/result.json` (tolerance 5 per channel). It writes `inspection.json` and marks native telemetry completeness separately from pixel success. Synthetic inspector tests write no host evidence.

Expected top-left/top-right/bottom-left/bottom-right samples are `[187,187,255,255]`, `[0,255,0,255]`, `[255,255,255,255]`, `[255,255,255,255]`. Exported source/schema identities match that reopened reference; saved `backdrop=1` maps to native normalized `1`.

The distribution contains original PNG and oriented JPEG assets, but this saved scene renders the PNG. This run does not test JPEG display, gestures, multiple instances, restart recovery, performance, or actual Resolume save/reopen. Package/native hashes match the rebuilt integration binaries, and main emission matches. Native build commit `d302558` is coordinator-supplied attribution; the packaged render worker predates scheduler-only `60297e1`. Full reproducible-build or driver provenance is not claimed. The CPU module audit denies require resolution outside installed/package runtime trees plus Node builtins; this is not a system loader trace or source-removal experiment. See the review's full limitations.
