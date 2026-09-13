# Noise displacement and artist controls

For a brief like “a sphere manipulated by 3D noise over time so it looks spiky; give it interesting parameters,” deliver the sphere and preserve the intention of independent parameters. SDK 0.2 exposes independent code-defined numeric controls in Studio and MCP.

The intended model is **parameters declared by each visual's code**, with Inspector and generic MCP control consuming that discovered schema. Intensity is an optional, visual-specific parameter if that visual declares it; it is not a permanent global control or a required macro. The checked template declares spikeHeight, noiseScale, sharpness, motionSpeed and roughness. Use SDK 0.2 and verify the running app reports compatibility.

The checked [sphere template](../assets/noise-sphere.ts) uses `SphereGeometry`, `MeshStandardNodeMaterial.positionNode`, and `mx_noise_float` from pinned Three.js 0.186.0. It is CPU-compiled against Lux, with no GPU appearance or performance claim. Use the user's palette/motion preferences rather than treating these defaults as a prescribed style.

The node graph samples noise at `positionLocal * noiseScale + timeDrift`. A moving 3D sample position makes the field evolve coherently instead of choosing unrelated random positions each frame. Remap/clamp signed noise into 0–1 and raise it to a power to concentrate peaks, then displace outward along `normalLocal`. More vertices can resolve sharper peaks, but also cost more. Higher noise frequency than the mesh can resolve produces a poor silhouette; improve them together and inspect the actual result.

The template deliberately uses `flatShading` so lighting reflects visible facets of the displaced surface. For smooth organic spikes, derive normals from the displaced surface (analytic or finite-difference methods) rather than accepting undeformed sphere normals. There is no universally correct material setting for both looks.

| Artist setting | What it changes | Checked delivery |
| --- | --- | --- |
| Spike height | Maximum radial displacement | Independent live numeric control |
| Noise scale | Number/size of surface features | Independent live numeric control |
| Sharpness | Broad bumps versus narrow peaks | Independent live numeric control |
| Motion speed | Rate of evolution through noise | Independent live numeric control |
| Color | Base palette | Named source setting; rebuild to change |
| Roughness | Broad matte versus tighter highlights | Independent live numeric control |

Say plainly which values are rebuild-only. Do not label source constants as Inspector sliders or quietly reduce independent controls to Intensity. If the discovered SDK supports visual-defined controls, declare the relevant settings in the visual using that real schema and expose meaningful independent controls. Do not add an Intensity control unless it benefits this particular visual.

In the template, Spike height 0 yields an undeformed sphere; larger values increase displacement. Time comes from Lux's frame context so pause/reset works. Verify the silhouette at multiple angles/times and the extremes of supported controls; a time-zero still may not show how it evolves. Keep camera distance/near/far planes sufficient for the largest intended radius.
