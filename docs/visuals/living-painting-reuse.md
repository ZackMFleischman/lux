# Reusing the painting components

## Add tracers to another image

Connect an image to Wandering Tracer Renderer and connect Wandering Tracer Paths to its paths input. The generator can also drive another compatible paths2d consumer. The renderer is independent of the painting fields. The convenience Wandering Tracers entry stores wiring and pins the two component revisions, rather than duplicating their implementation.

## Build the complete painting

Connect Organic Regions, Region Hatching, Animated Watercolor, Organic Boundary Ink and Composition Phrasing to their matching inputs on Region Styles & Split Transitions. Connect the same Wandering Tracer Paths output to both the styles component and Wandering Tracer Renderer. Feed the styles image into the tracer renderer for the final output.

## Edit a part

Select its graph node for its controls. The scene also exposes the original controls under stable names. The styles renderer has no duplicate controls: its appearance is driven by its five field inputs and the paths input. Each field is a typed shader contract; an unrelated renderer must implement that contract before it can consume the field. These fields are not standalone image filters.

Library links select published source; saved scenes also keep resolved source so they can reopen when the Library is unavailable. Update a Library entry deliberately to share an improvement. Fork a linked entry to experiment locally.
