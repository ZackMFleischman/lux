# Story renderer interoperability prerequisite

## Result

The isolated native probe at source HEAD `e54266c0326d56fb152d471fa54938081cfceea4` disproved the proposed one-renderer, independently bundled Three.js runtime design. The ordinary SDK 0.2 Lambert visual rendered correctly through its own bundle's renderer, while the separately compiled and linked TSL visual rendered transparent black through that renderer on both create/render/dispose passes.

| Readback | Pass 1 | Pass 2 |
| --- | --- | --- |
| Ordinary lit slot | `[187, 0, 0, 127]` | `[187, 0, 0, 127]` |
| Foreign TSL lit slot | `[0, 0, 0, 0]` | `[0, 0, 0, 0]` |
| Composed front | `[137, 0, 0, 63]` | `[137, 0, 0, 63]` |

The console reported `THREE.TSL: No stack defined for assign operation` across the foreign material and lighting build, plus `THREE.LightsNode.setupNodeLights: Light node not found for AmbientLight`. This matches the anticipated module-local TSL stack and light-constructor registry boundaries. The four target descriptors and physical `rgba8unorm-srgb`/`depth24plus` allocations matched the pinned recipe. Cleanup completed for four authored instances, renderer resources, and the device; owned PID 21000 exited cleanly.
The captured straight-alpha PNG center pixel was `[255, 0, 0, 63]`, consistent with the missing blue slot.

## Evidence

- Raw worker result: `artifacts/story-interop/native-1789654636940/raw-result.json` (`3d4d2db21290ae8fa7741c228cbfb9199308d6c4afea8ce274c66ff31258422c`)
- Host report including all warnings/errors and source/dependency identities: `artifacts/story-interop/native-1789654636940/result.json`
- Pass images: `pass-1.png`, `pass-2.png` (both `bc3f92596f5dad0926cde86a9c3056eebae79f990fcf5c3ce228b6e597b074be`)
- Isolated profile: `test-585d3372-3afc-442a-9982-02bd91067826`

The scheduler must not import independently bundled Three/TSL copies into one renderer. A follow-up linker/runtime design must give every authored visual the same verified Three.js and TSL module instances while retaining per-source lazy authored evaluation.

## Shared-runtime capsule result

The replacement multi-entry capsule passed the same isolated native probe at the same source HEAD. Both SDK 0.2 authored entries were imported lazily through one verified shared Three/TSL runtime. The ordinary Lambert material and the TSL `Fn`/`If` Lambert material rendered through one renderer on two create/render/dispose passes.

| Readback | Pass 1 | Pass 2 |
| --- | --- | --- |
| Ordinary lit slot | `[187, 0, 0, 127]` | `[187, 0, 0, 127]` |
| TSL lit slot | `[0, 0, 137, 64]` | `[0, 0, 137, 64]` |
| Premultiplied-linear composite | `[137, 0, 99, 95]` | `[137, 0, 99, 95]` |
| Captured straight-alpha PNG pixel | `[214, 0, 157, 95]` | `[214, 0, 157, 95]` |

The TSL stack and light-constructor warnings from the independent-bundle probe did not recur. The only console entry was Electron's development Content Security Policy warning. Target and physical texture descriptors matched the pinned recipe. Cleanup disposed four authored instances, renderer resources, the WebGPU device, and all shared module URLs; no imports remained pending. Owned PID 36872 exited cleanly.

- Raw worker result: `artifacts/story-interop/native-1789656749128/raw-result.json` (`f628ce863e2ba804cb4ba64208e6841a19fb2c681bca726d64aabe17905dec7b`)
- Host report with warnings, descriptors, cleanup, and identities: `artifacts/story-interop/native-1789656749128/result.json`
- Shared capsule: `e8ba988beb5a48f84bccc71e4e6aeb087b02366aa608e6e466829d960f539161`
- Prepared input: `82e76e9900e6a5fc357256bb199f5e674ba1a27fddbbd03bad420983e094d311`
- Probe worker bundle: `c8c9ff5f0b755e3a10d32c3530b386789f59b0ae600e496a100ea1ad7269d7d9`
- Pass images: `pass-1.png`, `pass-2.png` (both `6197e6a93e55c9456f6e01c5dacfbdca70acd8c65ab4b22f6fcbbed55b6e06fd`)
- Isolated profile: `test-4032fa89-ad57-410d-8316-b71a13c4bfbe`
