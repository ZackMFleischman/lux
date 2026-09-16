# Visual programming in Lux

This reference describes checked SDK 0.2.0 visuals, SDK 0.4.0 image composition, legacy 0.1 support, and Three.js 0.186.0. Use discovery from the adapter paired with the running Studio build plus actual tool results. Discovery describes checkout files and separately reports `runningStudio.capabilities`; check compatibility for the selected SDK; see [connection](studio-tools.md).

## Source and lifecycle

A source bundle contains `sdkVersion`, an `entry` such as `visual.ts`, and a `files` record mapping relative `.ts` paths to source text. v2 adds `sourceVersion: 2` and `assets`; preserve those fields on edits. Helpers are normal submitted modules, for example `import { palette } from './lib/palette.ts'`. The compiler accepts at most 32 files and 1 MiB aggregate UTF-8 code. Use simple ASCII path segments, forward slashes, explicit `.ts` extensions, and no case-only collisions.

The entry must directly `export default defineVisual({...})`, importing `defineVisual` from `@lux/visual-sdk`. SDK 0.2 requires `{ controls, create }`. `controls` is a static literal map of 0–32 numeric descriptors: `{ type: 'number', label, default, min, max, step?, unit?, description? }`. Use camelCase IDs. `description` is optional plain text, up to 512 characters, that Studio shows as help on hover or keyboard focus. No computed metadata, spreads, functions or imported declarations. `frame.controls` is typed from those IDs. Empty `{}` means no controls; do not invent Intensity. The source bundle must set `sdkVersion: '0.2.0'`. Legacy 0.1 sources retain `{ create }` and their compatibility intensity field. Discovery's contract and parameter types describe exact bounds.

## Readable authored TypeScript

Source is part of the creative workflow. Write TypeScript for a person reading and editing it in Studio. Use one import member per line when an import is long. Put metadata, control declarations, lifecycle methods, and object literals on several indented lines. Give intermediate shader expressions and resources their own named declarations. Put one statement on each line, especially in `update`, `reset`, and `dispose`.

Keep a short object or method on one line only when it remains easy to scan. Preserve existing comments, file layout, controls, and behavior when reformatting a user visual. Do not minify, compress, or replace a complete source bundle merely to alter formatting. A formatter may be used if it is already available, but Lux does not require a formatter dependency or a formatting build step.

## Linear image composition

SDK 0.4 uses `defineComponent` in leaf modules and `defineComposition` in the entry or reusable group modules. A composition definition may import components or other compositions recursively. Component metadata statically declares image ports, numeric controls, descriptions, and lifecycle. A component instance implements `update(frame)`, `evaluate(inputs, evaluation)`, `reset(seed)`, and `dispose()`. Its evaluation returns `{ image: await evaluation.render(scene, camera) }`; an effect reads `inputs.image.texture` and renders its own output. Lux owns intermediate render targets and releases them only after downstream GPU work settles.

Each composition statically lists `definitions`, stable UUID `nodes`, `edges`, one `output`, and selected `expose` rows. A reusable effect composition also declares one `input: { nodeId, portId: 'image' }`, while the root omits `input`; `label` gives the group a readable Graph name. Each exposed ID is an alias for exactly one `{nodeId, controlId}` target, which may itself be another composition exposure. Lux resolves the chain to one canonical leaf control. The alias keeps that control's description, so authors do not duplicate help text. For example, two root nodes using the same two-effect composition can expose `segmentsA` and `segmentsB`; changing one does not mutate the other. Stable full node paths persist compatible values and local LFOs across save/reopen, declaration reorder, and a linked component revision. Added, removed, unit-changed, and out-of-range controls are reported; incompatible values reset to the new declaration default. A rebound alias does not transfer a saved value to another instance.

Graph initially shows the root's immediate children. Selecting a leaf edits that instance. Selecting a composition edits its exposed controls; **Open component**, Enter, or double-click reveals its immediate children, with breadcrumb and Back navigation. The composite Inspector and child Inspector address the same canonical leaf state. Graph selection and component focus are separate, so navigating does not silently retarget a control edit.

### Studio control animation

Studio can attach one compact LFO to a numeric control on the currently selected Graph node. The saved control value remains the base value, while each preview frame evaluates `clamp(base + amount × waveform, min, max)`. Available waveforms are sine, triangle, saw and square. Period accepts finite values from 0.05 through 3600 seconds; amount is a finite nonnegative peak distance in the control's declared units; start phase is a finite fraction from 0 through 1.

The LFO follows the scene clock: pause freezes it, Play resumes it, and scene Reset or **Restart animation** returns it to the configured start phase. Turning it off outputs the base value and retains the frozen oscillator phase for later resume. Editing the base moves the animation center immediately. The Inspector shows clamped extrema and reports when the declared control range limits them.

Scene Save/Open stores the base values and compatible per-instance bindings. Component bindings include node, component definition and control schema identity. Flat scene bindings use the declared control schema identity and survive compatible source edits. When a linked component update removes or changes the target incompatibly, Lux keeps the affected binding disabled with a visible issue and never retargets it by list position. Removing the animation deletes the binding. Control animation applies to declared numeric scene controls (SDK 0.2 and legacy 0.1) and SDK 0.4 Scene exposures or selected Graph controls; it is not a shared modulation source, graph editor feature or MIDI mapping.

## Shared components

The local Library stores complete SDK 0.4 component bundles under stable IDs. The first connected create/update path accepts zero-input image-source components. Use `lux.library.list` and `lux.library.read` to inspect names, descriptions, revisions, and readable source before composing with an entry. Link through `lux.studio.build.libraryLinks` using `{ componentId, mountPath }`; import the component through files mounted below that path. Two scene instances of the same linked component keep independent node UUIDs and controls.

Use `lux.studio.save` to save the current scene to an explicit absolute `.lux-scene` path after `lux.studio.read`; pass its `expectedDraftVersion`. Existing paths require `overwrite: true`. `lux.studio.open` also takes an absolute path and expected draft version. It refuses dirty source, controls, or library links unless `discardDirty: true`, and an invalid scene leaves the current draft and preview in place.

Create and update are full-source operations. `lux.library.update` requires the current `expectedRevision`. Studio validates and builds the candidate before activation, so a stale revision or invalid source cannot replace the working library entry. Linked scenes store the resolved revision and mounted source. They resolve the latest revision on load or rebuild, offer Apply update while running, and fall back visibly to the saved source if the latest candidate cannot run. Forking retains those files in the scene and removes the link. The current Library is profile-local and has no remote publication or automatic source insertion.

The admitted `image-chain-v1` profile is deliberately narrow after recursive expansion: 1–8 leaf nodes, one linear path, one final image, and at most eight composition levels. A nested composition may expose one image input, but branches, delays, feedback and graph editing remain unavailable. Keep SDK 0.2 for a single visual. Source metadata is extracted without executing authored code, and runtime still imports only the exact sealed linked artifact and recursively authenticated definitions.

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
