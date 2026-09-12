// Trusted discovery-side adapter; never include this filesystem reader in the
// generated visual import map. The browser SDK entry has type-only imports.
import { readFile } from 'node:fs/promises';
import { sdkMetadata } from './metadata.mjs';
export async function discoverVisualSdk() {
  return { ...sdkMetadata,
    contractSource: await readFile(new URL('./index.ts', import.meta.url), 'utf8'),
    sharedContractSource: await readFile(new URL('../../runtime-contracts/src/index.ts', import.meta.url), 'utf8'),
    example: await readFile(new URL('../examples/intensity.ts', import.meta.url), 'utf8'),
  };
}
