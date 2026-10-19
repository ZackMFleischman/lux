import assert from 'node:assert/strict';
import test from 'node:test';
import { jobFor, parseArgs, timesFrom } from '../../scripts/lux-render.mjs';

test('frame times come from an explicit list or a start:end:fps range', () => {
  assert.deepEqual(timesFrom({ times: '1,2.5,10' }), [1, 2.5, 10]);
  const range = timesFrom({ range: '0:1:24' });
  assert.equal(range.length, 24);
  assert.equal(range[0], 0);
  assert.ok(Math.abs(range[23] - 23 / 24) < 1e-12);
  assert.throws(() => timesFrom({}), /--times or --range/);
});

test('arguments parse flags with values and bare flags', () => {
  assert.deepEqual(parseArgs(['render', '--src', 'a', '--keep', '--out', 'b']), { _: ['render'], src: 'a', keep: true, out: 'b' });
});

test('flat (SDK 0.2) jobs start from declared defaults and apply overrides', () => {
  const linked = { linkedVersion: 3, linkedHash: 'l1', controlSchemaHash: 'h1', controls: [
    { id: 'speed', type: 'number', label: 'Speed', default: 0.5, min: 0, max: 2, changeCost: 'live' },
    { id: 'go', type: 'trigger', label: 'Go', changeCost: 'live' },
  ] };
  const job = jobFor({ sourceHash: 's1', sdkVersion: '0.2.0', linked }, { width: 640, height: 360, controls: { speed: 1.5 } });
  assert.deepEqual(job.controls, { speed: 1.5 });
  assert.deepEqual(job.settings, { width: 640, height: 360, fps: 60, seed: 0 });
  assert.equal(job.controlSchemaHash, 'h1');
  assert.equal(job.nodeControls, undefined);
  const same = jobFor({ sourceHash: 's1', sdkVersion: '0.2.0', linked }, { width: 640, height: 360, controls: { speed: 1.5 } });
  const other = jobFor({ sourceHash: 's1', sdkVersion: '0.2.0', linked }, { width: 640, height: 360, controls: { speed: 1 } });
  assert.equal(job.key, same.key, 'identical jobs reuse a warm render slot');
  assert.notEqual(job.key, other.key, 'different control values need a fresh visual');
});
