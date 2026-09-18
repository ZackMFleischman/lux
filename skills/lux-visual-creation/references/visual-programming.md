# Visual programming in Lux

This reference describes checked SDK 0.2.0 visuals, SDK 0.4.0 image composition, legacy 0.1 support, and Three.js 0.186.0. Use discovery from the adapter paired with the running Studio build plus actual tool results. Discovery describes checkout files and separately reports `runningStudio.capabilities`; check compatibility for the selected SDK; see [connection](studio-tools.md).

## Source and lifecycle

A source bundle contains `sdkVersion`, an `entry` such as `visual.ts`, and a `files` record mapping relative `.ts` paths to source text. v2 adds `sourceVersion: 2` and `assets`; preserve those fields on edits. Helpers are normal submitted modules, for example `import { palette } from './lib/palette.ts'`. The compiler accepts at most 32 files and 1 MiB aggregate UTF-8 code. Use simple ASCII path segments, forward slashes, explicit `.ts` extensions, and no case-only collisions.

The entry must directly `export default defineVisual({...})`, importing `defineVisual` from `@lux/visual-sdk`. SDK 0.2 requires `{ controls, create }` and may add a literal `story` capability declaration on a supporting Studio build; see [Story playback](story-playback.md). `controls` is a static literal map of control descriptors (number, boolean, enum or trigger) with no fixed control-count ceiling: `{ type: 'number', label, default, min, max, step?, unit?, description?, group? }`. The normalized schema must fit within 32 KiB of UTF-8 metadata. Use camelCase IDs. `description` is optional plain text, up to 512 characters, that Studio shows as help on hover or keyboard focus. No computed metadata, spreads, functions or imported declarations. `frame.controls` is typed from those IDs. Empty `{}` means no controls; do not invent Intensity. The source bundle must set `sdkVersion: '0.2.0'`. Legacy 0.1 sources retain `{ create }` and their compatibility intensity field. Discovery's contract and parameter types describe exact bounds.

Controls also support booleans and named choices when the running Studio reports `parameterKinds` containing `boolean` and `enum`. Declare them as literal data:

```ts
controls: {
  trails: { type: 'boolean', label: 'Trails', default: true },
  palette: {
    type: 'enum', label: 'Palette', default: 'cool', presentation: 'segmented',
    options: [{ id: 'cool', label: 'Cool' }, { id: 'warm', label: 'Warm' }],
  },
}
```

Use `frame.controls.trails` as a boolean and `frame.controls.palette` as the stable option ID. Enum presentation can be `dropdown` (default), `radio`, or `segmented`; it does not change the saved value. Renaming/reordering options preserves an existing selected ID; removing it uses the new default. Booleans and enums support reset to default but not numeric animation, variation, or input mapping. Current Resolume export rejects these types explicitly; do not substitute numbers merely to claim equivalent export behavior.

For a momentary action, declare `regenerate: { type: 'trigger', label: 'Regenerate' }`
in the same literal control map. It may have `description` and `group`, but no
default or value. Handle it inside `update(frame)`:

```ts
for (const event of frame.events) {
  if (event.controlId === 'regenerate') {
    // Change this instance's authored state once.
  }
}
```

Each event has `type: 'trigger'`, a typed `controlId`, `commandId` and `sequence`.
The ID is absent from `frame.controls`. Events route to the addressed component
instance, including public aliases. They are not repeated on later frames or
saved in scene values. Make the action work with zero delta while paused; avoid
using elapsed time as evidence that a button was pressed. Studio renders a real
button and acknowledges a completed frame. Numeric modulation and current
Resolume export do not support triggers. Require the running app's
`controlTriggers` capability before authoring or invoking them. See
[trigger controls](../assets/trigger-controls.ts) for a complete example.

When one numeric control should differ across repeated elements, read it with `frame.sampleControl?.('size', instanceIndex) ?? frame.controls.size`. The first argument is a declared numeric control ID. The second is a stable string or whole-number identity for the element, not a frame counter. Studio returns the ordinary base value when no compatible variation is configured; the optional call and fallback also keep the source runnable in an older Studio. Random gives stable uniform values, Center-weighted favors the base, and Spread gives consecutive numeric keys an even artistic range. All results clamp to the declared minimum and maximum.

## Readable authored TypeScript

Source is part of the creative workflow. Write TypeScript for a person reading and editing it in Studio. Use one import member per line when an import is long. Put metadata, control declarations, lifecycle methods, and object literals on several indented lines. Give intermediate shader expressions and resources their own named declarations. Put one statement on each line, especially in `update`, `reset`, and `dispose`.

Keep a short object or method on one line only when it remains easy to scan. Preserve existing comments, file layout, controls, and behavior when reformatting a user visual. Do not minify, compress, or replace a complete source bundle merely to alter formatting. A formatter may be used if it is already available, but Lux does not require a formatter dependency or a formatting build step.

## Typed image composition

For TypeScript annotations, `ComponentDefinition` retains its existing code-component meaning (including `create`). `CodeComponentDefinition` is its explicit equivalent; use `AnyComponentDefinition` when an annotation must accept either code or graph implementations. `defineComponent` infers the correct result for each form.

SDK 0.4 uses `defineComponent` for reusable code components or graph components, and `defineVisual` for the runnable entry graph. Code components declare `metadata` and `create`; graph components declare the literal graph fields below. Existing `defineComposition` entries and reusable groups remain compatible without source migration. A graph component may import code or graph components recursively, but cannot import a runnable `defineVisual` as a component. Code metadata statically declares image, paths2d or shader-field ports, typed controls, descriptions, and lifecycle. A code component instance implements `update(frame)`, `evaluate(inputs, evaluation)`, `reset(seed)`, and `dispose()`. Its evaluation returns `{ image: await evaluation.render(scene, camera) }`; an effect reads `inputs.image.texture` and renders its own output. Lux owns intermediate render targets and releases them only after downstream GPU work settles.

Each composition statically lists `definitions`, `nodes`, `edges`, one `output`, and selected `expose` rows. When discovery reports `authoring.graphIds.kind: 'uuid-or-readable-v1'`, default node and edge IDs to stable readable names matching `[a-z][a-z0-9._-]{0,95}`, such as `starfield`, `quasar.disk`, and `disk-to-bloom`; existing UUID IDs remain valid. They are unique within one immediate graph, and nested paths preserve each segment. These graph-local IDs do not replace component, Library, project, scene, request, revision, or runtime-instance IDs. A reusable composition may declare legacy `input: { nodeId, portId: 'image' }` for one image input, or `inputs: { image: { nodeId, portId }, bodies: { nodeId, portId } }` for typed ports inferred from immediate child inputs. `input` and `inputs` are mutually exclusive. A runnable root omits both. `label` gives the group a readable Graph name. Each exposed ID is an alias for exactly one `{nodeId, controlId}` target, which may itself be another composition exposure. Lux resolves the chain to one canonical leaf control. The alias keeps that control's description, so authors do not duplicate help text. For example, two root nodes using the same two-effect composition can expose `segmentsA` and `segmentsB`; changing one does not mutate the other. Stable full node paths persist compatible values and local LFOs across save/reopen, declaration reorder, and a linked component revision. Added, removed, unit-changed, and out-of-range controls are reported; incompatible values reset to the new declaration default. A rebound alias does not transfer a saved value to another instance.

Default to a small runnable root with nested logical components when the behavior has a supported contract and independent reuse value. A useful Quasar-shaped arrangement could keep the scene root responsible for starfield and demonstration objects, with a nested `Quasar` composition that owns lensing, jets, and bloom. Each leaf must render, generate, or transform a real typed value for a compatible consumer; a node that only passes an image through is not a reusable component. An explicit rapid-prototyping request can start as a direct visual or compact scene-local prototype, then revisit boundaries as the look stabilizes without waiting for a separate reuse request. Put a reusable leaf and its private helpers in a clearly named source folder, and make publication a separate Library decision after the interface is stable.

### Camera-controller field

Use this only when discovery from the adapter paired with the running Studio reports `composition.cameraController` as `{ abi: 'lux/camera-controller/v1', controlIds: ['yaw', 'pitch', 'panX', 'panY', 'dolly', 'roll'], studioPreviewGestures: true }` and reports compatible running Studio support. The zero-render CameraController leaf outputs `camera` as `{ kind: 'shader-field', version: 1, abi: 'lux/camera-controller/v1' }` and owns those numeric controls, each defaulting to zero. A compatible 3D consumer declares the matching camera input, reads it with `readCameraController(inputs.camera.data)`, and calls `resolveCameraPose(authoredBase, values, { focusDistance, minDistance? })` immediately before rendering or updating camera uniforms. It receives `{ position, target, up, forward, right }`; values are additive rather than accumulated, with radians for angles and focus-distance-normalized pan/dolly. The controller only affects a consumer connected by that explicit field edge with all six controls exposed. It does not alter existing authored camera controls or add gesture support to arbitrary scenes, 2D visuals, or image postpasses.

Graph always shows a selectable **Scene** root for an accepted visual. Existing SDK 0.1/0.2 direct visuals also show one selectable **Visual** code component; selecting it opens the same controls and animation editor with the existing empty-path identity. This is a view adapter, not an added persisted graph node. SDK 0.4 graphs show their real immediate children. Selecting a leaf edits that instance. Selecting a graph component edits its exposed controls; **View inside**, Enter, or double-click reveals its immediate children, with a concise **Scene** breadcrumb and Back navigation. **View inside** is hidden unless the selected node is a graph component. The graph component Inspector and child Inspector address the same canonical leaf state. Graph selection and component focus are separate, so navigating does not silently retarget a control edit.

### Studio control animation

Studio can attach one compact LFO to a numeric control on the currently selected Graph node. The saved control value remains the base value, while each preview frame evaluates `clamp(base + amount × waveform, min, max)`. Available waveforms are sine, triangle, saw and square. Period accepts finite values from 0.05 through 3600 seconds; amount is a finite nonnegative peak distance in the control's declared units; start phase is a finite fraction from 0 through 1.

The LFO follows the scene clock: pause freezes it, Play resumes it, and scene Reset or **Restart animation** returns it to the configured start phase. Turning it off outputs the base value and retains the frozen oscillator phase for later resume. Editing the base moves the animation center immediately. The Inspector shows clamped extrema and reports when the declared control range limits them.

Scene Save/Open stores the base values and compatible per-instance bindings. Component bindings include node, component definition and control schema identity. Flat scene bindings use the declared control schema identity and survive compatible source edits. When a linked component update removes or changes the target incompatibly, Lux keeps the affected binding disabled with a visible issue and never retargets it by list position. Removing the animation deletes the binding. Control animation applies to declared numeric scene controls (SDK 0.2 and legacy 0.1) and SDK 0.4 Scene exposures or selected Graph controls; it is not a shared modulation source, graph editor feature or MIDI mapping.

After the user explicitly connects one Studio audio input, the same editor can add a continuous audio-band response or a kick-transient response. Continuous bindings select Level, Bass, Mids or Highs and tune attack, release and amount. Kick bindings tune sensitivity, a 0–2000 ms retrigger interval, linear or exponential attack/release envelope, and amount. All bindings share one analyzer configuration, keep the saved manual value as their base, and target the same stable scene/component identity as an LFO. Device identity remains a local preference and is not written into the scene. Pause fences newly detected kicks so they do not replay on resume; reset clears the current envelope; disconnect releases toward the base. Kick detection does not estimate tempo or BPM, and Studio audio capture does not establish native host FFT support.

## Shared components

The standard Library stores complete SDK 0.4 component bundles under stable IDs and immutable source revisions. Its shipped seed includes the **Prismatic Ball** zero-input image source. Checkout profiles for one Git repository share its marked repository-owned `library/` directory, including profiles launched from linked worktrees. A desktop build records that canonical location and writes to the same library while it remains available. A standalone installation whose recorded repository is absent uses the storage path labeled **Standalone fallback** in the Library panel and the packaged `library/` seed. When the marked repository returns, nonconflicting fallback additions and updates with matching immutable history merge into it; permission or corrupt-marker errors are surfaced and never select the fallback. Repository commits and desktop releases distribute reviewed components to another machine; there is no remote catalog publication. The connected create/update path accepts independent image/paths2d/shader-field leaves and SDK 0.4 compositions with supported typed inputs. MCP initialization and `discover` supply compact names, descriptions, stable IDs, and revisions without source. Choose likely matches from that reusable metadata and call `lux.library.read` only for selected components. Use `lux.library.list` for an explicit refresh after an external change, not before every edit. Create and update responses carry refreshed metadata. Link through `lux.studio.build.libraryLinks` using `{ componentId, mountPath }`; import the component through files mounted below that path. Two scene instances of the same linked component keep independent graph-local node paths and controls.

Use `lux.studio.save` to save the current scene to an explicit absolute `.lux-scene` path after `lux.studio.read`; pass its `expectedDraftVersion`. Existing paths require `overwrite: true`. `lux.studio.open` also takes an absolute path and expected draft version. It refuses dirty source, controls, or library links unless `discardDirty: true`, and an invalid scene leaves the current draft and preview in place.

Create and update are full-source operations. They are the only authoring operations that add or revise reusable library entries; editing, building, or saving an ordinary scene does not publish its source. `lux.library.update` requires the current `expectedRevision`. Studio validates and builds the candidate before activation, so a stale revision or invalid source cannot replace the working library entry. Linked scenes store the resolved revision and mounted source. They resolve the latest revision on load or rebuild, offer Apply update while running, and fall back visibly to the saved source if the latest candidate cannot run. Forking retains those files in the scene and removes the link. Legacy profile libraries migrate into the shared library without changing IDs or revisions. A conflicting migration is retained separately and reported instead of silently replacing either source.

After recursive expansion, compositions admit one or more reachable leaves without a fixed component-count ceiling, one final image, and at most eight composition levels. Source/metadata byte budgets, compilation deadlines, resource limits, and device performance still apply. Linear image chains retain `image-chain-v1`. The `typed-image-graph-v1` profile also admits named image/paths2d/shader-field ports and acyclic fan-out; every input has exactly one writer. A nested composition may expose supported typed input ports targeted at immediate child inputs. Delays, feedback, signal ports, and interactive rewiring remain unavailable. Prefer SDK 0.4 when supported parts have meaningful independent reuse; keep SDK 0.2 for a self-contained visual that gains nothing from decomposition. Put behavior and its controls on the owning component, then expose useful controls through composition aliases. Use named control groups for related editing tasks. Source metadata is extracted without executing authored code, and runtime still imports only the exact sealed linked artifact and recursively authenticated definitions.

| Hook | Responsibility |
| --- | --- |
| SDK 0.2 `async create(context)` | Allocate a visual's scene, camera, geometry, materials, uniforms and state; return `update`, `render`, `reset`, and `dispose`. |
| SDK 0.2 `update(frame)` | Change transforms and uniform values from `timeSeconds`, `deltaSeconds`, and `controls`. Runs even for a paused parameter change. |
| SDK 0.2 `render(target)` | Return `context.renderer.render(scene, camera, target)`. Lux owns the renderer, output target, frame scheduling and GPU lifecycle. |
| SDK 0.4 `update(frame)` | Update component-owned transforms and uniforms before evaluation. |
| SDK 0.4 `evaluate(inputs, evaluation)` | Return output values; for this profile return `{ image: await evaluation.render(scene, camera) }`. |
| SDK 0.2/0.4 `reset(seed)` | Reset visual- or component-owned mutable simulation state. Lux resets its clock and seeded random generator before calling this hook. |
| SDK 0.2/0.4 `dispose()` | Dispose owned geometries, materials and textures, including replaced resources; release subscriptions if used. Removing a mesh alone does not free its GPU resources. |

For continuous motion, derive angles and noise offsets from `frame.timeSeconds`. It follows Lux playback/reset. Use `deltaSeconds` for a simulation that genuinely needs integration; reset its accumulated state. Avoid a separate animation loop, browser wall time, or TSL's automatic timer for playback-sensitive movement. Feed a `uniform` from Lux time instead.

`context.random()` is seeded by `context.settings.seed`. Build random initial states from it for repeatability. If reset must regenerate that state, rerun the same initialization using the reset generator; an analytic animation can have an empty reset hook because its next update reads the reset clock. `frame.events` is currently empty; audio-reactivity inputs are not implied by its existence.

## Primitives that compose a visual

- **Scene and camera:** Three scene graph, `Mesh`, groups, orthographic or perspective camera. Use `context.settings.width / height` for aspect ratio. Frame the largest expected displacement, not just the undeformed geometry.
- **Geometry:** planes and circles for graphic compositions; spheres, boxes, torus shapes or custom `BufferGeometry` for volume. Share geometry/materials across similar objects; use instancing for many repeated objects. Allocate once, not every update.
- **Node materials:** import materials such as `MeshBasicNodeMaterial` or `MeshStandardNodeMaterial` from `three/webgpu`. Basic materials are useful for flat graphic output; Standard materials need lights and suitable normals for volume.
- **TSL:** import nodes from `three/tsl`. Build a GPU expression graph using `uniform`, `vec3`/`vec4`, arithmetic, noise, and color nodes. Set `colorNode` for color within a material's shading model, `positionNode` for vertex displacement, or `fragmentNode` for explicitly defined fragment output. Change `.value` on uniforms during updates rather than rebuilding graphs each frame.
- **Normals:** displaced positions do not automatically describe the new smooth surface normal. Choose a deliberate method: flat shading for facets, analytic/finite-difference normals for smooth displacement, or an intentionally unlit material. Recomputing CPU geometry normals does not account for GPU-only displacement.

Studio Preview starts at 1920×1080. Use its toolbar to select a preset or scale the render size while preserving aspect ratio. Preview supports whole-pixel sizes up to 3840×2160. The Preview setting does not change scene or export output limits, which remain 1920×1080. Studio uses a configured 60 fps; that is not a measured performance guarantee. The render target contract is linear-sRGB/premultiplied alpha; capture metadata reports sRGB/straight alpha. Do not apply a second gamma conversion or blindly premultiply every node color. Check actual capture/host output when transparency matters; the end-to-end alpha work is still under validation in this snapshot.

## Imports, assets and limits

The checked external allowlist is exactly `@lux/visual-sdk`, `three/webgpu`, and `three/tsl`, plus relative submitted TypeScript modules. Plain `three`, addons/loaders, npm packages, dynamic imports, ambient declarations and diagnostic-suppression directives are not allowed. Submitted code has no Node or desktop bridge; no `process`, filesystem, DOM, `fetch`, WebSocket or Worker access. Do not attempt texture URLs or arbitrary network loads to bypass asset support.

Studio supports bounded PNG, JPEG and opaque 24-bit BMP images in source-v2 bundles, with original bytes retained through preview, scene save/open, restart and offline export. Verify the running app's image capabilities before using them. `context.assets` provides copies of original bytes; `context.images` provides admitted top-down sRGB straight-alpha RGBA pixels for `DataTexture`. Read [image assets](image-assets.md) for exact formats, limits, alpha handling, import/replace/remove behavior and the SDK 0.2 example. Preserve existing assets during procedural edits.

Use modest vertex counts/noise complexity first, then improve fidelity against the preview. Shader work scales with pixels; displacement detail scales with vertices. Avoid unbounded loops, per-frame geometry allocation, synchronous heavy initialization and huge subdivision levels. `context.reportError(message)` currently faults the visual; it is not a logging channel.

## Where to verify newer details

In a Lux checkout, the maintained sources are `packages/visual-sdk/src/{index.ts,metadata.mjs,discovery.mjs}`, `packages/runtime-contracts/src/index.ts`, `apps/build-worker/src/{source-policy.mjs,worker.mjs}`, and `apps/studio/src/visual-worker.mjs`. Read pinned Three exports/type declarations for unfamiliar TSL calls; use a real Lux build to validate source. Do not edit these infrastructure files as part of creating a visual.

### Independent Library parts
Publish typed path generators and image renderers separately. A reusable composition references them with pinned Library dependencies instead of copying their files. The composition entry imports each dependency at its declared relative mount. Scene save stores a complete resolved fallback; changing a dependency does not change a pinned composition until that composition explicitly updates its revision reference.

### Single-pass shader fields

SDK 0.4 also admits ports `{kind:'shader-field',version:1,abi:'your/field/v1'}`. The ABI string must match exactly across an edge. A producer calls `evaluation.shaderField('field',{version:1,abi:'your/field/v1',fragments:{body:'...WGSL...'},values:{scale:1}})`. Consumers read `inputs.field.data`; the runtime copies and freezes the snapshot and checks its frame ownership like a paths resource. Fields do not render an intermediate image.

The ABI is a documented agreement between the producer and consumer about fragment names, WGSL symbols and numeric values. The runtime validates bounded data, not shader semantics. A consumer must validate the fragments it expects, assemble them into its own shader and check the result in a real render. The organic painting consumer fixes fragment source for an instance and updates numeric uniforms each frame; change shader source by rebuilding. Shader fields are not generic CPU flow queries, textures or event streams. Use image ports for a rendered image and paths2d ports for path geometry.

The organic-region example transfers its original shader fragments unchanged to preserve the painting's single render pass and numerical behavior. Library entries keep their own controls and appear as separate graph nodes.
