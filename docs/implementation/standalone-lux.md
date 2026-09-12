# Standalone Lux implementation checkpoint

User approved this scope on 2026-09-12 UTC. Build, view, revise and save visuals in Lux first. Resolume frame transport and interactive export are deferred; native experiments remain parked at their committed checkpoints. This supersedes the original tracer ordering without rewriting its historical plan or claiming its gates passed.

## Delivery checklist

- [x] Integrate reviewed React/Material UI Studio and compiler, including RTL and diagnostic-budget review fixes.
- [x] Link verified compiler artifacts into a bounded browser module containing the pinned SDK and Three renderer.
- [x] Run that module only in a dedicated unprivileged browser worker, render to Lux's own canvas, and promote a candidate only after its first completed frame. Keep the previous visual on compile/init failure.
- [x] Wire intensity, play/pause/reset, bounded errors, execution-loop health and candidate replacement. Preview dimensions do not own output resolution.
- [x] Expose the same compile/apply and capture path to AI authoring, with real image bytes and provenance.
- [x] Save and reopen source/settings/controls using versioned atomic project files. No full history/graph system is required for this build.
- [x] Validate the real app and record implementation, tests and remaining limitations.

## Parallel ownership

Coordinator owns integration, Studio main/preload/entry and the service-facing adapter. Compiler agent owns compiler/linker files. Runtime agent owns runtime instance and Studio visual worker. A separate reviewer checks changes and owns persistence only after its interface is aligned. Agents use existing isolated worktrees; shared manifest/lock and this checklist remain coordinator-owned. Existing agent slots are reused because the session has reached its agent limit.

## Validation and updates

Use CPU and React Testing Library tests for boundaries and interactions. Actual Electron/WebGPU checks remain serialized, with no native receiver, FFGL or Resolume loaded. Configuration tests do not count as real rendering or containment evidence. Record meaningful progress with this checklist; commit checkpoints frequently. Performance-monitoring design remains authoritative for truthful unavailable/timing/resource metrics.

## Running this checkpoint

From the integration checkout (`.worktrees/tracer`), run `pnpm studio`. This builds and opens the Electron Studio. Expand **Visual source** to edit the example, then click **Build & preview**. The example is a rotating square; intensity changes its red channel. Play/pause/reset, source errors, fullscreen, Open, Save and Save as are available. `.lux-scene` files contain source (including unfinished drafts), output settings and intensity. Closing with unsaved changes asks before discarding them.

Run `pnpm test:studio:cpu` for the UI/RTL checks; `pnpm test:studio:smoke` for a bounded actual app test; `pnpm test:studio:mcp` for a dedicated app plus actual external MCP source/image/revision test. Graphics tests are sequential and close their own app. They do not start the native receiver or Resolume.

For an MCP client, use the installed Node executable with the absolute `scripts/studio-mcp.mjs` path as its argument; start Studio separately. The standalone entry exposes `lux.studio.discover`, `lux.studio.read`, `lux.studio.build`, `lux.studio.capture`, and `lux.studio.status`. Read returns the draft version required by build. Capture returns actual MCP PNG ImageContent plus metadata. These deliberately separate tool names describe this smaller local workflow; they do not claim the complete original asynchronous `lux.scene.*`/job API. No assistant account or client configuration was changed automatically.

The MCP adapter authenticates to a random loopback endpoint owned by the current Studio process. Its endpoint/token record is stored under personal app data in `Lux/Studio/agent-endpoint.json`; never commit or expose the token. Requests with a browser Origin or missing token are refused. Recent request IDs are deduplicated in bounded memory; this is not durable job history.

## Verified evidence

- 21 Studio CPU tests, including four React Testing Library interactions and local bridge authorization/deduplication.
- Three filesystem tests: Unicode/draft roundtrip, invalid input rejection, external-change conflict, replacement-failure preservation. Seven runtime clock/seed tests also pass.
- Compiler/linker checkpoint passed 19 CPU tests. Actual app compilation/linking was exercised again after adding shared output/capture exports.
- Root and Studio semantic TypeScript checks pass. Studio builds main/preload/UI/worker bundles.
- Actual Electron/WebGPU smoke: compiled example, intensity 0.8, pause/reset with new clock epoch, invalid source rejected without replacing the working revision, full-size output PNG, and save/reopen of source and intensity.
- Actual external MCP client: discovery/read, build and PNG ImageContent, a second code revision producing different image bytes, stale editor-version rejection, and a generated infinite initialization loop rejected after the five-second deadline while the prior preview remained available.
- Coordinator inspected the real window and captured output images. Agent capacity failures prevented a fresh independent review of the final standalone integration; earlier compiler, Studio shell, concurrency fix and clock reviews are retained. Final integration was self-reviewed and exercised through the real app.

## Remaining limits

This is a development build, not installed show software. Output is fixed at 1920×1080, 60 fps, seed 0; unsupported saved settings are rejected explicitly. The entry module is editable in the small source panel; additional submitted modules are preserved but lack a file-tree editor. Popout currently reports unavailable; maximize/fullscreen operate in the main window. Full docking, graph/library/audio UI, durable revisions and export remain later work.

Continuous preview and capture share a completed GPU render target; only explicit capture performs CPU readback. The capture test establishes opaque example pixels and frame/control identity, not exhaustive alpha/color/orientation correctness. Detailed performance gauges remain unavailable rather than invented; the separate performance-monitoring design still governs their implementation. The browser worker watchdog and initialization timeout do not establish protection against arbitrary GPU-driver hangs or adversarial JavaScript spoofing within the worker. No claim is made that the earlier native-system freeze is diagnosed or fixed.

Scene replacement is an atomic same-directory rename after flushing a temporary file. External-edit detection is optimistic, not a universal compare-and-swap against unrelated editors. This checkpoint has no crash-recovery journal or autosave. Saving is explicit; closing Studio also ends its local preview.

## QA follow-up: preview fullscreen and control stability

User confirmed reopening a saved file works. Fullscreen now presents only the preview, fitting the 16:9 output within the display with black letterboxing as needed. Studio chrome is hidden, and a top “Press Escape to exit fullscreen” notice fades out after 3.5 seconds. Escape exits independently of the cached UI state. Native transition events determine fullscreen state; a delayed initial state response cannot overwrite a newer event. The existing preview surface remains mounted across transitions.

Routine command-success alerts were removed to prevent preview relayout. Intensity writes no longer toggle transport buttons or their pending label; transport commands retain their own pending guard. Actual command failures still show errors in the workspace.

Validation: 25 CPU tests pass, including seven RTL interactions and a native-event state regression; Studio TypeScript check passes. The fullscreen test checks first-Escape exit, stale state rejection, timed notice removal, hidden controls, and preview DOM continuity. Native fullscreen sizing/fade and visual flicker still need interactive QA. At the user's request, do not launch Studio or run GPU smoke tests until explicit permission is given; a separate agent is running transport experiments.
