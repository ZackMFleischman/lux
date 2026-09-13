# Lux repository maintenance

## Conductor tracking and coordination

Lux is registered as project `34723eb7-f57d-45c3-8831-adcb2bbfe485`, prefix `LUX`.
Before repository work, use the installed Conductor executable and configured home:

```powershell
& 'C:\Users\zFlei\AppData\Local\Conductor\bin\conductor.exe' --home 'C:\Users\zFlei\AppData\Local\Conductor' context --if-registered --json
```

On this Windows Codex installation, every invocation of that executable/home uses
`sandbox_permissions: require_escalated` from the outset. A Git ownership error
may be resolved with process-scoped `safe.directory` for the exact authorized
checkout; do not persist global trust or select a fallback registry. Unknown
registration must be reported, not treated as unregistered.

Use the `conductor-work` skill and actual ticket/session/claim state. Read
`docs/conductor-onboarding.md` for source coverage and
`docs/conductor-orchestration.md` for the current run and ownership checkpoint.
Reconcile these checkpoints against the tracker and live agents before dispatch.
All four roadmap workstreams are authorized; later slices still require their
documented prerequisites and review. Preserve active ownership, serialize main
integrations and graphics/Studio/Resolume tests, and do not start a second team.

## Visual-creation skill

`skills/lux-visual-creation/` is the source of truth for the shipped Codex skill. When changing author-facing SDK features, published parameters, supported assets, source-bundle rules, or Studio MCP tools, update the relevant skill instructions/examples in the same work and validate them against the implementation. Describe available behavior separately from planned behavior. Pair the adapter with the running Studio's checkout: discovery describes the adapter and is not a version handshake with an older open application.

After any skill update, reinstall it from this checkout with `node scripts/install-visual-skill.mjs`, then run `node scripts/install-visual-skill.mjs --check`. Do not edit only the personal installed copy. If installation is unavailable on the current host, report that remaining step explicitly rather than claiming delivery is complete.

Visual parameters belong to each visual's code. `intensity` is an optional concrete visual parameter, not a global built-in contract. The current tracer's fixed Intensity control is temporary implementation debt, not the intended SDK design.
