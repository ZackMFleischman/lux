import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { _electron } from 'playwright';
import { installedElectron } from './studio-electron.mjs';
import { resolveStudioSession, studioTestEnvironment } from './studio-session.mjs';

const root = resolve(import.meta.dirname, '..').replaceAll('\\', '/');
const output = join(root, 'artifacts/studio-trigger-controls', `native-${Date.now()}`);
await mkdir(output, { recursive: true });
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
const session = resolveStudioSession({ workspace: root, env });
const fixturePath = join(root, 'skills/lux-visual-creation/assets/trigger-controls.ts');
const fixture = await readFile(fixturePath, 'utf8');
const source = { sdkVersion: '0.2.0', entry: 'visual.ts', files: { 'visual.ts': fixture } };
const faultOnly = process.argv.includes('--fault-only');

const componentFixtureRoot = join(root, 'tests/studio/fixtures/nested-prismatic-composition');
const componentBall = await readFile(join(componentFixtureRoot, 'ball.ts'), 'utf8');
const baseEffect = await readFile(join(componentFixtureRoot, 'kaleidoscope.ts'), 'utf8');
const triggerEffect = baseEffect
  .replace(
    "controls: { segments: { type: 'number', label: 'Mirror segments', default: 6, min: 2, max: 16, step: 1 } },",
    `controls: {
      segments: { type: 'number', label: 'Mirror segments', default: 6, min: 2, max: 16, step: 1 },
      mirrored: { type: 'boolean', label: 'Mirrored', default: true },
      direction: { type: 'enum', label: 'Direction', default: 'forward', presentation: 'dropdown', options: [
        { id: 'forward', label: 'Forward' }, { id: 'reverse', label: 'Reverse' },
      ] },
      pulse: { type: 'trigger', label: 'Pulse', description: 'Add one mirror wedge.' },
      regenerate: { type: 'trigger', label: 'Regenerate', description: 'Advance the rotation variant.' },
    },`,
  )
  .replace(
    "controlDescriptions: { segments: 'Sets the number of independently mirrored wedges.' },",
    "controlDescriptions: { segments: 'Sets the number of independently mirrored wedges.', mirrored: 'Turns the mirror fold on or off.', direction: 'Sets the rotation direction.', pulse: 'Add one mirror wedge.', regenerate: 'Advance the rotation variant.' },",
  )
  .replace(
    'let time = 0, input: ImageResource | undefined;',
    'let time = 0, pulseStep = 0, variant = 0, input: ImageResource | undefined;',
  )
  .replace(
    'return { update(frame) { segments.value = Math.round(frame.controls.segments); rotation.value = frame.timeSeconds * 0.08; time = frame.timeSeconds; },',
    `return { update(frame) {
        for (const event of frame.events) {
          if (event.controlId === 'pulse') pulseStep = (pulseStep + 1) % 8;
          if (event.controlId === 'regenerate') variant = (variant + 1) % 8;
        }
        segments.value = frame.controls.mirrored ? Math.min(16, Math.round(frame.controls.segments) + pulseStep) : 2;
        rotation.value = frame.timeSeconds * 0.08 * (frame.controls.direction === 'reverse' ? -1 : 1) + variant * 0.17;
        time = frame.timeSeconds;
      },`,
  )
  .replace(
    'reset() { rotation.value = 0; time = 0; },',
    'reset() { rotation.value = 0; time = 0; pulseStep = 0; variant = 0; },',
  );
assert.notEqual(triggerEffect, baseEffect, 'Component fixture gains typed and trigger controls');
const componentA = '22222222-2222-4222-8222-222222222222';
const componentB = '33333333-3333-4333-8333-333333333333';
const componentSource = {
  sdkVersion: '0.4.0',
  entry: 'composition.ts',
  files: {
    'ball.ts': componentBall,
    'effect.ts': triggerEffect,
    'composition.ts': `import { defineVisual } from '@lux/visual-sdk';
import ball from './ball.ts';
import effect from './effect.ts';

export default defineVisual({
  label: 'Trigger instance isolation',
  definitions: { ball, effect },
  nodes: [
    { id: '11111111-1111-4111-8111-111111111111', definition: 'ball' },
    { id: '${componentA}', definition: 'effect' },
    { id: '${componentB}', definition: 'effect' },
  ],
  edges: [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', from: { nodeId: '11111111-1111-4111-8111-111111111111', portId: 'image' }, to: { nodeId: '${componentA}', portId: 'image' }, delay: 'none' },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', from: { nodeId: '${componentA}', portId: 'image' }, to: { nodeId: '${componentB}', portId: 'image' }, delay: 'none' },
  ],
  output: { nodeId: '${componentB}', portId: 'image' },
  expose: [
    { id: 'segmentsA', nodeId: '${componentA}', controlId: 'segments' },
    { id: 'mirroredA', nodeId: '${componentA}', controlId: 'mirrored' },
    { id: 'directionA', nodeId: '${componentA}', controlId: 'direction' },
    { id: 'pulseA', nodeId: '${componentA}', controlId: 'pulse' },
    { id: 'regenerateA', nodeId: '${componentA}', controlId: 'regenerate' },
    { id: 'segmentsB', nodeId: '${componentB}', controlId: 'segments' },
    { id: 'mirroredB', nodeId: '${componentB}', controlId: 'mirrored' },
    { id: 'directionB', nodeId: '${componentB}', controlId: 'direction' },
    { id: 'pulseB', nodeId: '${componentB}', controlId: 'pulse' },
    { id: 'regenerateB', nodeId: '${componentB}', controlId: 'regenerate' },
  ],
});
`,
  },
};

const baselineCommit = execFileSync('git', ['-C', root, '-c', `safe.directory=${root}`, '-c', 'core.excludesFile=', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const trackedDiff = execFileSync('git', ['-C', root, '-c', `safe.directory=${root}`, '-c', 'core.excludesFile=', 'diff', '--binary', baselineCommit]);
const harnessBytes = await readFile(new URL(import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const report = {
  ok: false,
  root,
  profile: session.profile,
  testedSource: {
    baselineCommit,
    trackedDiffSha256: sha256(trackedDiff),
    harnessSha256: sha256(harnessBytes),
  },
  fixture: { path: fixturePath, sha256: sha256(fixture) },
  componentFixture: { sha256: sha256(JSON.stringify(componentSource)) },
  checks: [],
  screenshots: [],
  errors: [],
  mode: faultOnly ? 'fault-only' : 'full',
};

let app;
let child;
let client;
let page;
let call;
const sleep = milliseconds => new Promise(resolveWait => setTimeout(resolveWait, milliseconds));
const resultText = result => result.content?.find(part => part.type === 'text')?.text ?? '';
const parse = result => JSON.parse(resultText(result));

try {
  app = await _electron.launch({
    executablePath: installedElectron(root),
    args: [join(root, 'apps/studio/dist/main.cjs')],
    cwd: root,
    env,
    timeout: 30000,
    chromiumSandbox: true,
  });
  child = app.process();
  report.pid = await app.evaluate(() => process.pid);
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 1360, height: 900 });
  page.on('pageerror', error => report.errors.push(error.stack ?? error.message));

  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      endpoint = JSON.parse(await readFile(session.endpointPath, 'utf8'));
      if (endpoint.pid === report.pid) break;
    } catch {}
    await sleep(100);
  }
  assert.equal(endpoint?.pid, report.pid, 'Only the process launched by this test may be controlled');
  client = new Client({ name: 'lux-trigger-controls-qa', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root, 'scripts/studio-mcp.mjs')], cwd: root, env }));
  const raw = (name, args = {}) => client.callTool({ name: `lux.studio.${name}`, arguments: args }, undefined, { timeout: 75000 });
  call = async (name, args = {}) => {
    const result = await raw(name, args);
    assert.equal(result.isError, undefined, `${name}: ${resultText(result)}`);
    return parse(result);
  };
  const statusWhen = async (predicate, label, timeout = 60000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const runtime = (await call('status')).authoring;
      if (predicate(runtime)) return runtime;
      await sleep(50);
    }
    throw Error(`${label} did not settle`);
  };
  const pauseOwnedPreview = async () => {
    const runtime = (await call('status')).authoring;
    if (runtime?.playback === 'playing') {
      await call('playback', { instanceId: runtime.instanceId, expectedGeneration: runtime.generation, action: 'pause' });
      await statusWhen(next => next?.playback === 'paused', 'owned preview pause');
    }
  };
  const freshRead = async () => {
    const read = await call('read');
    assert.ok(read?.source, 'Authoring source is readable');
    return read;
  };
  const buildFromFreshRead = async nextSource => {
    let read = await freshRead();
    await pauseOwnedPreview();
    let result = await raw('build', { source: nextSource, expectedDraftVersion: read.draftVersion });
    if (result.isError && /\bbusy\b|build.*progress|authoring.*busy/i.test(resultText(result))) {
      read = await freshRead();
      await pauseOwnedPreview();
      result = await raw('build', { source: nextSource, expectedDraftVersion: read.draftVersion });
    }
    assert.equal(result.isError, undefined, `build: ${resultText(result)}`);
    return parse(result);
  };
  const captureCurrentPreview = async name => {
    const result = await raw('capture');
    assert.equal(result.isError, undefined, `capture: ${resultText(result)}`);
    const image = result.content.find(part => part.type === 'image');
    assert.ok(image, 'Preview capture includes image bytes');
    const bytes = Buffer.from(image.data, 'base64');
    const path = join(output, `${name}-preview.png`);
    await writeFile(path, bytes);
    return { path, hash: sha256(bytes), metadata: parse(result) };
  };
  const capturePreview = async name => {
    await pauseOwnedPreview();
    return captureCurrentPreview(name);
  };
  const captureVisibleCanvas = async name => {
    const path = join(output, `${name}-canvas.png`);
    const canvas = page.locator('.preview-surface canvas');
    const dataUrl = await canvas.evaluate(element => element.toDataURL('image/png'));
    const backingBytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    if (backingBytes.length > 100) {
      await writeFile(path, backingBytes);
      return { path, hash: sha256(backingBytes), source: 'canvas-backing-store' };
    }
    const box = await canvas.boundingBox();
    assert.ok(box, 'Visible preview canvas has screen bounds');
    // A runtime error adds diagnostics below the preview and changes the canvas
    // element's CSS height. Hash the centered 16:9 rendered frame, excluding the
    // surrounding letterbox whose size is expected to change with that layout.
    const frameHeight = Math.min(box.height, box.width * 9 / 16);
    const bytes = await page.screenshot({
      path,
      clip: { x: box.x, y: box.y + (box.height - frameHeight) / 2, width: box.width, height: frameHeight },
      timeout: 30000,
    });
    return { path, hash: sha256(bytes), source: 'normalized-visible-frame' };
  };
  const screenshot = async name => {
    await pauseOwnedPreview();
    const path = join(output, `${name}.png`);
    await page.screenshot({ path, timeout: 30000 });
    report.screenshots.push(path);
    return path;
  };
  const target = (runtime, controlId, commandId, nodePath) => ({
    instanceId: runtime.instanceId,
    expectedGeneration: runtime.generation,
    expectedRevisionId: runtime.revisionId,
    expectedControlSchemaHash: nodePath
      ? runtime.nodeControls.nodes.find(node => JSON.stringify(node.nodePath) === JSON.stringify(nodePath)).schemaHash
      : runtime.controlSchemaHash,
    controlId,
    commandId,
    ...(nodePath ? { nodePath } : {}),
  });
  const receiptOf = response => {
    const receipt = response?.triggerReceipt ?? response?.applied?.triggerReceipt ?? response?.applied;
    assert.ok(receipt && typeof receipt.commandId === 'string' && Number.isSafeInteger(receipt.sequence) && typeof receipt.frameId === 'string', 'Trigger response includes a completed-frame receipt');
    return receipt;
  };
  const assertCompletedFrame = (receipt, runtime) => {
    assert.ok(BigInt(runtime.frameId) >= BigInt(receipt.frameId), 'Runtime has observed the receipt frame');
    assert.equal(runtime.latestTriggerReceipt.commandId, receipt.commandId);
    assert.equal(runtime.latestTriggerReceipt.sequence, receipt.sequence);
    assert.equal(runtime.triggerSequence, receipt.sequence);
  };

  const buildButton = page.getByRole('button', { name: 'Build', exact: true });
  await buildButton.waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Build' && !button.disabled), undefined, { timeout: 90000 });
  await statusWhen(runtime => !!runtime?.revisionId, 'initial compile settlement', 90000);
  await freshRead();
  await pauseOwnedPreview();
  await page.getByRole('slider', { name: 'Preview resolution scale', exact: true }).focus();
  await page.keyboard.press('Home');
  await statusWhen(runtime => runtime?.output.width === 640 && runtime.output.height === 360, '640×360 preview resize');
  let runtime;
  if (!faultOnly) {
  await buildFromFreshRead(source);
  runtime = await statusWhen(value => value?.controlSchema?.filter(control => control.type === 'trigger').length === 2, 'flat trigger fixture');
  assert.deepEqual(runtime.controls, { size: 0.64, glow: true, palette: 'violet' });
  assert.equal(Object.hasOwn(runtime.controls, 'pulse'), false);

  runtime = (await call('parameters', {
    instanceId: runtime.instanceId,
    expectedGeneration: runtime.generation,
    expectedRevisionId: runtime.revisionId,
    expectedControlSchemaHash: runtime.controlSchemaHash,
    values: { size: 0.72, glow: false, palette: 'mint' },
  })).status.authoring;
  // Recreate the material after the live boolean edit so the reference frame uses
  // the same WebGPU pipeline state as open/rebuild/restart comparisons. Trigger
  // state is still pristine here, and the persisted controls survive the rebuild.
  await buildFromFreshRead(source);
  runtime = await statusWhen(value => value?.controls?.size === 0.72 && value?.controls?.glow === false && value?.controls?.palette === 'mint', 'stable flat reference');
  const baseline = await capturePreview('flat-baseline');

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Run Pulse', exact: true }).click();
  runtime = await statusWhen(value => value?.latestTriggerReceipt?.controlId === 'pulse', 'playing pointer trigger');
  assert.equal(runtime.playback, 'playing');
  const pointerReceipt = runtime.latestTriggerReceipt;
  assertCompletedFrame(pointerReceipt, runtime);
  await pauseOwnedPreview();
  await page.getByRole('button', { name: 'Run Regenerate', exact: true }).focus();
  await page.keyboard.press('Enter');
  runtime = await statusWhen(value => value?.latestTriggerReceipt?.sequence > pointerReceipt.sequence, 'paused Enter trigger');
  assert.equal(runtime.playback, 'paused');
  const enterReceipt = runtime.latestTriggerReceipt;
  await page.getByRole('button', { name: 'Run Pulse', exact: true }).focus();
  await page.keyboard.press('Space');
  runtime = await statusWhen(value => value?.latestTriggerReceipt?.sequence > enterReceipt.sequence, 'paused Space trigger');
  assert.equal(runtime.playback, 'paused');
  report.checks.push('Pointer, Enter, and Space invoke real trigger buttons while playing or paused; every acknowledgement names a completed frame');

  const settledPulseButton = page.getByRole('button', { name: 'Run Pulse', exact: true });
  for (let attempt = 0; attempt < 100 && (!await settledPulseButton.isEnabled() || await settledPulseButton.getAttribute('aria-busy') === 'true'); attempt++) await sleep(25);
  assert.equal(await settledPulseButton.isEnabled(), true, 'UI trigger promise settles before generic MCP work');
  assert.notEqual(await settledPulseButton.getAttribute('aria-busy'), 'true');
  runtime = (await call('status')).authoring;
  const duplicateArgs = target(runtime, 'pulse', 'qa-flat-duplicate-0001');
  const first = receiptOf(await call('trigger', duplicateArgs));
  runtime = (await call('status')).authoring;
  assertCompletedFrame(first, runtime);
  const once = await capturePreview('flat-once');
  const duplicate = receiptOf(await call('trigger', duplicateArgs));
  assert.deepEqual(duplicate, first, 'Same command ID returns the original receipt');
  const twice = await capturePreview('flat-duplicate');
  assert.equal(twice.hash, once.hash, 'Duplicate command does not redeliver the action');
  const newerArgs = target(runtime, 'regenerate', 'qa-flat-newer-0002');
  const newer = receiptOf(await call('trigger', newerArgs));
  assert.ok(newer.sequence > first.sequence);
  const oldAgain = receiptOf(await call('trigger', duplicateArgs));
  assert.deepEqual(oldAgain, first);
  runtime = (await call('status')).authoring;
  assert.equal(runtime.latestTriggerReceipt.commandId, newer.commandId, 'An old duplicate cannot regress latest receipt state');
  assert.equal(runtime.latestTriggerReceipt.sequence, newer.sequence);
  assert.equal(runtime.triggerSequence, newer.sequence);
  report.checks.push('Generic MCP command IDs are idempotent; old duplicates return the original receipt without redelivery or latest-state regression');

  const beforeFailedAction = await capturePreview('before-failed-action');
  const stale = await raw('trigger', { ...target(runtime, 'pulse', 'qa-stale-generation'), expectedGeneration: runtime.generation + 1 });
  assert.equal(stale.isError, true);
  const unknown = await raw('trigger', target(runtime, 'missingTrigger', 'qa-unknown-control'));
  assert.equal(unknown.isError, true);
  const afterFailedAction = await capturePreview('after-failed-action');
  assert.equal(afterFailedAction.hash, beforeFailedAction.hash, 'Rejected action leaves the previous frame unchanged');
  report.checks.push('Stale guards and unknown actions reject without changing the paused preview');

  const savedPath = join(output, 'trigger-controls.lux-scene');
  const saveRead = await freshRead();
  await call('save', { path: savedPath, expectedDraftVersion: saveRead.draftVersion, overwrite: false });
  const saved = JSON.parse(await readFile(savedPath, 'utf8'));
  assert.deepEqual(saved.controls.values, { size: 0.72, glow: false, palette: 'mint' });
  assert.equal(Object.hasOwn(saved.controls.values, 'pulse'), false);
  await pauseOwnedPreview();
  const openRead = await freshRead();
  await call('open', { path: savedPath, expectedDraftVersion: openRead.draftVersion, discardDirty: true });
  runtime = await statusWhen(value => value?.controls?.size === 0.72, 'trigger scene reopen');
  const reopened = await capturePreview('flat-reopened');
  assert.equal(reopened.hash, baseline.hash, 'Open restores persistent values without replaying actions');

  receiptOf(await call('trigger', target(runtime, 'pulse', 'qa-before-reset')));
  await call('playback', { instanceId: runtime.instanceId, expectedGeneration: runtime.generation, action: 'reset' });
  runtime = (await call('status')).authoring;
  assert.equal((await capturePreview('flat-reset')).hash, baseline.hash, 'Reset does not replay actions');
  receiptOf(await call('trigger', target(runtime, 'pulse', 'qa-before-rebuild')));
  await buildFromFreshRead(source);
  runtime = await statusWhen(value => value?.controls?.size === 0.72, 'trigger fixture rebuild');
  assert.equal((await capturePreview('flat-rebuilt')).hash, baseline.hash, 'Rebuild does not replay actions');
  receiptOf(await call('trigger', target(runtime, 'pulse', 'qa-before-restart')));
  const restarted = await call('restart', { instanceId: runtime.instanceId, expectedGeneration: runtime.generation });
  runtime = restarted.status.authoring;
  assert.equal((await capturePreview('flat-restarted')).hash, baseline.hash, 'Restart does not replay actions');
  report.checks.push('Save/open, reset, rebuild, and restart preserve persistent controls but never persist or replay trigger actions');

  await page.setViewportSize({ width: 1360, height: 900 });
  await sleep(150);
  await screenshot('wide-trigger-controls');
  await page.setViewportSize({ width: 820, height: 720 });
  await sleep(150);
  const inspector = page.locator('.studio-pane-inspector');
  const beforeInspector = await inspector.boundingBox();
  assert.ok(beforeInspector);
  const sash = await page.locator('.dv-sash').evaluateAll((nodes, left) => nodes.map(node => {
    const box = node.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }).find(box => box.height > 100 && box.width > 0 && box.width < 20 && Math.abs(box.x - left) < 12), beforeInspector.x);
  assert.ok(sash);
  const targetWidth = Math.max(240, beforeInspector.width);
  const delta = targetWidth - beforeInspector.width;
  if (delta > 1) {
    await page.mouse.move(sash.x + sash.width / 2, sash.y + sash.height / 2);
    await page.mouse.down();
    await page.mouse.move(sash.x - delta, sash.y + sash.height / 2, { steps: 15 });
    await page.mouse.up();
  }
  await page.waitForFunction(width => document.querySelector('.studio-pane-inspector')?.getBoundingClientRect().width >= width - 2, targetWidth);
  const afterInspector = await inspector.boundingBox();
  report.narrowInspector = { window: { width: 820, height: 720 }, before: beforeInspector.width, after: afterInspector?.width, target: targetWidth };
  await screenshot('narrow-trigger-controls');

  await page.setViewportSize({ width: 1360, height: 900 });
  await buildFromFreshRead(componentSource);
  runtime = await statusWhen(value => value?.sdkVersion === '0.4.0' && value.nodeControls?.nodes.some(node => node.nodePath[0] === componentB), 'component trigger fixture');
  const componentBaseline = await capturePreview('component-baseline');
  const aliasReceipt = receiptOf(await call('trigger', target(runtime, 'pulseA', 'qa-component-alias-a')));
  assert.deepEqual(aliasReceipt.nodePath, [componentA]);
  const afterAliasA = await capturePreview('component-alias-a');
  assert.notEqual(afterAliasA.hash, componentBaseline.hash);
  const aliasNodeDuplicate = receiptOf(await call('trigger', target(runtime, 'pulse', 'qa-component-alias-a', [componentA])));
  assert.deepEqual(aliasNodeDuplicate, aliasReceipt, 'Public alias and direct node address share one canonical command ledger');
  assert.equal((await capturePreview('component-alias-node-duplicate')).hash, afterAliasA.hash);
  await buildFromFreshRead(componentSource);
  runtime = await statusWhen(value => value?.nodeControls?.nodes.some(node => node.nodePath[0] === componentB), 'component rebuild for sibling comparison');
  const nodeReceipt = receiptOf(await call('trigger', target(runtime, 'pulse', 'qa-component-node-b', [componentB])));
  assert.deepEqual(nodeReceipt.nodePath, [componentB]);
  const afterNodeB = await capturePreview('component-node-b');
  assert.notEqual(afterNodeB.hash, componentBaseline.hash);
  assert.notEqual(afterNodeB.hash, afterAliasA.hash, 'Two component instances produce distinct routed action effects');
  runtime = (await call('status')).authoring;

  const nodeA = page.locator('.graph-node').filter({ hasText: 'Kaleidoscope' }).first();
  if (!await nodeA.count()) {
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Graph', exact: true }).click();
  }
  await nodeA.click();
  const beforeUiSequence = runtime.latestTriggerReceipt.sequence;
  await page.getByRole('button', { name: 'Run Regenerate', exact: true }).click();
  runtime = await statusWhen(value => value?.latestTriggerReceipt?.sequence > beforeUiSequence, 'selected-node trigger');
  assert.deepEqual(runtime.latestTriggerReceipt.nodePath, [componentA]);
  await screenshot('component-trigger-isolation');
  report.checks.push('Public aliases, generic node addressing, and selected-node UI route actions to the intended component instance without sibling delivery');
  }

  const faultFixture = fixture
    .replace('let pulseStep = 0;\n    let variant = 0;', 'let pulseStep = 0;\n    let variant = 0;\n    let faultAttempts = 0;')
    .replace(
      "if (event.controlId === 'regenerate') variant = (variant + 1) % 3;",
      `if (event.controlId === 'regenerate') {
            faultAttempts++;
            if (faultAttempts === 1) throw new Error('Intentional trigger QA update failure');
            pulseStep = 7;
            variant = 2;
          }`,
    );
  assert.notEqual(faultFixture, fixture, 'Test-only source mutation installs the authored update failure');
  const faultSource = { ...source, files: { 'visual.ts': faultFixture } };
  await buildFromFreshRead(faultSource);
  runtime = await statusWhen(value => value?.controlSchema?.some(control => control.id === 'regenerate' && control.type === 'trigger'), 'fault trigger fixture');
  await pauseOwnedPreview();
  const beforeFault = await captureVisibleCanvas('before-authored-trigger-fault');
  const faultScenePath = join(output, 'trigger-fault-preservation.lux-scene');
  const faultRead = await freshRead();
  await call('save', { path: faultScenePath, expectedDraftVersion: faultRead.draftVersion, overwrite: false });
  const savedFaultScene = await readFile(faultScenePath);
  const failedGeneration = runtime.generation;
  const faultArgs = target(runtime, 'regenerate', 'qa-authored-fault-0001');
  const faultResult = await raw('trigger', faultArgs);
  assert.equal(faultResult.isError, true, 'Authored trigger update failure rejects without a receipt');
  assert.match(resultText(faultResult), /RUNTIME_FAILED|Intentional trigger QA update failure/i);

  const oldDuplicate = await raw('trigger', faultArgs);
  assert.equal(oldDuplicate.isError, true, 'Failed generation cannot accept a duplicate command');
  assert.match(resultText(oldDuplicate), /Runtime changed|RUNTIME_FAILED|failed/i);
  const afterFault = await captureVisibleCanvas('after-authored-trigger-fault');
  assert.equal(afterFault.hash, beforeFault.hash, 'Authored update failure preserves the last completed paused frame');
  assert.deepEqual(await readFile(faultScenePath), savedFaultScene, 'Authored update failure does not alter the saved scene');
  const faultScreenshot = join(output, 'authored-trigger-failure.png');
  await page.screenshot({ path: faultScreenshot, timeout: 30000 });
  report.screenshots.push(faultScreenshot);

  runtime = (await call('status')).authoring;
  if (runtime.generation === failedGeneration) {
    assert.equal(runtime.playback, 'failed');
    const recovered = await raw('restart', { instanceId: runtime.instanceId, expectedGeneration: runtime.generation });
    if (recovered.isError) assert.match(resultText(recovered), /Runtime changed|generation|build is already running/i);
    else runtime = parse(recovered).status.authoring;
  }
  runtime = await statusWhen(value => value?.generation > failedGeneration && value.playback !== 'failed', 'fault generation recovery');
  assert.equal(runtime.triggerSequence, 0, 'Replacement generation starts with an empty trigger ledger');
  assert.equal(runtime.latestTriggerReceipt ?? null, null, 'Failed command produces no receipt and is not replayed');
  await pauseOwnedPreview();
  const afterRecovery = await captureVisibleCanvas('after-authored-trigger-recovery');
  assert.equal(afterRecovery.hash, beforeFault.hash, 'Replacement generation starts from the last authored source without replaying the failed action');
  const staleAfterRecovery = await raw('trigger', faultArgs);
  assert.equal(staleAfterRecovery.isError, true);
  assert.match(resultText(staleAfterRecovery), /Runtime changed|generation/i);
  report.failedAction = { failedGeneration, recoveredGeneration: runtime.generation, before: beforeFault, afterFailure: afterFault, afterRecovery };
  report.checks.push('An authored trigger update failure preserves the paused frame and saved scene; its failed generation cannot redeliver and recovery starts with an empty ledger');

  assert.deepEqual(report.errors, []);
  report.ok = true;
} catch (error) {
  report.error = error.stack ?? String(error);
  process.exitCode = 1;
  if (page && !page.isClosed()) {
    try { await pauseOwnedPreview(); } catch {}
    const failurePath = join(output, 'failure.png');
    await page.screenshot({ path: failurePath, timeout: 30000 }).catch(() => {});
    report.screenshots.push(failurePath);
  }
} finally {
  await client?.close().catch(() => {});
  if (app) {
    await app.evaluate(({ app: ownedApp }) => ownedApp.exit(0)).catch(() => {});
    await app.close().catch(() => {});
    report.exitCode = child?.exitCode;
  }
  if (report.pid) {
    try { process.kill(report.pid, 0); report.processExited = false; } catch { report.processExited = true; }
  }
  await writeFile(join(output, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, ...report }, null, 2));
}
