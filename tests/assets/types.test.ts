import type { VisualContext } from '../../packages/visual-sdk/src/index.ts';
import { createReadonlyAssetMap, deriveAssets, verifyDerivedAssets } from '../../packages/assets/src/index.mjs';
import type { HashBytes, SourceAssets, DerivedAssets } from '../../packages/assets/src/index.mjs';

// Compile-only integration surface: SDK version 0.1.0 already owns this type.
const assignToSdk = (source: SourceAssets): VisualContext['assets'] => createReadonlyAssetMap(source);
const deriveAndVerify = async (source: SourceAssets, hash: HashBytes): Promise<DerivedAssets> => {
  const derived = await deriveAssets(source, hash);
  const verified = await verifyDerivedAssets(derived.assets, derived.assetSetHash, hash);
  assignToSdk(verified.sourceAssets);
  return verified.assets;
};
void deriveAndVerify;
