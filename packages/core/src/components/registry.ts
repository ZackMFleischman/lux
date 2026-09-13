import { canonicalComponentMetadataJson, componentMetadataLimits, normalizeComponentMetadata } from '../../../runtime-contracts/src/components.mjs';
import type { ComponentMetadata } from '../../../runtime-contracts/src/components.mjs';

export type ComponentRegistry = Readonly<{
  get(key: string): ComponentMetadata | undefined;
  list(): readonly ComponentMetadata[];
}>;

/** Immutable local metadata snapshot; declaration keys do not resolve project references. */
export function createComponentRegistry(entries: readonly unknown[]): ComponentRegistry {
  if (!Array.isArray(entries) || Object.getPrototypeOf(entries) !== Array.prototype) throw Error('Expected a plain component entry array');
  const length = Object.getOwnPropertyDescriptor(entries, 'length')!.value as number;
  if (length > componentMetadataLimits.registryEntries) throw Error('Registry supports at most 128 entries');
  if (Reflect.ownKeys(entries).length !== length + 1) throw Error('Unexpected component entry array properties');
  const index = new Map<string, ComponentMetadata>();
  const encoder = new TextEncoder();
  let bytes = 0;
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(entries, String(i));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw Error('Expected dense own data component entries');
    const metadata = normalizeComponentMetadata(descriptor.value);
    if (index.has(metadata.key)) throw Error(`Duplicate component key ${metadata.key}`);
    bytes += encoder.encode(canonicalComponentMetadataJson(metadata)).byteLength;
    if (bytes > componentMetadataLimits.registryBytes) throw Error('Registry metadata exceeds 1 MiB UTF-8');
    index.set(metadata.key, metadata);
  }
  const sorted = Object.freeze([...index.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return Object.freeze({ get: (key: string) => index.get(key), list: () => sorted });
}
