# Completed transport checkpoint — 12 September 2026

**Status: single-source saved-visual transport implemented and manually verified.**
Reuse this work when implementing the remaining [tracer tasks](tracer-0.1.md).
It is no longer an unimplemented future-milestone feature. It does not complete
the newer [installed export scope](tracer-export-scope.md).

## Implementation location

- Branch: `codex/resolume-transport`; completion commit: `a5eee83`.
- Local checkout: `C:\Users\zFlei\repos\lux\.worktrees\transport`.
- Code and detailed evidence remain on that branch; this documentation update
  does **not** merge its application code into the main checkout.
- On that branch, read `docs/implementation/transport-playback.md`,
  `docs/implementation/transport-resumption.md`, and
  `docs/implementation/compiled-transport-plan.md`.
- Evidence lives under `evidence/tracer-0.1/tr02-compiled-*` on that branch.
  Inspect it with `git show a5eee83:<path>` or in the transport checkout before
  integrating. Preserve other agents' subsequent Studio/core changes.

## Completed and verified

- [x] Actual GPU path: sandboxed Three WebGPU worker → Electron offscreen shared
  texture → owned D3D ring → FFGL OpenGL output in Resolume. No per-frame CPU
  pixel streaming in normal playback.
- [x] Saved `.lux-scene` compilation/linking and immutable prepared release
  validation, available through `pnpm transport:prepare`.
- [x] Persistent playback of a saved scene or prepared release through
  `pnpm transport:play`, reusing the Studio visual worker.
- [x] Protocol-3 host-control handshake: wait for the authoritative host
  Intensity before creating/rendering the visual; apply subsequent live values.
- [x] Discovery/reconnect repair and fresh canvas creation before late transfer,
  fixing the black compositor output seen with compiled visuals.
- [x] Supervised producer ownership, Ctrl+C cleanup, automatic cleanup after
  host/owner exit, and bounded handling of an unresponsive producer.
- [x] User-observed rotation, live color response, last-frame retention,
  restart, clip removal, and normal Resolume shutdown.

| Verification | Recorded result |
| --- | --- |
| CPU/build | 34 unit tests, 9 native tests, type check and build passed |
| Compiled standalone | 166 paints, 73 sampled receiver consumptions, correct final image |
| Actual Resolume diagnostic | 648 received frames; first worker render used host 0.17 instead of saved scene 0.91 |
| Persistent playback | Over one minute, 2766 paints, manual rotation/control confirmation, clean Ctrl+C stop |
| Reconnect and host close | Manual freeze/resume/removal/close confirmation; 1234 paints; automatic producer exit, no forced stop |
| Final cleanup | No Avenue/Arena/Electron processes and no experiment lock remained |

The tested `LuxTracerTR02.dll` is installed in the configured Resolume Extra
Effects directory. SHA256:
`2de5d23b889202da46ec9b2b141f9969a14e9c12ad53c29d185815b88f82f453`.
The prior DLL and the earlier disabled incident binary were preserved.

## Remaining work and acceptance boundaries

The current path uses one **Lux TR02 Probe** source and a manually launched
producer from a development checkout. Studio must be closed during playback.
Do not present it as Export for Resolume or a standalone installed product.

| Plan area | Reuse completed work | Still required |
| --- | --- | --- |
| TR-02 GPU feasibility | Real native path, ownership tests, host diagnostics, compiled scene delivery | Full marker/frame association, numeric color/alpha, delay/drop and timing/coverage acceptance |
| TR-03 runtime/supervisor | Shared visual worker, compiler/linker, persistent producer Job, stop/exit tests | Audit remaining service/runtime contracts and measurements; do not mark the whole task complete from this checkpoint |
| TR-06 installed export | Validated immutable release preparation, single-host controls and lifecycle | Named export/install workflow, complete pinned runtime/assets, automatic startup without a checkout/manual command, independent sources/copies, offline composition cold reopen |
| TR-07 acceptance | Retained test logs and manual confirmations | Full tracer/export and Appendix B acceptance suite |
| Broader work | Existing transport is the implementation base | Simultaneous Studio/playback, broader resize/device-loss handling, sustained 1080p60 and resource/performance validation |

Worker acknowledgement proves the first visual render used the host snapshot;
it does **not** identify the first exported compositor texture. The stricter
first-accepted-frame restoration contract remains an acceptance gap. Multiple
independent sources and installed cold start remain tracer 0.1 obligations under
DEC-13, not later-milestone deferrals.

Next agents should integrate and extend this branch, reconcile newer authoring
work, and run the missing gates. Do not rebuild the demonstrated transport from
scratch or repeat completed manual tests without a relevant code change.
