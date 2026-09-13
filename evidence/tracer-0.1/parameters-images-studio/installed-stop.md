# Installed hung-JavaScript physical-stop checkpoint

One independently reviewed native probe passed on 13 September 2026 UTC.
Probe source `ee969f9` is integrated as `d143d44`. No Studio or Resolume process
was active; the current health-v2 runtime was exported, privately installed and
registered before the run. No public source registration was changed.

| Identity | Value |
| --- | --- |
| Experiment | `dc51615b-96ef-4a54-8278-695dba2b1d78` |
| Release | `20a7afdf026969ca4fed51fc97756353d669f649c3fddd33bc85643d22e25b4a` |
| Runtime | `6f1f00664d3db545d4f9e722a298b02403857136d2eae7c5489182472541357f` |
| Source | `4360862d38c743c2d54c9fde150912f15a77b926ba46f1fad730b89224005acf` |
| Instance | `00000000000027f00000009a17f02cdf` |
| Failed attempt | `1774d62c3ea9ed8aa69ecb8b32e84dbf` |

The diagnostic observed the expected magenta image, recorded QPC immediately
before calling the actual FFGL arm setter, and required a durable fixed-token
record from the worker entering its non-yielding update loop. The host then
submitted disarm for any subsequent runtime; the blocked worker did not
acknowledge that submission. The supervisor force-stopped the exact failed Job.

All timestamps share QPC frequency 10,000,000 Hz:

| Event | QPC ticks |
| --- | --- |
| Before triggering host setter | `661889411039` |
| Durable hang marker observed | `661889794017` |
| Host disarm submitted | `661890025148` |
| Supervisor stop requested | `661903780474` |
| Native termination requested | `661903790730` |
| Root signaled and Job active processes zero | `661904633231` |

The conservative trigger-to-physical-exit upper bound is **1,522.2192 ms**, below
2 seconds. Starting before dispatch includes control delivery and watchdog time;
it is not an exact hang-onset timestamp. Matching lifecycle records have no lost
or incomplete entries. The native host completed 144 callbacks after the marker,
deinstantiation/deinitialization succeeded, and the outer Job confirmed cleanup.
The 9,977 ms work window and 30-second outer budget were respected; total
supervised operation including preflight was 14,118 ms, with exit 0/no timeout.

Artifacts are in
`C:/Users/zFlei/repos/lux/.worktrees/installed-stop-probe/artifacts/installed-stop-probe/`:
`review-authorized.json`, `last-experiment.json`, `physical-stop.hang.json`,
`inspection.json`, the experiment's marker/manifest/logs, and the private
installed attempt's lifecycle log (path recorded in inspection).
Inspection SHA-256:
`5e5430804db5d04e8925124c450c928334eb5195f5b95a54952d5493db6f9f15`.

This establishes physical termination for one generated update-loop hang in the
native diagnostic host. It does not establish initialization-hang timing, actual
Resolume fault behavior, callback latency budgets, the first recovered image with
current controls, explicit-restart-to-image timing or GPU-resource accounting.
Those remain distinct checks. No missing endpoint is replaced with a banner,
termination request, worker-ready response or process-exit assumption.
