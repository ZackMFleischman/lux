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

Use up to the current host's available agent limit. Do not impose a lower fixed
project limit. The user replaced the historical five-context cap on 13 September
2026. Count the coordinator, observers, reviewers, workers and starting or unknown
contexts. Use capacity for concrete independent delivery and review. Do not fill
slots with speculative work. When an immutable run has an obsolete limit,
checkpoint and stop it before starting its successor at the actual host limit.

## Deliver usable features

The user set this direction on 13 September 2026 after reviewing excessive
internal work. Apply it before every plan, worker dispatch and status report.

Current priority: QA and iterate on the normal creative workflow before additive
features. Start Lux, create or edit a visual, build and inspect it, adjust controls,
save and reopen it, and verify that an invalid edit preserves the last working
preview and user files. Use observed problems to select fixes. MIDI work is paused
until the user discusses and approves its design. The four workstreams remain
authorized, but their later features do not take priority over this QA loop.

- Keep one next usable milestone per workstream. State the user action, expected
  visible result and a short demonstration in its parent ticket. Read the current
  targets in `docs/conductor-orchestration.md` before dispatch.
- Each child ticket must name that milestone and explain why it needs this work
  now. For internal code, state the connection to the actual application and why
  existing code cannot support the demonstration. Otherwise defer the task.
- Prefer connecting and demonstrating existing code before adding another helper
  system. A plan, parser, ledger or test suite is not a usable feature.
- After each accepted slice, check the shortest remaining path to the demonstration.
  Do not automatically dispatch the next slice of an old plan. Keep only work
  needed for this path active; do not fill agent capacity with speculative work.
- Start with one concrete case. Add general frameworks, formats, version changes,
  replay systems and broad compatibility only when the milestone needs them.
- Keep plans short and proportional to risk. Reuse existing contracts. Put detail
  in a linked reference when it is needed for correctness. Do not add another
  planning or review layer unless an existing policy or a specific unresolved risk
  requires it. Keep required independent review and data/resource protection.
- Test changed behavior and relevant regressions. CPU tests do not prove a working
  UI, device, GPU or installed host. Preserve real demonstration evidence and any
  remaining limits; never weaken a safety boundary to make a demo pass.
- Report features as usable, implemented but not connected, or planned. For a
  usable feature, cite the actual demonstration. Describe blockers and the next
  user-visible result. Do not use ticket counts or test totals as feature progress.
- Use short STE-style sentences in tickets and handoffs. Separate technical
  references from the main copy. Preserve historical evidence and exact contracts.

These rules change execution priority, not the authorized four-workstream scope.
They do not authorize bypassing native-input provenance or policy-stopped work.

## Visual-creation skill

`skills/lux-visual-creation/` is the source of truth for the shipped Codex skill. When changing author-facing SDK features, published parameters, supported assets, source-bundle rules, or Studio MCP tools, update the relevant skill instructions/examples in the same work and validate them against the implementation. Describe available behavior separately from planned behavior. Pair the adapter with the running Studio's checkout: discovery describes the adapter and is not a version handshake with an older open application.

After any skill update, reinstall it from this checkout with `node scripts/install-visual-skill.mjs`, then run `node scripts/install-visual-skill.mjs --check`. Do not edit only the personal installed copy. If installation is unavailable on the current host, report that remaining step explicitly rather than claiming delivery is complete.

Visual parameters belong to each visual's code. `intensity` is an optional concrete visual parameter, not a global built-in contract. The current tracer's fixed Intensity control is temporary implementation debt, not the intended SDK design.

## Creative session isolation

Use `start-lux` / `pnpm studio:creative` for user creative work. Its reserved
`.worktrees/lux-creative` checkout and build stay at the recorded commit until an
explicit user-requested upgrade. Do not edit, rebuild, update dependencies in,
test against, prune, or terminate that creative checkout or instance during
development. Keep saved creative scenes outside test artifact directories.

Ordinary Studio and MCP launches select a profile derived from their checkout.
Explicit profiles must match in Studio and its adapter; creative uses `creative`.
Every automated Studio launch must use `studioTestEnvironment()` and pass that
same environment to its MCP adapter. Never reuse the creative profile or the
legacy shared endpoint for a test. Only close the process owned by that test.
Concurrent profiles still share the GPU, so coordinate graphics load and retain
all native-input provenance requirements.

Both `skills/lux-visual-creation/` and `skills/start-lux/` ship from this repository.
After changes, install/check the first with `node scripts/install-visual-skill.mjs`
and `--check`; install/check the second with the additional `--skill start-lux`.
