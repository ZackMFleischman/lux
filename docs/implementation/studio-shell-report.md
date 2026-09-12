# Thin Studio shell — implementation plan and report

## Scope and design

Implements the presentation-only portion of TR-05 from `docs/design/studio.md`, `docs/design/runtime.md`, `docs/design/tracer-contracts.md`, and `docs/implementation/tracer-0.1.md`. The coordinator authorized this isolated lane while graphics integration remains blocked. This is not TR-05 acceptance.

The shell has a dominant fitted preview, one intensity control, play/pause/reset/restart, authoring and host identity, and separate visual/UI metrics. React and Material UI provide the design-system baseline, per the user's explicit steering. No graph, library, audio engine, docking library, fake scene, or pixel stream is included. Disconnected is the shipped default. Runtime mutations use the documented core operation names and generation/revision preconditions through an injected local UI port; these provisional view types are not a replacement canonical shared contract. RuntimeKey, OutputSettings and ControlValues import the coordinator's canonical runtime-contracts exports.

Presentation attachment is an injected consumer lease. Moving a target releases its previous lease and attaches to the same runtime identity. Electron owns only UI windows and fullscreen. It has no renderer-start/stop/dispose operation. Real surface transport and service discovery remain integration work.

## Execution plan

1. [x] Add CPU tests for unavailable-service refusal, documented command preconditions, authority protection, and late presentation-attachment cleanup; implement the client/controller and consumer binding.
2. [x] Add React server-render and React Testing Library tests for disconnected status, real control interaction, fixed output settings, metric availability, and error visibility; implement the thin responsive view and presentation controls.
3. [x] Add restricted Electron main/preload window wiring and local build configuration. Verify semantic TypeScript checking, renderer bundling, CPU tests, and navigation/window-policy tests without launching Electron or a browser.
4. [x] Record exact dependencies, changes, verified checks and unresolved integration evidence here; commit only this lane's files.

## Validation record

`node apps/studio/test-cpu.mjs` builds the Electron main/preload, browser renderer and test bundles, then runs 20 CPU-only checks. All passed. Four tests use React Testing Library and user-event in jsdom: disconnected inputs stay disabled while maximize/Escape works; play/pause and the MUI intensity slider send guarded shared operations without claiming applied state; command failure displays an actionable error and preserves the reported revision; an intensity acknowledgement cannot re-enable transport while a playback request remains pending. The last test reproduced an independently reviewed busy-boolean race; a pending-command count fixes it. jsdom starts no browser, GPU, Electron or canvas.

`node node_modules/typescript/bin/tsc -p apps/studio/tsconfig.json` passes full semantic checking. `git diff --check` passes. Test failures observed and repaired during implementation included missing ownership coalescing, losing a value queued during acknowledgement, late popout surviving docking, and jsdom's missing ShadowRoot global. No visual/CSS-layout, CSP-in-Chromium, native fullscreen, cross-window surface, or process-survival verification is claimed.

The isolated worktree uses an ignored node_modules junction to the coordinator-installed dependencies for read-only tooling. No root package manifest or lockfile was edited by this lane. The coordinator owns dependency consolidation.

## Dependency pins

- React/react-dom and their type packages: 19.3.0.
- Material UI: 9.4.0. Emotion react/cache: 11.14.0; styled: 11.14.1.
- React Testing Library: 16.3.3; DOM Testing Library: 10.4.1; user-event: 14.6.7.
- jsdom: 26.1.0; @types/jsdom: 21.1.7 (compatible with the pinned Node 24.12.0).
- esbuild: 0.28.2. Existing workspace Electron 44.3.0 and TypeScript 7.0.2 are reused.

## Integration boundary and remaining work

- `StudioClient` is a provisional view-facing port. `invoke` admits the documented `lux.parameters.set`, `lux.playback`, and `lux.runtime.restart` payloads; core remains authoritative for validation and actual application. Continuous intensity keeps one in-flight operation plus the latest pending value and preserves the input's original generation/revision guards.
- `PresentationPort` only returns a detach lease for a runtime key and DOM target. `PreviewBinding` serializes target changes and retires late attachments. The application entry intentionally supplies neither a service implementation nor a presentation implementation. No real frame or runtime success is fabricated.
- Electron owns only Studio/preview windows. Popout, dock, fullscreen and Escape are wired through a narrow preload API. Sender identity/URL, popup/navigation/webview and permissions are restricted. Emotion receives a per-launch nonce in a generated local page under personal app data; CSP allows no network or unsafe-inline styles. Closing windows invokes no runtime teardown.
- Real core discovery, authenticated transport, async job reconciliation, completed-output surface integration and cross-renderer attachment must be implemented and independently verified. A real adapter must maintain consumer identity/ownership across renderer documents; CPU binding tests do not prove GPU resource portability or cross-window exclusivity.
- View geometry fits the fixed 1920×1080 tracer reference; no resolution mutation operation exists. Layout/DPI/native fullscreen and fullscreen bounds restoration require later actual-window checks. Full docking, ultrawide graph+preview arrangement, library, inputs and persistent layouts remain their documented milestones.
- The root `test:studio` hardware/integration gate remains unavailable. These checks establish an offline shell and adapter behavior, not completed TR-05, working preview rendering, host survival, responsiveness under real rendering, or any graphics-safety acceptance.
