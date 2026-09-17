# Fiber-Optic Heart — blind source draft

User authorization: write the proposed reference-image visuals in an isolated branch. Do not run, compile, launch, or visually test them yet. A later agent owns testing. No Library publication or merge is authorized by this handoff.

## Implementation plan

1. Add persistent looping paths using the existing paths2d contract.
2. Add a radial core image source and an independent path renderer with neon, traveling pulses, glossy ribbons, glass-style cables and collars.
3. Add an independent sparse dust overlay and wire a runnable SDK 0.4 scene.
4. Supply deterministic geometry tests and the exact testing handoff, without running them.

All source is local to this example. Existing Library entries remain unchanged. Follow existing Three/WebGPU node-material and image-input conventions. Reuse the path contract, not the watercolor appearance. Glass is stylized shading, not physical refraction. No new SDK or Studio capabilities are introduced.

## Acceptance

- Source represents all seven suggested elements with live numeric controls.
- Components have clear image/paths ports and bounded geometry/resources.
- Files are committed on an isolated branch, with deferred verification explicit.
- Later independent review, compilation, UI inspection and save/reopen remain unchecked.

## Source and testing handoff

Ticket: LUX-191. Branch: `codex/fiber-optic-heart`.
Base: `b4f327bdd5f44b5285fd278fe31ffdd15ebd406d`.
Worktree: `C:/Users/zFlei/repos/lux/.worktrees/fiber-optic-heart`.
Entry: `examples/components/fiber-optic-heart/composition.ts` (SDK 0.4).

Four leaf components: Radiant Core → Neon Cables & Ribbons → Luminous Dust,
with Looping Spline Paths feeding the renderer. The renderer combines neon,
pulses, broad ribbons, glass-style strips, and collars. Each style is controlled
on that renderer; these are not seven separately published Library entries.

Reuse: Lux paths2d resource shape, existing renderer image-input orientation,
Three node-material patterns, additive beam/particle techniques. The new source
does not copy the watercolor renderer or change the existing Library. The
Looping Spline Paths label describes the intended smooth curves; implementation
samples analytic closed curves into 96 segments, without spline interpolation.

**Verification status: no compilation, CPU tests, Studio launches, GPU rendering,
performance measurements, screenshot review or save/reopen were performed.**
Source inspection and Git bookkeeping are the only checks in the authoring task.

After the user authorizes testing, the next agent should:

1. Read AGENTS.md and Conductor context, then claim/reconcile LUX-191. Do not
   merge or publish on the basis of this source-only handoff.
2. Install dependencies in this worktree if necessary, without changing those
   under an active user Studio. Run `pnpm exec tsc -p examples/components/fiber-optic-heart/tsconfig.check.json`.
3. Run `node --test examples/components/fiber-optic-heart/geometry.test.ts`.
   These tests were authored but never executed; investigate rather than assume
   they pass. Verify generated snapshots against the runtime paths2d contract.
4. Compile the complete source bundle. Include all seven non-test TypeScript
   files in this directory, entry `composition.ts`, SDK `0.4.0`. Exclude tests,
   Markdown and tsconfig. Use `scripts/test-wandering-tracers.mjs` only as a
   reference for an isolated QA harness; it does not accept this visual.
5. Reserve GPU access with the current coordinator. Every automated launch must
   use `studioTestEnvironment()` and the same environment for its MCP adapter.
   Only close the process owned by that test. Do not connect to the user profile.
6. Start at 640×360, then inspect 1920×1080 and portrait. Capture the actual
   application and frames at separated times. Check path seams, polygonal joins,
   overlap order, alpha edges, input-image orientation, readability of the core,
   wide ribbons, rim highlights, dust visibility and collars following tangents.
7. Exercise every control, especially zero strands, zero brightness, zero dust,
   ribbon/cable counts exceeding strand count, minimum/maximum widths, negative
   pulse speed, paused control edits, Play/Pause/Reset and stable size variation.
8. Save/reopen outside temporary test artifacts, then try an invalid edit and
   confirm the last accepted preview and user files survive. Independently review
   code and actual screenshots. Record exact tested commit and remaining limits.

Known tradeoffs: fixed painter order, not depth-correct 3D interweaving; strips
approximate ribbon twist and glass highlights; no refraction, true tubes or
postprocess bloom. Pulses use normalized cumulative arc distance. Changing
speed can change phase. Dust uses up to 96 shared-material sprites. Visual
quality and runtime cost must be established by the tester.
