# LUX-182 independent review

## Verdict

No blocking finding remains in the reviewed stable per-instance control variation slice.

## Reviewed behavior

- `frame.sampleControl` keeps base controls unchanged and supplies stable, bounded per-instance values in flat and composition runtimes.
- Runtime writes retain instance, generation, revision, schema, node, and control guards. Variation bindings use the existing single-binding-per-control model and persist through the existing scene animation field.
- Studio, bridge, MCP, runtime-contract, SDK, and composition propagation agree on the three distributions and optional string or safe-integer keys.
- The initial numeric/string key collision was fixed in `570bf219` by including the key type in the sampling identity, with a regression test.

## Evidence

- `artifacts/birds/combined-qa.json`: actual isolated Studio run at 1920x1080 with no fault; spread size, centered flock speed, and random excursion-speed bindings survived save/reopen. Its early FPS figure was approximate, so it is not used as acceptance evidence.
- Focused CPU tests supplied by the implementation agent passed, including runtime, persistence, compiler, and interaction coverage.

## Limit

The native run captured the rendered result but not the Parameter Inspector itself. Its add/edit/remove flow has RTL interaction coverage, so this is a narrow visual-evidence limit rather than a functional blocker for the prototype.
