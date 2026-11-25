# LUX-156 independent Library review

## Verdict

No remaining blocking source finding in the scoped LUX-156 diff against `8a5bc7a966f63cd70b969b867f1929150febcb77`.

The implementation publishes the path generator and renderer as independent typed Library entries. The composition entry stores only wiring source plus exact dependency references. Resolution expands those pinned revisions for validation and scene mounting, while the saved scene retains a complete source fallback.

## Reviewed behavior

- Library manifests retain authored source separately from optional `{ componentId, revision, mountPath }` dependencies.
- Exact-revision reads, recursive expansion, cycle rejection, identity/revision checks, case-insensitive mount collision checks, the 32-file/1 MiB source quotas, and the eight-instance/depth bounds fail closed.
- Create and update validate the expanded closure before committing a catalog revision. Updating a dependency alone does not retarget a wrapper; adopting it requires a new wrapper revision with a new pin.
- Seed reconciliation imports and verifies all available immutable history for both equal-head and fast-forward cases before advancing the catalog. Divergent historical bytes are archived and rejected rather than overwritten.
- Studio resolves top-level entries plus their pinned dependencies before mounting. `SceneLibraryLink.files` records every expanded file, so save/open and Fork retain a complete fallback if the Library is unavailable.
- MCP, preload, renderer client, and authoring-session paths carry optional exact revisions and dependency rows consistently.
- Typed-leaf Library validation builds compile-only providers/consumers for supported `image` and `paths2d` ports, while rejecting signal ports and preserving the existing image-leaf and composition paths.
- The renderer no longer imports a generator-owned helper type. `tracer-texture.ts` derives its snapshot type from SDK `Paths2DResource['data']`, so the renderer entry owns only its three declared files.

## Findings resolved during review

1. Seed reconciliation originally returned immediately for an equal current head, leaving older seed revisions unavailable to exact dependency pins. The first fix covered equal heads; review found the same gap during a seed fast-forward. The final implementation verifies the complete available seed history, backfills missing revisions in both paths, and includes regressions for equal-head backfill, fast-forward backfill, and divergent-history preservation.
2. The first actual independent publish exposed a type-only import from the renderer bundle into generator-owned `tracer-state.ts`. The renderer now uses the public SDK path resource type; the independent wrapper GPU scenario passes with only the intended files.
3. Documentation and runner guidance now describe exact reads, pinned dependencies, the three-entry ownership split, and both independent GPU scenarios. The scoped base diff passes `git diff --check`.

## Evidence

- Core store/dependency suites: **28 passed, 0 failed**, including immutable pins, recursive expansion, cycle/identity/mount/quota bounds, failed-validation atomicity, and both history-backfill variants.
- Focused authoring and typed-leaf validation tests and repository TypeScript checks passed in the implementation run.
- `gpu-independent-wrapper-1789542644630/result.json`: actual Studio published the two typed leaves and the reference-only wrapper, rendered it, saved/reopened it, and preserved the accepted preview after an invalid edit.
- `gpu-independent-direct-1789543215846/result.json`: with the active test preview paused before replacement, actual Studio linked the generator and renderer directly, rendered, saved/reopened, and preserved the accepted preview after an invalid edit.
- `gpu-independent-wrapper-1789542644630/independent-library.json` records exactly:
  - generator: `paths.ts`, `tracer-state.ts`;
  - renderer: `renderer.ts`, `tracer-texture.ts`, `tracer-spline.ts`;
  - wrapper: `overlay.ts` plus two revision-1 dependency rows.
- The saved wrapper scene contains the complete six-file expanded Library fallback under one top-level wrapper link.
- `painting-extractions/tracer-comparison-18.json`: approved baseline versus dependency-based painting at a deterministic 18-second checkpoint is an exact 1920×1080 pixel match (`maxChannelDifference: 0`, `changedChannels: 0`).
- The 1920×1080 independent wrapper and direct-leaf captures show the expected watercolor output and readable graph connections. The direct scene visibly links the generator and renderer as separate top-level Library entries.

## Runtime transition note

Two earlier long single-process direct-leaf scenarios rendered, captured, and saved successfully, then hit the existing initialization-progress watchdog on immediate `scene.open`. Neither reported a GPU-process failure. A final serialized run paused the active test preview before replacement and completed the direct save/reopen path without changing watchdog policy. The failures remain useful transition-load evidence, while the passing run closes the LUX-156 direct-link workflow.
