import test from 'node:test';
import assert from 'node:assert/strict';
import { createComponentRegistry } from '../../packages/core/src/components/registry.ts';
import { normalizeComponentDeclaration, canonicalComponentMetadataJson } from '../../packages/runtime-contracts/src/components.mjs';

const fixture = (key = 'lux/glow') => structuredClone(normalizeComponentDeclaration({
  declarationVersion: 1, key, label: 'Glow', description: 'Glow effect', tags: ['effect'],
  inputs: {}, outputs: {}, controls: {}, controlDescriptions: {}, lifecycle: { state: 'stateless', reset: 'seed' },
}));

test('registry snapshots entries, sorts keys, hides mutable membership and returns immutable lists', () => {
  const source = [fixture('lux/zebra'), fixture('lux/alpha')];
  const registry = createComponentRegistry(source);
  const before = canonicalComponentMetadataJson(registry.get('lux/alpha'));
  assert.deepEqual(registry.list().map(entry => entry.key), ['lux/alpha', 'lux/zebra']);
  assert.equal(registry.get('lux/alpha'), registry.list()[0]);
  assert.equal(registry.get('lux/missing'), undefined);
  assert.equal(registry.get('constructor'), undefined);
  assert.equal(registry instanceof Map, false);
  assert.deepEqual(Object.keys(registry).sort(), ['get', 'list']);
  // The source is deliberately a mutable JSON copy of the readonly DTO.
  const mutable = source as unknown as { key: string; label: string; tags: string[] }[];
  mutable[1]!.label = 'Changed'; mutable[1]!.tags.push('changed'); mutable[1]!.key = 'lux/changed';
  source.pop();
  assert.equal(canonicalComponentMetadataJson(registry.get('lux/alpha')), before);
  assert.equal(registry.get('lux/changed'), undefined);
  assert.equal(registry.list().length, 2);
  assert.equal(Reflect.set(registry.list()[0]!, 'label', 'Changed'), false);
  assert.equal(Object.isFrozen(registry), true);
  assert.equal(Object.isFrozen(registry.list()), true);
  assert.equal(Object.isFrozen(registry.list()[0]!.tags), true);
  const separate = createComponentRegistry([fixture('lux/other')]);
  assert.equal(separate.get('lux/alpha'), undefined);
  assert.equal(registry.get('lux/other'), undefined);
  assert.deepEqual(createComponentRegistry([]).list(), []);
});

test('registry rejects duplicate keys even for byte-identical entries and validates all entries', () => {
  assert.throws(() => createComponentRegistry([fixture(), fixture()]), /duplicate/i);
  assert.throws(() => createComponentRegistry([{ ...fixture(), declarationVersion: 2 }]));
});

test('registry admits 128 entries and rejects the 129th', () => {
  const entries = Array.from({ length: 128 }, (_, index) => fixture(`lux/c${index}`));
  assert.equal(createComponentRegistry(entries).list().length, 128);
  assert.throws(() => createComponentRegistry([...entries, fixture('lux/extra')]), /128/);
});

function sizedFixture(key: string, bytes: number): unknown {
  const entry = { ...fixture(key), controlDescriptions: {} as Record<string, string>, controls: Array.from({ length: 16 }, (_, index) => ({
    id: `c${index}`, type: 'number', label: 'Value', default: 0, min: 0, max: 1, changeCost: 'live',
  })) };
  for (const row of entry.controls) entry.controlDescriptions[row.id] = 'x';
  let remaining = bytes - Buffer.byteLength(JSON.stringify(entry));
  for (const row of entry.controls) {
    const extra = Math.min(remaining, 511);
    entry.controlDescriptions[row.id] = 'x'.repeat(1 + extra); remaining -= extra;
  }
  assert.equal(remaining, 0, 'fixture fits within valid description lengths');
  assert.equal(Buffer.byteLength(canonicalComponentMetadataJson(entry)), bytes);
  return entry;
}

test('registry counts summed canonical UTF-8 bytes, admitting 1 MiB and rejecting one byte beyond', () => {
  const entries = Array.from({ length: 128 }, (_, index) => sizedFixture(`lux/c${index}`, 8192));
  assert.equal(createComponentRegistry(entries).list().length, 128);
  entries[127] = sizedFixture('lux/c127', 8193);
  assert.throws(() => createComponentRegistry(entries), /1 MiB/);
});

test('registry rejects accessor, sparse and decorated entry arrays without invoking getters', () => {
  let calls = 0;
  const entries = [fixture()];
  Object.defineProperty(entries, '0', { enumerable: true, get() { calls++; throw Error('executed getter'); } });
  assert.throws(() => createComponentRegistry(entries)); assert.equal(calls, 0);
  assert.throws(() => createComponentRegistry(new Array(1)));
  const decorated = [fixture()]; Object.defineProperty(decorated, Symbol('hidden'), { value: true });
  assert.throws(() => createComponentRegistry(decorated));
});
