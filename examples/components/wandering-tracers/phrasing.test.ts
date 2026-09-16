import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@lux/visual-sdk') {
      return {
        shortCircuit: true,
        url: new URL('../../../packages/visual-sdk/src/sdk-composition.ts', import.meta.url).href,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { default: phrasing } = await import('./phrasing.ts');

const controls = {
  pace: 1.24,
  phrasing: 1,
  composition: 0.44,
  tension: 0.72,
  hierarchy: 0.99,
};

async function values(instance: Awaited<ReturnType<typeof phrasing.create>>) {
  let snapshot: Readonly<Record<string, number>> | undefined;
  await instance.evaluate({}, {
    shaderField(_portId: string, field: { values: Readonly<Record<string, number>> }) {
      snapshot = field.values;
      return { data: field };
    },
  } as never);
  return snapshot!;
}

test('composition phrasing preserves accumulated artistic time across pace changes, backward time, and reset', async () => {
  const instance = await phrasing.create({} as never);
  let tick = 0;
  const update = (timeSeconds: number, pace: number) => instance.update({
    tick: tick++, timeSeconds, deltaSeconds: 0, events: [], controls: { ...controls, pace },
  });

  update(2, 1);
  assert.equal((await values(instance)).time, 2);
  update(3, 0.5);
  assert.equal((await values(instance)).time, 2.5);
  update(2, 3);
  assert.equal((await values(instance)).time, 2.5);
  update(4, 2);
  assert.equal((await values(instance)).time, 6.5);

  await instance.reset(19);
  update(1.5, 3);
  assert.equal((await values(instance)).time, 4.5);
  update(10, 0);
  assert.equal((await values(instance)).time, 4.5);
  update(11, 1);
  assert.equal((await values(instance)).time, 5.5);
  await instance.dispose();
});
