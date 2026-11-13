# Connected audio spectrum delivery evidence

LUX-226 exposes actual connected-input frequency magnitudes to SDK0.2 visual updates and SDK0.4 component updates. It adds no device capture, raw PCM, permissions or scene audio storage.

The existing analyzer emits 128 normalized peak-magnitude buckets from its 2048-point FFT, on a logarithmic 20Hz-to-Nyquist axis. Adjacent low-frequency buckets can share an FFT bin. Existing bounded audio transport carries the optional payload. Authored frames receive frozen snapshots, stale sequences are ignored, paused explicit draws hold the displayed data, disconnect supplies zeros, and reset supplies one zero frame. An absent input supplies unavailable/zero data. Older hosts can omit the field; source must guard it. Actual running capability is `audioSpectrum`.

Implementation base includes the separately reviewed startup async preparation/no-deadline fixes, selector fix and persistent diagnostics. Cherry-picked prerequisites: d59ff97a,827a2c73,77dcee90,0e523882,430238b5. No source was edited under the running app.

Validation:
- Deterministic FFT1kHz tone, silence,128-bin bounds, immutable copies, stale, pause/reset/disconnect tests pass.
- Actual visual and component worker suite:36pass. Existing SDK0.4 image-chain test proves every leaf receives the same spectrum object; SDK/compiler and contract tests19pass.
- Audio/provider/modulation/transport regressions22pass. Composition/Story state suite13pass after correcting an incomplete preexisting Story audio fixture.
- User-observed status projection gap fixed: composition effectiveControls now exposes the animated public aliases while controls remains the saved manual base. Regression failed before the one-line fix and passed afterward.
- Root and Studio TypeScript checks and combined Studio build ran from this isolated tree.
- Independent reviewer `/root/mcp_audio/audio_review` found no blocking spectrum defect. Its finite-resolution documentation recommendation is included.
- Source visual skill installed and --check current.

Raw logs and overlay manifest live in `artifacts/mcp-audio-bindings/` of C:/Users/zFlei/.codex/worktrees/mcp-audio-bindings/lux. The inherited general unit-suite missing native/generated build setup failures are recorded in the prior MCP evidence; no complete general-suite pass is claimed.

Main owns inactive installed-source refresh, app restart, exact authorized source reconnect and the actual rendered music-spectrum demonstration. Do not claim the user's installed app received this field until its running capability and actual response are observed. Overlay list is `spectrum-install-files.json`; it includes the reviewed logger files so worker/MCP/source updates remain compatible. Reuse dependencies, rebuild inactive installed app and recompute sourceDigest with the existing refresh helper only after the coordinator closes the user's current app.
