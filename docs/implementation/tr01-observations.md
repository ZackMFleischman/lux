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

### Pinned synchronization audit

The initial handle-readiness question is resolved at the source level for the selected build: [Electron 44.3.0 OSR consumer](https://github.com/electron/electron/blob/v44.3.0/shell/browser/osr/osr_video_consumer.cc#L87-L137) receives a completed captured frame, clones its handle and retains the releaser before invoking the paint callback. Its pinned [Chromium 152.0.7977.78 capturer](https://github.com/chromium/chromium/blob/152.0.7977.78/components/viz/service/frame_sinks/video_capture/frame_sink_video_capturer_impl.cc) requests a mappable shared image. [The matching GPU output implementation](https://github.com/chromium/chromium/blob/152.0.7977.78/components/viz/service/display_embedder/skia_output_surface_impl_on_gpu.cc), `CopyOutputRGBAInTexture`, waits for GPU work through `ReadbackContextTexture::OnMailboxReady` before delivering the result. Thus this specific path supports producer-ready paint delivery; a generic handle-delivery assumption would not.

Consumer completion is separate. Open the source using `OpenSharedResource1`, copy into owned GPU memory, end an EVENT query, submit with Flush, and poll query completion off the hot callbacks. Flush is not completion. Retain the Electron source until the query signals; then release and publish. Hardware testing must still validate the actual topology, provenance, formats and lifetime. Safe stress arms delay copying while retaining the lease; do not intentionally release a resource still in GPU use.

### Actual model image observation

The coordinator executed the SDK's stdio client and forwarded the exact returned PNG ImageContent into the current model context. It visibly contains red upper-left, green upper-right, blue lower-left and yellow lower-right quadrants. [Raw negotiation and observation](../../evidence/tracer-0.1/tr01-model-observation/mcp-observation.json) records the explicit `2025-11-25` profile and the shell/tool bridge topology. This proves fixture image visibility through that topology, not native Codex MCP registration or the later rendered AI loop.
