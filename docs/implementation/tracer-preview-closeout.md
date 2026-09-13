# Tracer preview closeout

Decision: 12 September 2026 (13 September UTC). The user accepted the current
tracer as a usable preview release, authorized moving remaining validation
after tracer, and requested the verified branch be merged to main and pushed.
This supersedes earlier instructions that every original numerical acceptance
gate must pass before tracer completion. It does not mark those gates passed.

## Delivered scope

Studio supports multi-file TypeScript visuals, syntax coloring, save/build,
preview, dockable panes, preview fullscreen/popout, code-declared numeric
properties, guarded MCP editing/playback/capture, and scene persistence.
PNG/JPEG image authoring, transparency and immutable source export are delivered.
Installed sources start their bundled renderer without Studio. Automated native
checks and the recorded user checks cover rendering, alpha, independent legacy
sources, composition reopen and bounded renderer recovery within their stated
limits. The shipped visual-creation skill remains the authoring reference.

The release is ready for creative iteration. Dependable live-show performance,
clean-machine portability and complete GPU accounting are not certified.
See [progress](../../PROGRESS.md) and its linked evidence for exact coverage.

## Work after tracer

These lanes can proceed in separate worktrees when development is resumed.
No lane starts automatically as part of this closeout. Keep graphics tests
serialized, even when CPU development and review run in parallel.

| Order / lane | Remaining work | Risk / completion evidence |
| --- | --- | --- |
| Runtime, first concrete fix | Improve exported frame delivery; finish review of queued-source retirement and measured polling delays. | Current output can repeat frames. Compare actual delivery and preserve ownership/cleanup; transport IDs alone do not prove fresh rendered images. |
| Runtime, alongside delivery | Correct normal-stop diagnostic reporting, then complete restart policy and GPU resource accounting. | Stop can be reported as a copy deadline and omit summary evidence. Repeated faults/resource growth and explicit restart-to-image remain unverified. The dedicated Restart-control decision remains open. |
| Creative workflow, independent | Start filesystem-first projects and Git using the reviewed architecture and implementation plan; prioritize obstacles found while creating visuals. | Preserve manual editor drafts, revision checks, library references and scene/project boundaries. Do not restart completed parameter or image work. |
| Host validation, when convenient | Five-control Lux Spike Sphere gestures and composition save/reopen in Resolume. | Automated rendering passed; the user deferred the actual host check. No new manual QA is required for this closeout. |
| Distribution, before external delivery | Run exports with development files and tools genuinely unavailable. | A dependency audit passed, but this machine's test processes could still access the checkout. Require isolated-environment evidence. |
| Performance validation, parallel | Full GPU-work attribution and timestamp accuracy, monitoring-on/off overhead, sustained delivery/CPU/GPU/UI budgets, 600 matched control changes and long-run behavior. | Existing diagnostics cannot certify the original numerical gates. Preserve those targets and report incomplete metrics honestly; do not block creative feature work on inconclusive measurements. |
| Later product work | Continue graph/library/input features and compact UI polish in their existing dependency order. | Use the roadmap and concrete creative feedback; this closeout does not implement or complete those milestones. |

## Preserved receiver experiment handoff

The merge uses verified `codex/tracer-0.1` code at `f68e393` plus this documentation.
The pending timing/source-slot changes remain on `codex/parameter-integration`
at `ab32b16` and their isolated branches. They are not included in main.

- Timing baseline: `.worktrees/receiver-worker-timing/artifacts/receiver-timing-baseline`,
  run `9ed6224f-ab31-46bb-a3a0-e93530356f68`. The bounded run exited and cleaned
  up. Strict inspection failed: normal stop aborted one trailing copy after the
  measurement window and skipped the required host summary. Independent raw
  review validated 600 callback joins and observed roughly 15 ms worker sleeps.
  These are elapsed waits, not measured GPU execution costs or an acceptance pass.
- Treatment: `.worktrees/receiver-timing-treatment/artifacts/receiver-timing-treatment`,
  run `f6ee6d77-1079-459a-9ece-a69f103c3108`. The bounded run exited successfully
  and cleaned up; comparative inspection is deferred. Do not claim the buffer
  fix improved performance from launcher success alone.
- Both raw runs and worktrees are retained. Do not overwrite evidence, repeat a
  test to obtain a pass, or merge the pending fix without completing its review.

The progress automation is paused. After documentation, merge and push, stop.

## Merge verification

Fresh verification on the unchanged stable implementation: 150 unit tests,
184 Studio/DOM/worker/performance CPU tests and 15 native CPU tests passed.
Both TypeScript configurations passed. No Studio, Resolume or new GPU test was
launched for this closeout. Logs remain in the tracer worktree under
`artifacts/tracer-closeout/`. Existing manual and graphics evidence retains its
original scope. The main merge is a fast-forward to the same tested source tree
plus these documentation updates.
