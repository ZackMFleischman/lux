# Feeding Quasar

Creative study for the future Vinyl Cosmos black-hole beat. The original scene stays intact; this is an independent new scene.

The shared Cosmos Starfield supplies fine stars and sparse six-ray diffraction stars. A scene-local quasar image effect bends rays through an approximate central gravity field, evaluates turbulent emission at accretion-disk crossings, and bends the background with the escaping direction. A small finishing pass adds highlight bloom and exposure. The dark shadow, a warm orbiting disk, and cooler intertwined polar jets carry the composition.

Performance choices: three image passes including the reusable sky; at most 88 bounded integration steps per affected pixel; early escape outside the central region; disk noise only at disk crossings; analytic jet filaments; 12 highlight samples for bloom; no per-frame mesh allocation, CPU particle simulation, external textures, or physics engine. Runtime FPS must be checked in the actual installed application, not inferred from this budget.

This is an artistic approximation of lensing and polar outflow, not a quantitative relativistic simulation. The jets are deliberately visible at a cinematic scale.

Visual references: [NASA's warped-world visualization](https://www.nasa.gov/universe/nasa-visualization-shows-a-black-holes-warped-world/) for disk lensing and asymmetric emission, and [NASA's magnetic funnel illustration](https://science.nasa.gov/asset/hubble/magnetic-funnel-around-a-supermassive-black-hole/) for twisting polar structure. No reference images are embedded in the scene.

Live controls cover sky density and star sizes, framing and viewing angle, disk spin/detail/radiance, jet width/twist/outflow, light bending, the photon ring, bloom, and exposure.

## Delivered scene

Open `visuals/Quasar.lux-scene`. The sky is linked to **Cosmos Starfield**, Library ID `7bd99b27-08ae-4483-9314-1c8e1e98cf10`, revision 1. The original creative session was separately preserved as `visuals/Vinyl Cosmos - Pre-Quasar 2026-09-17.lux-scene`.

Validated in installed desktop build `8aa98af7-68d29a9b` on 17 September 2026. Accepted quasar revision `2ab0ced951512e91f7bd4adf84b0cea3a5b251c42ae8d872108cd0be7a97855e`, source draft 10, fault null. Actual captures at 3.01 and 42.70 seconds showed disk and jet movement. A 30-frame worker interval measured 59.93 completed frames/second at 1920×1080; this is a local observation, not a cross-device guarantee. The saved preview is `visuals/Quasar.png`.

Independent source and actual-frame review approved the composition, detail retention and resource disposal. Radiance is compressed before the SDK's rgba8 intermediate image boundary; the finishing pass adds bloom without washing out the disk. The scene contains no inherited Cosmos audio bindings.
