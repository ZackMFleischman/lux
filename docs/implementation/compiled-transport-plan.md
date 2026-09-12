# Compiled visual transport implementation plan

**Goal:** Run a saved Lux visual through the existing Resolume GPU bridge, with
its first render initialized from the host's authoritative Intensity value.
**Architecture:** Reuse the compiler/linker and Studio visual worker. A separate
offscreen render host loads an immutable compiled release. The native ring
advertises before rendering, and a versioned control-ready handshake prevents
default-value output. Resolume retains its last completed image while waiting.
**Spec:** `docs/design/resolume-bridge.md`, narrowed by the user's request to
finish compiled-visual integration and initial control synchronization.

- [x] Native control handshake: add versioned initialized snapshot state, bounded
  atomic reads, and CPU tests proving no default snapshot or submission before
  host publication. Publish host controls before admitting frames.
- [x] Saved visual preparation: read the existing `.lux-scene` format through
  SceneFileStore, compile/link with existing bounded workers, write immutable
  content-identified release bytes. Test source rejection and tamper rejection.
- [x] Shared runtime: bundle the existing Studio worker for the offscreen page;
  initialize only after the native snapshot; preserve real source/settings/hash
  identity in evidence. Controls are acknowledged before opening the paint gate.
- [x] Execution and verification: pass the release through the reviewed runner's
  inventory; build/test, independently review, run standalone and actual-host
  checks using nondefault host controls; verify restart and normal teardown.
- [x] Deliver runnable saved-visual instructions and committed source/evidence.

No CPU pixel streaming, generated code in Electron main, or silently shared
authoring/host controls. This work does not add multi-instance routing or the
separate full performance acceptance suite.

## Current verification checkpoint

Native CPU tests: 9 passed. Unit tests: all 34 passed. `pnpm typecheck` and
`pnpm build` passed. Persistent Job cleanup is covered by CPU fixtures for
explicit stop, host exit, owner exit, and an unresponsive producer.

The initial compiled GPU diagnostic failed. Run
`252c3c38-7a88-4138-a9a9-2bfe95cfc9f7` captured the correct colored visual inside
the worker, with frame IDs continuing to advance, but the receiver got only one
black compositor frame. Removing the pre-initialization `stopPainting()` did
not resolve it. The evaluator now rejects that result. Canvas readback and
worker rAF experiments then narrowed the failure to surface initialization.
GPU diagnostics were paused while the user tested Studio with another agent.
The failed run, exact inventory and worker capture are preserved under
`evidence/tracer-0.1/tr02-compiled-presentation-debug/`.

After resuming, fresh-canvas initialization fixed the compositor failure:
replace the already-composited placeholder immediately before transferring it
to the worker. rAF scheduling, direct rendering, and additional device features
did not fix it and were reverted. Run
`64557b28-7737-4cf7-8ee6-0860b016c373` delivered the actual compiled visual with
166 paints, an appropriately rotated final image, and complete cleanup. Source
and final images plus exact inventory are in `tr02-compiled-standalone`.
An optional canvas readback remains unsupported and has been removed; the
worker render-target capture and actual receiver image verify visual output.

The tested protocol-3 DLL is installed, SHA256
`2de5d23b889202da46ec9b2b141f9969a14e9c12ad53c29d185815b88f82f453`.
The prior installed DLL is preserved as `.AF739BC0D4F2.backup`.

Actual-host diagnostic `fcf5d034-f1b7-464b-bfc7-c5500ce0ba81` received 648 frames;
the first worker render used host Intensity 0.17000000178813934, not the scene's
saved 0.91. Persistent playback `3291f432-3663-4ca9-be7c-16a5bf777046` ran for
over a minute, with 2766 paints and user-confirmed animation and color control.
Ctrl+C drained and exited cleanly. After an unwatched reconnect was repeated,
the user confirmed freeze/resume, clip removal, and normal host close during
`25d279f3-6310-49fa-9a5f-9ac2114ce9c1`. The host-close supervisor stopped the
producer without forced termination and removed the lock. See the playback
guide and transport-resumption report for scope and evidence links.
