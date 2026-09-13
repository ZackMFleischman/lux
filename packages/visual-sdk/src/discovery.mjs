// Trusted discovery-side adapter; never include this filesystem reader in the
// generated visual import map. The browser SDK entry has type-only imports.
import { readFile } from 'node:fs/promises';
import { sdkMetadata } from './metadata.mjs';
export async function discoverVisualSdk() {
  return { ...sdkMetadata, sdkVersion: '0.2.0', supportedSdkVersions: ['0.1.0', '0.2.0'],
    contractSource: await readFile(new URL('./sdk-v2.ts', import.meta.url), 'utf8'),
    parameterContractSource: await readFile(new URL('../../runtime-contracts/src/parameters.d.mts', import.meta.url), 'utf8'),
    sharedContractSource: await readFile(new URL('../../runtime-contracts/src/index.ts', import.meta.url), 'utf8'),
    example: await readFile(new URL('../examples/parameters.ts', import.meta.url), 'utf8'),
    legacy: { sdkVersion: '0.1.0', contractSource: await readFile(new URL('./index.ts', import.meta.url), 'utf8'),
      example: await readFile(new URL('../examples/intensity.ts', import.meta.url), 'utf8') },
  };
}
