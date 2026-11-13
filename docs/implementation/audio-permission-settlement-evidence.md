# Accepted audio capture settlement evidence

LUX-227 fixes a proven broker deadline defect exposed by real CABLE reconnect failures after9.016s and12.479s. The previous5-second fresh-intent timer also expired an already accepted capture attempt. The old records did not identify broker phase, so elapsed time alone cannot prove which rejection branch caused the physical failures. A second code path allowed armed permission checks to bypass the exact request admission that activation required. Electron documents that APIs commonly request permission only after a denied check: https://www.electronjs.org/docs/latest/api/session#sessetpermissioncheckhandlerhandler .

The broker now keeps5seconds for fresh intent and60seconds for settlement of one admitted attempt. Armed capture checks return false so the exact audio-only main-page request must be admitted. During attempting only the exact capture-continuation check form passes; a parallel new capture is denied. Token matching, page/sender checks, expiry, cancellation, navigation, renderer loss and destruction retain revocation. Late activation after the attempt deadline fails; the runtime stops any stream it receives after failed activation. This adds no device permission and does not remove bounded permission lifetimes.

Local diagnostics emit audio.permission records with stage, reason code, elapsedMs since arm and attemptMs since admission. No token, device identity, source or request payload is recorded.

Verification by implementation worker:
- Broker, runtime and diagnostic suites20pass; Studio TypeScript check passes.
- Hidden isolated native Electron44.3.0 integration uses Chromium fake media, no physical device, user profile, graphics workload or computer automation. First request accepted4.22ms after arm; parallel getUserMedia rejected; activation succeeded6221.84ms after arm. Revoke/rearm/reconnect produced exactly2admitted requests and2activations. Raw log artifacts/mcp-audio-bindings/permission-native-test.log. Harness tests/studio/audio-permission-electron.mjs.
- Independent native reviewer /root/mcp_audio/audio_review initially found an unbounded attempting-grant risk. The separate60-second deadline and restricted continuation checks resolved it. Reviewer accepted the native test result with no remaining blocker; physical-device validation remains separate.

Main owns inactive overlay/rebuild/digest and physical CABLE verification. Overlay only apps/studio/src/audio/audio-permission-broker.ts, apps/studio/src/main.ts, scripts/studio-diagnostics.mjs. No live app edits, restart or capture by this worker. The previously disclosed general-unit missing native/generated setup failures remain outside this patch; no clean full-suite claim is made.
