# Automated GPU overhead measurements

12 September 2026 local time (13 September UTC). Both automated hardware runs
completed successfully with independent method, input-hash and raw-result review.
Neither needed manual QA. Production monitoring code was unchanged.

| Test | Observed result | Interpretation |
| --- | --- | --- |
| Direct query/resolve/copy cost | Baseline 2.433020 ms; routine 2.441026 ms per 30-frame batch. Difference +0.008006 ms, or +0.3291%. | Small observed queue-time difference on this controlled workload; not full Studio overhead. |
| Sphere render/compute pass comparison | Mean paired change +2.3795%; paired bootstrap interval -12.2952% to +17.0541%. | Too noisy to resolve a small effect. This is neither a pass nor a failure of the 2% target. |

## Direct query test

Run `eff1cc1b-f3d4-4a3a-84b9-698f94ff0d47`, harness `4263b3b`.
Eight warmup batches followed by eight ABBA blocks (32 measured batches), each
containing 30 fixed 1920x1080 render passes. Identical initial textures are reset
before each measurement. The unchanged production timer samples one frame per
batch in routine mode. All command buffers, including its query resolve/copy,
are staged into one actual submission; mapping begins only after submission.
Independent timestamp boundaries measure the GPU queue interval and exclude
texture reset, CPU encoding and the final measurement readback.

All 40 batches and all 20 expected routine samples were retained; zero dropped,
failed or pending samples and zero validation errors. Student-t interval across
the eight block effects: +0.0008541 to +0.0151579 ms per batch. Mean amortized
difference: +0.0002669 ms per logical frame.

The report separately applies an **assumed, uncalibrated** 100,000 ns endpoint
error envelope, yielding -0.3991459 to +0.4151579 ms per batch. The observed
endpoint lattice was 32 ns; that is not a calibration of accuracy. The wide
assumption-expanded interval remains inconclusive. CPU hooks, scheduling
behavior of normal individual submissions and full Studio cost are excluded.
Queue elapsed time is not a measurement of active GPU busy time.

The supervised run took 4,583.9624 ms within its 30 s Job limit. Exit 0, no
timeout, confirmed descendant cleanup, and root found no residual graphics
processes. See [raw evidence](direct-query.json) and [recomputed result](direct-query-summary.json).

## Sphere comparison

Run `2eb6cf03-6e40-4163-b47f-9438fe9adbe4`, harness `e804759`.
Five alternating baseline/routine pairs used the same saved spike sphere,
five control values and fixed simulation time, on NVIDIA Turing with pinned
Electron 44.3.0. Each leg had 60 warmup and 240 measured frames. An independent
reference timer sampled frames offset from the real routine query frames.
All 80 measured reference samples and all expected routine queries were present,
with zero dropped, failed or pending queries.

The reference measures render/compute passes on non-query frames. It omits
uploads, copies and the direct collector query/resolve work. Pair effects were
+0.10%, +23.81%, -13.59%, -17.19%, +18.77%. The prior observed 65,536 ns endpoint
uncertainty assumption produces bounds of -35.48% to +63.01%; the bootstrap
does not eliminate that uncertainty.

The measured trial lasted 56.0196 s. Application closure and the complete
Node/Electron Job cleanup passed within the separate reviewed 120 s limit;
the generic experiment runner's 30 s limit was unchanged. See
[raw samples and analysis](sphere-reference.json).

## Status and next measurement work

Automated collection is complete. The **full Studio <2% gate remains open**.
Before another acceptance run, validate timestamp accuracy for this pinned
backend and a reference covering the complete monitored workload. Repeating
the same noisy test alone would not establish the missing coverage or accuracy.

Integrated CPU verification: 26 timer and diagnostic tests passed using Node 24.12.0 with
`--experimental-vm-modules --test --test-isolation=none`. The initial root command
omitted the VM flag and failed four VM-based tests; rerunning with the required
flag passed all tests. Neither hardware run overlapped another graphics test.

Original local artifacts are under `.worktrees/query-overhead-probe/artifacts/query-overhead/`
and `.worktrees/gpu-paired-diagnostic/artifacts/gpu-paired-reviewed/`. The
committed evidence retains the raw measurement populations without unrelated
machine process inventories.

Original direct raw SHA-256:
`89c1e661f9af142f364b65cf8fa815e760982505391d1c45d38a2fd8165b1dc4`.
Direct inspection SHA-256:
`b1d04a34345e978ef803aef67c0ae7a66f2b74261866d757401ed6cf58bd924a`.
Original full reference result SHA-256:
`5857f49ac953602a852ff5a4c52e47483dd34bb19a7870f6b61343636e9f8c67`.
Root recomputed both analyses from the committed raw evidence and obtained exact
matches after integration.
