import type { NodePath } from '../../../runtime-contracts/src/graph.ts';
import { nodeIdSchema } from '../../../runtime-contracts/src/identities.ts';
import { SeededRandom } from '../seed.ts';

export const nodeRandomVersion = 'lux-node-rng-v1' as const;
const prefix = new TextEncoder().encode(`${nodeRandomVersion}\0`);

export function deriveNodeSeed(sceneSeed: number, nodePath: NodePath): number {
  if (!Number.isInteger(sceneSeed) || sceneSeed < 0 || sceneSeed > 0xffffffff) {
    throw new RangeError('Scene seed must be an unsigned 32-bit integer');
  }
  if (!Array.isArray(nodePath) || Object.getPrototypeOf(nodePath) !== Array.prototype) {
    throw new TypeError('Node path must be an ordinary dense array');
  }
  const length = Object.getOwnPropertyDescriptor(nodePath, 'length')?.value;
  // Count first: do not inspect children of an overlong path.
  if (!Number.isInteger(length) || length < 1 || length > 8) {
    throw new TypeError('Node path must contain 1 to 8 UUIDs');
  }
  if (Reflect.ownKeys(nodePath).length !== length + 1) {
    throw new TypeError('Node path must contain only dense UUID elements');
  }
  const ids: string[] = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(nodePath, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string' || descriptor.value.length !== 36) {
      throw new TypeError('Node path elements must be own UUID data properties');
    }
    // The existing identity schema preserves the exact spelling, including case.
    ids.push(nodeIdSchema.parse(descriptor.value));
  }
  const bytes = new Uint8Array(21 + 36 * length);
  bytes.set(prefix);
  new DataView(bytes.buffer).setUint32(16, sceneSeed === 0 ? 0 : sceneSeed, true);
  bytes[20] = length;
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < 36; j++) bytes[21 + i * 36 + j] = ids[i]!.charCodeAt(j);
  }
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash;
}

export function createNodeRandom(sceneSeed: number, nodePath: NodePath): Readonly<{ next(): number; reset(): void }> {
  const random = new SeededRandom(deriveNodeSeed(sceneSeed, nodePath));
  return Object.freeze({ next: () => random.next(), reset: () => random.reset() });
}
