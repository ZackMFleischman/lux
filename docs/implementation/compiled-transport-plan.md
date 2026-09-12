# Compiled visual transport implementation plan

**Goal:** Run a saved Lux visual through the existing Resolume GPU bridge, with
its first render initialized from the host's authoritative Intensity value.
**Architecture:** Reuse the compiler/linker and Studio visual worker. A separate
offscreen render host loads an immutable compiled release. The native ring
advertises before rendering, and a versioned control-ready handshake prevents
default-value output. Resolume retains its last completed image while waiting.
**Spec:** `docs/design/resolume-bridge.md`, narrowed by the user's request to
finish compiled-visual integration and initial control synchronization.

- [ ] Native control handshake: add versioned initialized snapshot state, bounded
  atomic reads, and CPU tests proving no default snapshot or submission before
  host publication. Publish host controls before admitting frames.
- [ ] Saved visual preparation: read the existing `.lux-scene` format through
  SceneFileStore, compile/link with existing bounded workers, write immutable
  content-identified release bytes. Test source rejection and tamper rejection.
- [ ] Shared runtime: bundle the existing Studio worker for the offscreen page;
  initialize only after the native snapshot; preserve real source/settings/hash
  identity in evidence. Controls are acknowledged before opening the paint gate.
- [ ] Execution and verification: pass the release through the reviewed runner's
  inventory; build/test, independently review, run standalone and actual-host
  checks using nondefault host controls; verify restart and normal teardown.
- [ ] Deliver runnable saved-visual instructions and committed source/evidence.

No CPU pixel streaming, generated code in Electron main, or silently shared
authoring/host controls. This work does not add multi-instance routing or the
separate full performance acceptance suite.
