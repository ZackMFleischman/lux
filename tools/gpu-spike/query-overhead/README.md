# Direct GPU query-cost diagnostic

This test measures the GPU queue interval added by the real `createGpuPassTimer`
timestamp writes, resolve and buffer copy in a controlled batch. It does not
measure CPU hooks, UI, all GPU queues, active GPU busy time, or full-Studio overhead.
Production modules are imported unchanged.

One timestamp-query device renders30 dependent1920×1080 frames per batch through
a fixed8-iteration shader. Both ping-pong textures reset before the first boundary
timestamp, giving baseline and routine identical inputs. The timer's eligible
first logical frame is sampled once per30-frame batch. Baseline uses its no-op API
while the routine hooks remain idle; JavaScript hook cost is outside this metric.

The staging wrappers are installed before the timer captures its originals.
They collect all body submissions and the timer's actual resolve/copy buffer,
then submit them between raw, unwrapped boundary passes in one real queue submit.
Native MAP_READ mapping is invoked only after that submit. An independent outer
validation scope covers submit-time errors after the timer's scope has popped.
Every batch drains the timer sample and maps before continuing.

Eight alternating warmup batches precede eight ABBA blocks (32 measured batches).
All raw endpoints and blocks remain in the report. A batch over100ms, failed map,
missing sample, dropped record or GPU error stops further work. The externally
reviewed Windows Job supplies the hard30-second process bound, including hangs.

Intervals subtract uint64 GPU timestamps before conversion. The report provides
eight paired effects, a descriptive Student-t95% interval, and an expanded
interval using an explicitly assumed100µs per-endpoint envelope (400µs for the
difference). Chrome's[documented quantization](https://developer.chrome.com/blog/new-in-webgpu-121)
motivates this conservative assumption; it is not a calibration or guarantee of
the pinned runtime's precision. Observed timestamp lattice is reported separately.
Percentages divide by the observed positive baseline mean, held fixed. A
resolution/noise-limited outcome is inconclusive; no full-Studio2% gate can pass.

CPU verification:

```
node --experimental-vm-modules --test --test-isolation=none tests/performance/query-overhead-*.test.mjs
```

Only the coordinator launches `main.cjs` under the existing reviewed experiment
runner, in a fresh Electron process with a30-second outer Job. There is no
unsupervised launch path. Failed/partial raw evidence remains diagnostic.
