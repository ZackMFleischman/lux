# Visual programming in Lux

This reference describes the checked SDK 0.2.0 (with legacy 0.1 support) / Three.js 0.186.0 implementation. When capabilities change, use discovery from the adapter paired with the running Studio build plus actual tool results. Discovery describes checkout files and separately reports `runningStudio.capabilities`; check `compatible` before using SDK 0.2; see [connection](studio-tools.md).

## Source and lifecycle

A source bundle contains `sdkVersion`, an `entry` such as `visual.ts`, and a `files` record mapping relative `.ts` paths to source text. v2 adds `sourceVersion: 2` and `assets`; preserve those fields on edits. Helpers are normal submitted modules, for example `import { palette } from './lib/palette.ts'`. The compiler accepts at most 32 files and 1 MiB aggregate UTF-8 code. Use simple ASCII path segments, forward slashes, explicit `.ts` extensions, and no case-only collisions.

The entry must directly `export default defineVisual({...})`, importing `defineVisual` from `@lux/visual-sdk`. SDK 0.2 requires `{ controls, create }`. `controls` is a static literal map of 0–32 numeric descriptors: `{ type: 'number', label, default, min, max, step?, unit? }`. Use camelCase IDs. No computed metadata, spreads, functions or imported declarations. `frame.controls` is typed from those IDs. Empty `{}` means no controls; do not invent Intensity. The source bundle must set `sdkVersion: '0.2.0'`. Legacy 0.1 sources retain `{ create }` and their compatibility intensity field. Discovery's contract and parameter types describe exact bounds.

| Hook | Responsibility |
| --- | --- |
| `async create(context)` | Allocate scene, camera, geometry, materials, uniforms and per-instance state; return the four hooks below. |
| `update(frame)` | Change transforms and uniform values from `timeSeconds`, `deltaSeconds`, and `controls`. Runs even for a paused parameter change. |
| `render(target)` | Return `context.renderer.render(scene, camera, target)`. Lux owns the renderer, output target, frame scheduling and GPU lifecycle. |
| `reset(seed)` | Reset visual-owned mutable simulation state. Lux resets its clock and seeded random generator before calling this hook. |
| `dispose()` | Dispose owned geometries, materials and textures, including replaced resources; release subscriptions if used. Removing a mesh alone does not free its GPU resources. |

For continuous motion, derive angles and noise offsets from `frame.timeSeconds`. It follows Lux playback/reset. Use `deltaSeconds` for a simulation that genuinely needs integration; reset its accumulated state. Avoid a separate animation loop, browser wall time, or TSL's automatic timer for playback-sensitive movement. Feed a `uniform` from Lux time instead.

`context.random()` is seeded by `context.settings.seed`. Build random initial states from it for repeatability. If reset must regenerate that state, rerun the same initialization using the reset generator; an analytic animation can have an empty reset hook because its next update reads the reset clock. `frame.events` is currently empty; audio-reactivity inputs are not implied by its existence.

## Primitives that compose a visual

- **Scene and camera:** Three scene graph, `Mesh`, groups, orthographic or perspective camera. Use `context.settings.width / height` for aspect ratio. Frame the largest expected displacement, not just the undeformed geometry.
- **Geometry:** planes and circles for graphic compositions; spheres, boxes, torus shapes or custom `BufferGeometry` for volume. Share geometry/materials across similar objects; use instancing for many repeated objects. Allocate once, not every update.
- **Node materials:** import materials such as `MeshBasicNodeMaterial` or `MeshStandardNodeMaterial` from `three/webgpu`. Basic materials are useful for flat graphic output; Standard materials need lights and suitable normals for volume.
- **TSL:** import nodes from `three/tsl`. Build a GPU expression graph using `uniform`, `vec3`/`vec4`, arithmetic, noise, and color nodes. Set `colorNode` for color within a material's shading model, `positionNode` for vertex displacement, or `fragmentNode` for explicitly defined fragment output. Change `.value` on uniforms during updates rather than rebuilding graphs each frame.
- **Normals:** displaced positions do not automatically describe the new smooth surface normal. Choose a deliberate method: flat shading for facets, analytic/finite-difference normals for smooth displacement, or an intentionally unlit material. Recomputing CPU geometry normals does not account for GPU-only displacement.

Current Studio output is 1920×1080 at a configured 60 fps; that is a setting, not a measured performance guarantee. The render target contract is linear-sRGB/premultiplied alpha; capture metadata reports sRGB/straight alpha. Do not apply a second gamma conversion or blindly premultiply every node color. Check actual capture/host output when transparency matters; the end-to-end alpha work is still under validation in this snapshot.

## Imports, assets and limits

The checked external allowlist is exactly `@lux/visual-sdk`, `three/webgpu`, and `three/tsl`, plus relative submitted TypeScript modules. Plain `three`, addons/loaders, npm packages, dynamic imports, ambient declarations and diagnostic-suppression directives are not allowed. Submitted code has no Node or desktop bridge; no `process`, filesystem, DOM, `fetch`, WebSocket or Worker access. Do not attempt texture URLs or arbitrary network loads to bypass asset support.

The checked Studio supports source-v2 bounded opaque 24-bit BMP assets in preview. `context.assets` is a read-only map from asset paths to protected original bytes, not decoded Three textures. Read the installed SDK and repository image fixture before creating a `DataTexture`; decode only during creation, preserve orientation/color space, and dispose the texture. The Source asset list shows thumbnails and selection previews; restart and scene save/reopen preserve asset bytes. Import/replace/remove controls, PNG/JPEG/transparency rendering and asset-bearing offline export are still pending in this snapshot. Common-image codec work is not yet activated in this snapshot; SDK 0.2 numeric parameters are active. Check discovery and actual build evidence before using newer features; preserve existing assets during procedural edits.

Use modest vertex counts/noise complexity first, then improve fidelity against the preview. Shader work scales with pixels; displacement detail scales with vertices. Avoid unbounded loops, per-frame geometry allocation, synchronous heavy initialization and huge subdivision levels. `context.reportError(message)` currently faults the visual; it is not a logging channel.

## Where to verify newer details

In a Lux checkout, the maintained sources are `packages/visual-sdk/src/{index.ts,metadata.mjs,discovery.mjs}`, `packages/runtime-contracts/src/index.ts`, `apps/build-worker/src/{source-policy.mjs,worker.mjs}`, and `apps/studio/src/visual-worker.mjs`. Read pinned Three exports/type declarations for unfamiliar TSL calls; use a real Lux build to validate source. Do not edit these infrastructure files as part of creating a visual.
