# Living Ornament roadmap independent review

## Verdict

The five-batch structure is sound and the ticket ranges cover F01 through F21 without a numeric gap. The plan correctly keeps one integrated review/publication cycle per batch and asks for actual visual iteration. The remaining precondition for parallel visual implementation is a versioned shader-field contract that cannot change the accepted Living Painting.

## Assessment and remaining actions

### 1. Dependency chain confirmed

The edit specifications record the complete LUX-170 → LUX-171 → LUX-172 → LUX-173 → LUX-174 chain. Conductor ordinary tickets correctly remain visibly `ready`; transactional claim eligibility rejects a ticket whose dependency is unfinished. No artificial blocked states are needed. Parallel work should occur only among lanes inside the claim-eligible batch after their shared contract is written.

### 2. Version the ornament contracts and preserve the old visual by construction

The current painting consumers require exact ABI, fragment, and value key sets. “Expand Organic Regions,” Boundary Ink, Watercolor, Phrasing, Hatching, or Styles under the existing v1 ABI would either fail exact-key validation or silently change a shared revision's visual meaning. Before LUX-171 lanes split, choose new Ornament component keys/ABI versions and document the minimal producer/consumer contract. Publish new immutable revisions without overwriting the v1 entries, keep the existing Living Painting composition and saved scene pinned to their accepted revisions, and run its 18s/42s pixel baselines after every batch that changes shared source.

### 3. Repeatable artistic evidence accepted

One attractive frame can hide seed-specific or temporal defects. Use the same compact evidence set for each art batch: full-frame and detail captures at fixed times for at least three fixed seeds, plus a sustained animation capture for motion batches. Review the following visible gates rather than only build success:

| Batch | Required artistic gate |
| --- | --- |
| LUX-171 | Each chosen seed visibly contains distinct silhouette families, at least one deep concavity, a thin neck/corridor, nesting, calm contour stretches, localized intricate stretches, a dominant large form, and readable warm/cool anchors. Reject self-intersections, accidental tangencies, uniformly busy boundaries, or composition that works only in a crop. |
| LUX-172 | Show every motif family at useful size, including narrow, concave, and large hosts. Spirals vary and pack without collisions; rings retain intentional gaps; petals are unequal and fitted; contours survive necks; ribbons show all requested cell styles. Retain visibly quiet or lightly patterned regions so the vocabulary reads as a composition rather than a catalog. |
| LUX-173 | Inspect a sustained sequence and fixed-time filmstrip. Region and motif identity must persist under deformation; marks remain attached unless their selected mode is explicitly flowing; growth is directional; local phrases do not pulse in lockstep; density/rest and warm/cool anchors remain legible throughout. |
| LUX-174 | Capture multiple structural events before, during, and after. Parent/child identity and motif inheritance remain traceable; events occur at deliberate bounded intervals; neck closure, division, and island birth do not pop, overlap, chatter, or continuously destabilize topology. |

`docs/visuals/living-ornament-plan.md` now records the three-seed, full/detail, and changed-motion evidence rule plus the cross-batch shape, motif, quiet-area, color, outline, motion-identity, and topology criteria. Record the reviewer-selected defects and resulting iteration in each batch evidence. This keeps the requested artistic iteration concrete without creating per-feature review tickets.

### 4. Define the LUX-170 safety boundary beyond “more than eight”

Removing the component-count constant should leave compositions bounded by admitted source bytes, control/resource budgets, evaluation work, and cycle/provenance checks. The demonstration should include a representative Ornament-sized graph and a substantially larger valid graph, plus rejection at the first real resource boundary with an actionable error. Cover the compiler, runtime plan, control snapshot, save/reopen, and invalid-edit paths with the same graph; otherwise a hidden adjacent quota may simply replace the eight-node error.

### 5. F01–F21 traceability confirmed

`docs/visuals/living-ornament-plan.md` maps every feature to its batch and component ownership. It also makes the initial LUX-171 and completed LUX-173 portions of F15/F16 explicit. Batch evidence can use that table as its checklist without adding tickets or review stages.

## What is already strong

- The roadmap protects the accepted painting at the epic level and creates a separate Living Ornament scene.
- Pattern work waits for a readable flat-color/outline composition, which prevents detail from hiding weak shapes.
- LUX-172 includes concrete motif-specific fit criteria rather than merely listing modules.
- LUX-173 explicitly checks identity, texture sliding/reseeding, uniform pulsing, density/rest, and color anchors.
- LUX-174 separates structural-event geometry from style inheritance and calls for before/during/after inspection.
- Each child includes actual Studio rendering, Library publication, save/reopen, failed-edit preservation where relevant, independent review, and one batch-level merge.
