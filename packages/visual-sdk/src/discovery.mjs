// Trusted discovery-side adapter; never include this filesystem reader in the
// generated visual import map. The browser SDK entry has type-only imports.
import { readFile } from 'node:fs/promises';
import { sdkMetadata } from './metadata.mjs';
export async function discoverVisualSdk() {
  return { ...sdkMetadata, sdkVersion: '0.2.0', supportedSdkVersions: ['0.1.0', '0.2.0', '0.4.0'],
    contractSource: await readFile(new URL('./sdk-v2.ts', import.meta.url), 'utf8'),
    parameterContractSource: await readFile(new URL('../../runtime-contracts/src/parameters.d.mts', import.meta.url), 'utf8'),
    sharedContractSource: await readFile(new URL('../../runtime-contracts/src/index.ts', import.meta.url), 'utf8'),
    example: await readFile(new URL('../examples/parameters.ts', import.meta.url), 'utf8'),
    triggerExample: await readFile(new URL('../examples/actions.ts', import.meta.url), 'utf8'),
    storyExample: await readFile(new URL('../examples/story.ts', import.meta.url), 'utf8'),
    storyContractSource: await readFile(new URL('../../runtime-contracts/src/story.d.mts', import.meta.url), 'utf8'),
    composition: { sdkVersion: '0.4.0', executionModel: 'image-chain-v1', supportedExecutionModels: ['image-chain-v1', 'typed-image-graph-v1'],
      authoring: {component:'defineComponent',visual:'defineVisual',compatibility:'defineComposition',externalImageInput:false,visualExternalInputs:false,componentInputs:'typed-record-v1',graphIds:{kind:'uuid-or-readable-v1',readablePattern:'^[a-z][a-z0-9._-]{0,95}$'}},
      cameraController: {abi:'lux/camera-controller/v1',controlIds:['yaw','pitch','panX','panY','dolly','roll'],studioPreviewGestures:true},
      contractSource: await readFile(new URL('./sdk-composition.ts', import.meta.url), 'utf8'),
      shaderFieldContractSource: await readFile(new URL('../../runtime-contracts/src/shader-field.d.mts', import.meta.url), 'utf8'),
      pathsContractSource: await readFile(new URL('../../runtime-contracts/src/paths2d.d.mts', import.meta.url), 'utf8'),
      profileContractSource: await readFile(new URL('../../runtime-contracts/src/composition-profile.d.mts', import.meta.url), 'utf8') },
    legacy: { sdkVersion: '0.1.0', contractSource: await readFile(new URL('./index.ts', import.meta.url), 'utf8'),
      example: await readFile(new URL('../examples/intensity.ts', import.meta.url), 'utf8') },
  };
}
