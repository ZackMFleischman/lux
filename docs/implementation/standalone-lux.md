# Standalone Lux implementation checkpoint

User approved this scope on 2026-09-12 UTC. Build, view, revise and save visuals in Lux first. Resolume frame transport and interactive export are deferred; native experiments remain parked at their committed checkpoints. This supersedes the original tracer ordering without rewriting its historical plan or claiming its gates passed.

## Delivery checklist

- [ ] Integrate reviewed React/Material UI Studio and compiler, including RTL and diagnostic-budget review fixes.
- [ ] Link verified compiler artifacts into a bounded browser module containing the pinned SDK and Three renderer.
- [ ] Run that module only in a dedicated unprivileged browser worker, render to Lux's own canvas, and promote a candidate only after its first completed frame. Keep the previous visual on compile/init failure.
- [ ] Wire intensity, play/pause/reset, bounded errors, execution-loop health and candidate replacement. Preview dimensions do not own output resolution.
- [ ] Expose the same compile/apply and capture path to AI authoring, with real image bytes and provenance.
- [ ] Save and reopen source/settings/controls using versioned atomic project files. No full history/graph system is required for this build.
- [ ] Validate the real app, then commit implementation, tests and remaining limitations.

## Parallel ownership

Coordinator owns integration, Studio main/preload/entry and the service-facing adapter. Compiler agent owns compiler/linker files. Runtime agent owns runtime instance and Studio visual worker. A separate reviewer checks changes and owns persistence only after its interface is aligned. Agents use existing isolated worktrees; shared manifest/lock and this checklist remain coordinator-owned. Existing agent slots are reused because the session has reached its agent limit.

## Validation and updates

Use CPU and React Testing Library tests for boundaries and interactions. Actual Electron/WebGPU checks remain serialized, with no native receiver, FFGL or Resolume loaded. Configuration tests do not count as real rendering or containment evidence. Record meaningful progress with this checklist; commit checkpoints frequently. Performance-monitoring design remains authoritative for truthful unavailable/timing/resource metrics.
