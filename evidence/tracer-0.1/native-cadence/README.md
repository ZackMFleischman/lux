# Native cadence pilot

13 September 2026 UTC. Run `fd42da2c-c39b-4212-9dfe-6df071b929f8` completed
the automated 10-second cold-start pilot with the immutable spike-sphere export.
This measures test-host scheduling and elapsed plugin callback duration, not
the full 300-second performance acceptance run or actual Resolume.

| Observation | Result |
| --- | --- |
| Scheduled slots / actual plugin opportunities | 600 / 600 |
| Missed slots / actual opportunity rate | 0 / 60 Hz |
| Callback elapsed p50 / p95 / p99 / maximum | 0.0967 / 0.2496 / 0.4646 / 1.167 ms |
| Scheduling lateness p95 / maximum | 0.5448 / 7.2926 ms |
| Full-window endpoint overshoot | 0.4586 ms |
| No frame / newly selected transport frame / held transport frame | 254 / 148 / 198 |
| Supervised duration / outer limit | 13,808.537 ms / 30 s |

All opportunity records joined their exact callback ordinal and QPC bracket.
The independent window remains the full ten seconds, including cold startup;
it does not start at the first delivered image. Callback time includes driver
work and descheduling, rather than exclusive CPU execution time. The pilot uses
fixed deadlines and a high-resolution waitable timer; it neither catches up
with bursts nor reads pixels during measurement.

The repeated frames mean that 60 calls/second must **not** be presented as 60
fresh visual images/second. Transport IDs can also repeat the same worker image.
Delivery stages are being investigated separately before expanding the run.
The shorter duration and cold startup make this evidence ineligible to certify
the existing 30-second warmup/300-second acceptance procedure.

Native teardown and outer Job cleanup passed, with exit 0 and no timeout. Root
confirmed no remaining Lux, Electron or Resolume processes afterward. No user
installation changed; the run used a fresh private profile.

Reviewed source commits: `61b2bfe`, `55f522b`, `52eb252`. Root integration passed
15 native CPU tests and 7 focused inspector/options checks. The initial options
check used an older local native executable and failed; rebuilding from the
integrated source resolved that mismatch. Review also corrected stale-slot
admission and the inspector's handling of real native exit-record timestamps
before this first hardware run.

All 184 final input hashes were independently verified before launch. Test host
SHA-256: `e6cb61cd29dd80bfcd371781819a598534050e36be6d6e3ae9333ee36a25eaeb`.
Review SHA-256: `a1444c265409b5c2e19d96c0e547ad1b7e6bc9b87f1116b703436f76c58defef`.
The 105 installed runtime files were byte-identical to the original package:
release `e8611254431e3544ba01a73e84f0dcecf01b59c057a327a7d9d2c254bfb239f4`,
runtime `db7c70ff2b58e29cd281bd5e2e236266e29d1a6e78d6a3be44f721e8d65f0e90`.

See [inspection](inspection.json) and [raw-evidence manifest](manifest.json).
Original artifacts remain at
`C:/Users/zFlei/repos/lux/.worktrees/native-cadence-probe/artifacts/native-cadence-probe/`.

Independent raw review reproduced all 600 callback/slot joins and the reported
quantiles. First transport appeared at callback 255, 4,233.7486 ms into the
window. The remaining 5,766.2514 ms contained 148 distinct transport selections
and 198 holds, about 25.67 selections/s over that descriptive tail. Final producer
health showed worker frame 345, completed transport copies 177, and 131
backpressure observations. The main summary recorded 321 paints. These snapshots
have different endpoints and must not be treated as matching populations.
They suggest inspecting copy/slot throughput; they do not prove a shader bottleneck.

The lifecycle log has only the attempt-start record. Normal teardown is supported
by native deinitialization, producer `closed: true` with zero held/uncertain frames,
and outer Job cleanup; no separately timed normal producer exit is claimed.
Inspection SHA-256:
`0de0ec26ab5b1778b308541b4a3571c0b226a0ca8241463d39a9945636645172`.
