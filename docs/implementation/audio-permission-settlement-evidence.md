# Accepted audio capture settlement evidence

LUX-227 fixes a proven broker deadline defect exposed by real CABLE reconnect failures after9.016s and12.479s. The previous5-second fresh-intent timer also expired an already accepted capture attempt. The old records did not identify broker phase, so elapsed time alone cannot prove which rejection branch caused the physical failures. A second code path allowed armed permission checks to bypass the exact request admission that activation required. Electron documents that APIs commonly request permission only after a denied check: https://www.electronjs.org/docs/latest/api/session#sessetpermissioncheckhandlerhandler .

The broker now keeps5seconds for fresh intent and60seconds for settlement of one admitted attempt. Armed capture checks return false so the exact audio-only main-page request must be admitted. During attempting only the exact capture-continuation check form passes; a parallel new capture is denied. Token matching, page/sender checks, expiry, cancellation, navigation, renderer loss and destruction retain revocation. Late activation after the attempt deadline fails; the runtime stops any stream it receives after failed activation. This adds no device permission and does not remove bounded permission lifetimes.

Local diagnostics emit audio.permission records with stage, reason code, elapsedMs since arm and attemptMs since admission. No token, device identity, source or request payload is recorded.

Verification by implementation worker:
- Broker, runtime and diagnostic suites20pass; Studio TypeScript check passes.
- Hidden isolated native Electron44.3.0 integration uses Chromium fake media, no physical device, user profile, graphics workload or computer automation. First request accepted4.22ms after arm; parallel getUserMedia rejected; activation succeeded6221.84ms after arm. Revoke/rearm/reconnect produced exactly2admitted requests and2activations. Raw log artifacts/mcp-audio-bindings/permission-native-test.log. Harness tests/studio/audio-permission-electron.mjs.
- Independent native reviewer /root/mcp_audio/audio_review initially found an unbounded attempting-grant risk. The separate60-second deadline and restricted continuation checks resolved it. Reviewer accepted the native test result with no remaining blocker; physical-device validation remains separate.

Main owns inactive overlay/rebuild/digest and physical CABLE verification. Overlay only apps/studio/src/audio/audio-permission-broker.ts, apps/studio/src/main.ts, scripts/studio-diagnostics.mjs. No live app edits, restart or capture by this worker. The previously disclosed general-unit missing native/generated setup failures remain outside this patch; no clean full-suite claim is made.

## Serialized durable main integration

Actual main was checked out only in this isolated worktree. The user checkout C:/Users/zFlei/repos/lux was left on its separate Claude branch, with its dirty tracked path list and index unchanged at verification; an external actor changed its branch name during the operation. No force, stash, reset, remote push, dependency install or live app change was performed. Preserved delivery branch: codex/audio-delivery at f52e6b9fb29316e9fc14a31c6a40f9988a939222. Main will be left free for checkout after this evidence commit.

Tested combined main code: 3fe627cb1197d52722145e5e5d5793165fd52a64. Landed reviewed commit mapping:

- MCP: 697e430ae9706ce6ba3ad59232399bd7a9eea78e
- async startup: 882361c9b50d437ce8b06cc177dd9a9175fe7d6b
- startup test transport: 061ee586f3648c4a5220ba6ac07dbd23f21cd9dd
- startup no deadline: aea8468e26188040dc82c5fce3a7011b44cc6505
- audio selector: d9153481cb7e93a8bf8f0967ac7c6033beebae86
- selector test path: 838a0f1a3aad6ebb9ec18e2e981ab3a19dd4b7ad
- persistent diagnostics: a96eec8a7a41bc775793b519200e84788b0e2166
- FFT spectrum/public status: 4066e9540981f19cfb128eafc8f67fc74469c060
- permission settlement: cc6fc30d7a58151190cebc81fe1f6ac077f6bcb6
- Test rhythm: 3fe627cb1197d52722145e5e5d5793165fd52a64

Combined main validation: all3TypeScript checks pass; full Studio/test build passes;47focused audio/MCP/state/diagnostic tests,55built React interactions,36actual direct/component worker tests pass. Hidden pinned-Electron fake media test again admits exactly2requests/activations, rejects a parallel capture and activates after6.197s. Raw logs are artifacts/mcp-audio-bindings/main-*. General suite setup failures remain disclosed above. Visual skill installed and --check current from integrated main; start-lux source unchanged.

Main coordinator reports real installed CABLE validation after the permission patch: session154120af33588b57422e960bf54558301022 PID38048; four actual128-bin FFT frames peak .259at54,.294at60,.282at61,.084at22; effective node bassEnergy .19-.56 and mids .24-.48 with no fault. Artifact: C:/Users/zFlei/.codex/visualizations/2026/11/13/01a1d2ca-f13b-7c01-8456-f99a778fa057/audio-response.json . This is external coordinator execution against installed code, distinct from the worker fake-device and CPU tests. Installed Test rhythm overlay later completed against combined f52e6b9 with sourceDigest45ac958a0982632e3972f307f3854673c0df8e346f9a6e49868eae12e923f955; its user-facing demonstration remains coordinator-owned.
