# TR-01 coordinator observations

Observed 12 September 2026 UTC / 11 September local. These are preflight observations, not tracer acceptance.

- Native toolchain: `vswhere -products '*' -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64` resolves Visual Studio Build Tools 2026 at `C:/Program Files (x86)/Microsoft Visual Studio/18/BuildTools`. SDK include directories include `10.0.19041.0` and `10.0.26100.0`; compilation remains the harness check.
- Node 24.12.0 and pnpm 10.33.0 are available. Development Node is distinct from Electron's embedded Node/ABI.
- Installed Avenue 7.27.1 launched successfully. Startup took longer than the initial Computer Use launch timeout; subsequent window discovery and actual window inspection confirmed it running.
- The startup log at `C:/Users/zFlei/AppData/Local/Resolume Avenue/Resolume Avenue log.txt`, entries at local 20:41:08, reports `NVIDIA GeForce RTX 2070/PCIe/SSE2`, OpenGL `4.1.0 NVIDIA 591.44`, and successful renderer initialization. This identifies the host renderer by its own log; exact DXGI LUID and interop extensions still require the native probe.
- The visible Example composition is 1280×720. Default new-composition settings are 1920×1080. Neither proves the required test workload or actual 60 Hz cadence. Use a separate tracer test composition during the host gate; do not overwrite Example.
- Existing additional FFGL search directory is `C:/Users/zFlei/AppData/Roaming/JuiceBar/resolume7_win64`; do not replace that configuration or existing plugins. Choose a separately named tracer plugin and preserve existing search paths.
- Installed host REST server is disabled; this pass has not enabled it or changed its network binding. Native plugin instrumentation is still required for actual callback evidence.

## Dependency/API research

Independent read-only research selected Electron 44.3.0, Three.js 0.186.0, MCP TypeScript SDK 1.30.0 (explicit legacy protocol profile), FFGL v2.2 and Spout 2.007.017. The harness resolves exact packages/source hashes and licenses into its pin manifest.

Sources: [Electron release](https://releases.electronjs.org/release/v44.3.0), [offscreen rendering](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering), [shared texture handle](https://www.electronjs.org/docs/latest/api/structures/shared-texture-handle), [Three.js WebGPU](https://threejs.org/manual/en/webgpurenderer), [MCP SDK releases](https://github.com/modelcontextprotocol/typescript-sdk/releases), [FFGL releases](https://github.com/resolume/ffgl/releases), [Spout releases](https://github.com/leadedge/Spout2/releases).

Critical TR-02 checks: RGBA/BGRA handles do not supply a keyed mutex; handle delivery alone is not proof of GPU completion. Windows NT handles are process-local and need correct duplication/import. Do not pass Electron's borrowed handle directly to Spout's legacy handle path. Verify producer readiness, native copy completion before release, same-adapter D3D/GL interop and nonblocking consumer behavior with the pinned source and actual hardware.
