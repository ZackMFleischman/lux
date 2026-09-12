# Lux repository maintenance

## Visual-creation skill

`skills/lux-visual-creation/` is the source of truth for the shipped Codex skill. When changing author-facing SDK features, published parameters, supported assets, source-bundle rules, or Studio MCP tools, update the relevant skill instructions/examples in the same work and validate them against the implementation. Describe available behavior separately from planned behavior. Pair the adapter with the running Studio's checkout: discovery describes the adapter and is not a version handshake with an older open application.

After any skill update, reinstall it from this checkout with `node scripts/install-visual-skill.mjs`, then run `node scripts/install-visual-skill.mjs --check`. Do not edit only the personal installed copy. If installation is unavailable on the current host, report that remaining step explicitly rather than claiming delivery is complete.

Visual parameters belong to each visual's code. `intensity` is an optional concrete visual parameter, not a global built-in contract. The current tracer's fixed Intensity control is temporary implementation debt, not the intended SDK design.
