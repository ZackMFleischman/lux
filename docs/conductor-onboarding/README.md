# Local Conductor operation journal

This directory holds the exact request arguments, payloads, and responses for the
onboarding and active orchestration run on this host. These mutable checkpoints
are intentionally excluded from Git; Conductor retains the authoritative ticket,
claim, review and run records. The versioned source map is
[../conductor-onboarding.md](../conductor-onboarding.md), and current ownership is
[../conductor-orchestration.md](../conductor-orchestration.md).

Do not rerun import scripts as a new onboarding. Reconcile the actual registry,
tickets, run and live agents first. Replay an ambiguous operation only with its
identical request and payload. Definitively rejected operations require refreshed
state and a separately journaled attempt when their arguments change.
