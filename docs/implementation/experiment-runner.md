# Exclusive Windows experiment runner

CPU-only verification (Node 24, Windows PowerShell and Windows required):

```
node --test --test-isolation=none tests/unit/experiment-runner.test.mjs
node scripts/experiment-runner.mjs cpu success
```

CPU mode permits only the committed success, failure, and timeout fixtures. It
does not accept a command or script path. The timeout fixture spawns a harmless
Node grandchild so the test checks descendant cleanup, not just parent exit.

Hardware execution is a separate, explicit action after incident-review gates:

```
node scripts/experiment-runner.mjs hardware C:\absolute\review.json 20000
```

No hardware runs were used to verify this supervisor. The diagnostic deadline
defaults to 8000 ms and accepts explicit integer overrides from 100 to 30000 ms.
This is the child lifetime including shutdown, not just measurement time. A
separate helper setup allowance of 15 seconds covers PowerShell compilation and
job cleanup; process inspection also has a 15-second ceiling. Long performance
acceptance runs require a future separately reviewed mode.

The review JSON contains `authorized: true`, a named `reviewer`, `hypothesis`,
`hostClosedConfirmed: true`, a future `expiresUtc`, absolute `executable`, string
`args`, and nonempty `sources` and `binaries` arrays of `{path, sha256}`. Include
the executable itself in `binaries`; include all loaded native binaries and all
relevant source/orchestrator files. Every supplied hash is checked before launch.
The runner does not infer which dynamically loaded files are relevant; reviewers
must make this inventory complete. Hashes identify bytes, not source cleanliness
or reproducible build equivalence. Checkpoint source/build provenance before
creating a review record. A review record is an explicit operator attestation,
not a cryptographic authorization system.

A reviewed orchestrator can spawn a producer and receiver as one experiment.
Both inherit the same Windows job. The runner sets `LUX_EXPERIMENT_RUN_ID` and
`LUX_EXPERIMENT_MODE` (`cpu` or `hardware`) on the child environment. These are
coordination markers, not security credentials.

The exclusive lock is `%USERPROFILE%\AppData\Local\Lux\experiment.lock`, shared
by all worktrees for this Windows user, including separate sessions. It has no
automatic expiry or override. Resolume, Electron, standalone_host and lux-prefixed
processes are inspected before launch and cause refusal. Inspection failure also
refuses execution. Unmanaged programs launched afterward, renamed executables,
and another Windows account are outside this cooperative exclusion mechanism.
Keep Resolume closed throughout standalone experiments; do not launch unrelated
graphics experiments while the lock exists.

The helper creates the target suspended, assigns it to a Windows Job Object, then
resumes it. Descendants inherit job membership. At normal exit or deadline it
terminates the job and queries active process accounting until zero, with a
three-second cleanup bound. Kill-on-job-close covers helper termination. There
is no process-name kill or PID-tree traversal. Assignment errors leave the child
suspended and terminate that exact owned process. Any unconfirmed cleanup keeps
the lock. A successful normal parent exit still terminates remaining descendants.

Each run directory under `artifacts/experiments` contains config, source and
executable SHA-256 hashes, supervisor/child PIDs, UTC and monotonic timestamps,
timeout, outcome/exit code, stdout/stderr, child start record and cleanup result.
Child Stopwatch ticks include frequency; supervisor monotonic nanoseconds are
from Node's monotonic clock. Compare durations within a clock, not raw values
across clocks. On helper failure the final manifest reports cleanup-unconfirmed;
the earlier child record still identifies any launched child. Failure to persist
the final manifest retains the lock.

After a crash, inspect the lock's run directory and verify no experiment/job or
host remains before manually removing that exact lock. Never infer stale means
safe from PID absence alone. If the machine froze, preserve the failed run logs
and review the incident before another hardware run. Process supervision cannot
guarantee recovery from a driver, GPU, or whole-OS freeze.
