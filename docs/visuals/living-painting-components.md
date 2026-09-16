# Living Painting reusable components

The accepted painting is the visual baseline. Preserve its shader math, controls, seeds, timing and two render passes (painting and tracer overlay).

| Milestone | User result | Validation before publication |
| --- | --- | --- |
| Independent tracers | Use the paths generator, renderer, or pinned convenience composition | Direct and wrapper Library scenes; exact checkpoint comparison; save/reopen |
| Organic regions | Adjust region density, growth and flow on a separate node | Same shader bytes and matching timed frames |
| Hatching | Reuse varied directional, curved and crossed line fills | Matching detail and quiet areas |
| Animated watercolor | Reuse drifting cool washes and warm pools | Matching colors at several times |
| Boundary ink | Reuse uneven warm outlines and paper detail | Matching edge weight and grain |
| Composition phrasing | Reuse slow tension/release and shared motion timing | Matching temporal progression |
| Styles and split transitions | Reuse the painting renderer with region changes from paths | Matching cuts, daughter styles and smooth transitions |

Extract one module into the composition at a time. Preserve before/after captures, publish its source to the Library, commit and merge before integrating the next. Independent infrastructure, extraction and review work may proceed in parallel. GPU sessions and integration are serialized.

## Shader-field connection

The SDK adds a bounded `shader-field` resource with an exact ABI string. Its immutable frame snapshot contains named WGSL fragments and numeric values. The consumer validates its required fragment/value names, inserts code at its original positions once, and updates existing uniforms each frame. There is no new shader linker or intermediate image pass.

The ABI identifies an explicit producer/consumer agreement. A fragment may rely on documented shader variables or helpers supplied by that consumer. It is not automatically an image overlay or a generic CPU geometry query. A compatible renderer can reuse the module; an unrelated renderer must implement the ABI.

Five field-producing nodes feed the final Styles renderer. Together with Tracer Paths and Tracer Renderer, the complete scene fits the existing eight-node limit. While extracting, the original painting component retains the remaining code and serves as the terminal renderer. Its final publication completes the Styles milestone.

## Evidence

Deterministic QA freezes visual time and replays tracer generation at 60 Hz in an isolated real Studio instance. It does not alter production shader math. Full-resolution captures are compared numerically and inspected alongside the actual Studio window. Normal playback, Library readback, save/reopen and failed-edit preservation are also checked.

The original saved scenes remain separate. Each publication creates a new saved scene. An older running installed app is preserved; new resources require a current Studio build.
