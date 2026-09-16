# Reusable Tracers Implementation Plan

Goal: render one shared tracer path snapshot through independent graph consumers and publish a reusable Wandering Tracers composition.

Approved design: typed explicit connections; path generator separated from appearance; automatic perimeter spawning; deterministic lifetime styles; overlay and painting consumers. Flow, obstacle, event, and feedback inputs remain future work.

## Contract

- Retain SDK 0.4.0 and legacy image-chain-v1 admission; new branching uses executionModel typed-image-graph-v1 and profile version 2.
- paths2d port descriptor: {kind:'paths2d',version:1,coordinateSpace:'canvas-height'}.
- Coordinates: origin canvas center, +x right, +y up, canvas height 1 and width aspect.
- Snapshot: {version:1,paths:[{id, generation, styleSeed, birthTime, lifetime, phase, opacity, points:[{x,y,width,distance,depositionTime}]}]}. id/generation/styleSeed nonnegative safe integers; finite values; points ordered by distance. Head is final point; tangent computed from adjacent points. Up to 32 paths, 256 points each. Immutable validated copies.
- SDK resource is branded with .data snapshot; evaluation.paths(portId, snapshot) returns frame-owned resource. evaluation.render(scene,camera,portId='image') returns owned image, multiple distinct output ports permitted. Typed outputs map. Signals remain existing internal support unless needed by demonstration.
- Final output is image, DAG up to 8 nodes, no unreachable nodes or cycles. Named typed ports; fan-out shares same frame snapshot. Existing nested single-image boundary remains supported.

## Tasks

- [ ] Contracts/compiler: paths validation/type metadata; version-2 DAG profile admission; named ports; SDK types; artifact execution model; regression and malformed-data tests.
- [ ] Runtime: paths resource ownership and immutable input views; evaluate DAG once/node/frame; multiple outputs; reset/dispose/failure lifecycle; branching tests.
- [ ] Tracer library: generator, renderer, composition and unrelated-background demo. Extract painting path consumer with same path coordinates, colors, hatch and transition behavior.
- [ ] Verify: focused tests/typechecks; isolated Studio GPU/graph/save-open demonstration; independent review; update/install/check skill; save reusable library bundle and scenes without replacing user files or running app.

## Ownership

Root owns tracer visual sources, integration, docs and actual GPU QA. Separate bounded contributors own compiler/contracts and runtime paths. They share this isolated checkout and do not edit each other's files. No main integration or installed app replacement before review and actual demonstration.
