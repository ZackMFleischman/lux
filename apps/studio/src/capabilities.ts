import { parameterLimits } from '../../../packages/runtime-contracts/src/parameters.mjs';
// Emitted by the running app, independently of an adapter's installed checkout.
export const studioCapabilities = Object.freeze({ protocolVersion: 3,
  supportedSdkVersions: Object.freeze(['0.1.0', '0.2.0', '0.4.0']),
  codeDeclaredParameters: true, parameterKinds: Object.freeze(['number']), maxParameterMetadataBytes: parameterLimits.metadataBytes,
  imageFormats: Object.freeze(['image/bmp', 'image/png', 'image/jpeg']), assetExport: true,
  sceneVersions: Object.freeze([1, 2, 3, 4,5]),tempo:Object.freeze({manual:true,tap:true,bpm:Object.freeze({min:20,max:300})}),
});
