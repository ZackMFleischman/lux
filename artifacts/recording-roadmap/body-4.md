Export a saved animation at fixed scene times so complex visuals produce smooth clips even when rendering is slower than real time. This is separate from recording live interactions. Reuse the completed-frame encoder and MCP job service.

Acceptance:
- A 30s/30FPS export renders exactly 900 frames at deterministic simulation times with matching encoded timestamps. Do not skip simulation times or duplicate frames to conceal missed work.
- Snapshot scene, seed, assets/library dependencies and supported saved control animation. Explain unsupported live inputs before starting.
- Isolate export state; preserve the user's current scene, controls and playback.
- Expose progress, cancellation and safe temporary-file finalization through MCP.
- Measure export speed and memory; accept slower-than-real-time operation while reporting an honest estimate.
- Visually inspect motion and decoded cadence; verify repeatability for supported seeded scenes.
- Checklist: running-app demonstration, independent review, relevant regressions, skill documentation/install checks, commit and merge.

Depends on direct completed-frame encoding.
