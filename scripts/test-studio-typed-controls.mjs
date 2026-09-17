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
const output = join(root, 'artifacts/studio-typed-controls', `native-${Date.now()}`);
await mkdir(output, { recursive: true });
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
const session = resolveStudioSession({ workspace: root, env });
const fixturePath = join(root, 'skills/lux-visual-creation/assets/typed-controls.ts');
const fixture = await readFile(fixturePath, 'utf8');
const source = { sdkVersion: '0.2.0', entry: 'visual.ts', files: { 'visual.ts': fixture } };
const componentFixtureRoot = join(root, 'tests/studio/fixtures/nested-prismatic-composition');
const componentBall = await readFile(join(componentFixtureRoot, 'ball.ts'), 'utf8');
const baseEffect = await readFile(join(componentFixtureRoot, 'kaleidoscope.ts'), 'utf8');
const typedEffect = baseEffect
  .replace(
    "controls: { segments: { type: 'number', label: 'Mirror segments', default: 6, min: 2, max: 16, step: 1 } },",
    `controls: {
      segments: { type: 'number', label: 'Mirror segments', default: 6, min: 2, max: 16, step: 1 },
      mirrored: { type: 'boolean', label: 'Mirrored', default: true },
      direction: { type: 'enum', label: 'Direction', default: 'forward', presentation: 'dropdown', options: [
        { id: 'forward', label: 'Forward' }, { id: 'reverse', label: 'Reverse' },
      ] },
    },`,
  )
  .replace(
    "controlDescriptions: { segments: 'Sets the number of independently mirrored wedges.' },",
    "controlDescriptions: { segments: 'Sets the number of independently mirrored wedges.', mirrored: 'Turns the mirror fold on or off.', direction: 'Sets the rotation direction.' },",
  )
  .replace(
    'return { update(frame) { segments.value = Math.round(frame.controls.segments); rotation.value = frame.timeSeconds * 0.08; time = frame.timeSeconds; },',
    "return { update(frame) { segments.value = frame.controls.mirrored ? Math.round(frame.controls.segments) : 2; rotation.value = frame.timeSeconds * 0.08 * (frame.controls.direction === 'reverse' ? -1 : 1); time = frame.timeSeconds; },",
  );
assert.notEqual(typedEffect, baseEffect, 'Component fixture gains typed controls');
const componentA = '22222222-2222-4222-8222-222222222222';
const componentB = '33333333-3333-4333-8333-333333333333';
const componentSource = {
  sdkVersion: '0.4.0',
  entry: 'composition.ts',
  files: {
    'ball.ts': componentBall,
    'effect.ts': typedEffect,
    'composition.ts': `import { defineVisual } from '@lux/visual-sdk';
import ball from './ball.ts';
import effect from './effect.ts';

export default defineVisual({
  label: 'Typed instance isolation',
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
    { id: 'segmentsB', nodeId: '${componentB}', controlId: 'segments' },
    { id: 'mirroredB', nodeId: '${componentB}', controlId: 'mirrored' },
    { id: 'directionB', nodeId: '${componentB}', controlId: 'direction' },
  ],
});
`,
  },
};
const baselineCommit = execFileSync('git', ['-C', root, '-c', `safe.directory=${root}`, '-c', 'core.excludesFile=', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const trackedDiff = execFileSync('git', ['-C', root, '-c', `safe.directory=${root}`, '-c', 'core.excludesFile=', 'diff', '--binary', baselineCommit]);
const worktreeStatus = execFileSync('git', ['-C', root, '-c', `safe.directory=${root}`, '-c', 'core.excludesFile=', 'status', '--short', '--untracked-files=all'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
const harnessBytes = await readFile(new URL(import.meta.url));
const report = {
  ok: false,
  root,
  profile: session.profile,
  testedSource: {
    baselineCommit,
    trackedDiffSha256: createHash('sha256').update(trackedDiff).digest('hex'),
    worktreeStatus,
    harnessSha256: createHash('sha256').update(harnessBytes).digest('hex'),
  },
  fixture: { path: fixturePath, sha256: createHash('sha256').update(fixture).digest('hex') },
  componentFixture: { sha256: createHash('sha256').update(JSON.stringify(componentSource)).digest('hex') },
  checks: [],
  screenshots: [],
  errors: [],
};

let app;
let child;
let client;
let page;
let call;

const sleep = milliseconds => new Promise(resolveWait => setTimeout(resolveWait, milliseconds));
const resultText = result => result.content?.find(part => part.type === 'text')?.text ?? '';
const parse = result => JSON.parse(resultText(result));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

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

  client = new Client({ name: 'lux-typed-controls-qa', version: '1.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [join(root, 'scripts/studio-mcp.mjs')],
    cwd: root,
    env,
  }));
  const raw = (name, args = {}) => client.callTool(
    { name: `lux.studio.${name}`, arguments: args },
    undefined,
    { timeout: 75000 },
  );
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
      await call('playback', {
        instanceId: runtime.instanceId,
        expectedGeneration: runtime.generation,
        action: 'pause',
      });
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
  const capturePreview = async name => {
    await pauseOwnedPreview();
    const result = await raw('capture');
    assert.equal(result.isError, undefined, `capture: ${resultText(result)}`);
    const image = result.content.find(part => part.type === 'image');
    assert.ok(image, 'Preview capture includes image bytes');
    const bytes = Buffer.from(image.data, 'base64');
    const path = join(output, `${name}-preview.png`);
    await writeFile(path, bytes);
    return { path, hash: sha256(bytes), metadata: parse(result) };
  };
  const screenshot = async name => {
    await pauseOwnedPreview();
    const path = join(output, `${name}.png`);
    await page.screenshot({ path, timeout: 30000 });
    report.screenshots.push(path);
    return path;
  };
  const controlTarget = runtime => ({
    instanceId: runtime.instanceId,
    expectedGeneration: runtime.generation,
    expectedRevisionId: runtime.revisionId,
    expectedControlSchemaHash: runtime.controlSchemaHash,
  });

  const buildButton = page.getByRole('button', { name: 'Build', exact: true });
  await buildButton.waitFor();
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('button')];
    return buttons.some(button => button.textContent?.trim() === 'Build' && !button.disabled);
  }, undefined, { timeout: 90000 });
  await statusWhen(runtime => !!runtime?.revisionId, 'initial compile settlement', 90000);
  await freshRead();
  await pauseOwnedPreview();

  await page.getByRole('slider', { name: 'Preview resolution scale', exact: true }).focus();
  await page.keyboard.press('Home');
  await statusWhen(runtime => runtime?.output.width === 640 && runtime.output.height === 360, '640×360 preview resize');
  await pauseOwnedPreview();

  await buildFromFreshRead(source);
  let runtime = await statusWhen(value => value?.controlSchema?.length === 5 && value.output.width === 640 && value.output.height === 360, 'typed-control fixture');
  assert.deepEqual(runtime.controlSchema.map(control => control.type), ['number', 'boolean', 'enum', 'enum', 'enum']);
  assert.deepEqual(runtime.controlSchema.filter(control => control.type === 'enum').map(control => control.presentation), ['dropdown', 'radio', 'segmented']);

  await page.getByRole('spinbutton', { name: 'Scale value', exact: true }).fill('0.83');
  await page.getByRole('spinbutton', { name: 'Scale value', exact: true }).press('Enter');
  await page.locator('[data-control-id="scale"][data-applied-value="0.83"]').waitFor();

  await page.getByRole('switch', { name: 'Glow', exact: true }).click();
  await page.locator('[data-control-id="glow"][data-applied-value="false"]').waitFor();
  await page.getByLabel('Palette value', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.getByRole('tooltip').filter({ hasText: 'Warm ember tones.' }).waitFor();
  await screenshot('keyboard-option-help');
  await page.keyboard.press('Enter');
  await page.locator('[data-control-id="palette"][data-applied-value="ember"]').waitFor();

  const right = page.getByRole('radio', { name: 'Right', exact: true });
  await right.focus();
  await page.keyboard.press('ArrowLeft');
  await page.locator('[data-control-id="direction"][data-applied-value="left"]').waitFor();
  const wide = page.getByRole('button', { name: 'Wide', exact: true });
  await wide.click();
  await page.locator('[data-control-id="shape"][data-applied-value="wide"]').waitFor();
  await wide.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.locator('[data-control-id="shape"][data-applied-value="square"]').waitFor();
  report.checks.push('Native number, switch, dropdown, radio, and segmented editors accept pointer and keyboard edits; keyboard focus reveals enum option help');

  assert.equal(await page.getByRole('button', { name: /^Animate / }).count(), 1, 'Only the numeric control exposes modulation');
  await page.getByRole('button', { name: 'Animate Scale', exact: true }).click();
  await page.getByRole('button', { name: 'Add LFO', exact: true }).click();
  runtime = await statusWhen(value => value?.controlAnimations?.some(binding => binding.controlId === 'scale'), 'numeric LFO binding');
  assert.equal(runtime.controlAnimations.find(binding => binding.controlId === 'scale').enabled, true);
  report.checks.push('Existing numeric LFO modulation remains available while typed controls stay non-animatable');

  const patched = await call('parameters', {
    ...controlTarget(runtime),
    values: { scale: 0.61, glow: false, palette: 'mint', direction: 'right', shape: 'tall' },
  });
  runtime = patched.status.authoring;
  assert.deepEqual(runtime.controls, { scale: 0.61, glow: false, palette: 'mint', direction: 'right', shape: 'tall' });
  const beforeInvalidPatch = structuredClone(runtime.controls);
  const invalidPatch = await raw('parameters', { ...controlTarget(runtime), values: { glow: 1 } });
  assert.equal(invalidPatch.isError, true, 'Generic MCP rejects a wrong typed value');
  assert.deepEqual((await call('status')).authoring.controls, beforeInvalidPatch, 'Rejected typed patch is atomic');
  report.checks.push('Generic MCP applies mixed typed patches atomically and rejects a number for a boolean');

  const savedPath = join(output, 'typed-controls.lux-scene');
  const beforeSave = await freshRead();
  await call('save', { path: savedPath, expectedDraftVersion: beforeSave.draftVersion, overwrite: false });
  const saved = JSON.parse(await readFile(savedPath, 'utf8'));
  assert.deepEqual(saved.controls.values, beforeInvalidPatch);
  assert.equal(saved.controlAnimations.some(binding => binding.controlId === 'scale'), true);

  runtime = (await call('parameters', {
    ...controlTarget(runtime),
    values: { scale: 0.34, glow: true, palette: 'violet', direction: 'left', shape: 'wide' },
  })).status.authoring;
  await pauseOwnedPreview();
  const beforeOpen = await freshRead();
  await call('open', { path: savedPath, expectedDraftVersion: beforeOpen.draftVersion, discardDirty: true });
  runtime = await statusWhen(value => value?.controls?.palette === 'mint' && value.controls.shape === 'tall', 'saved typed controls reopen');
  await pauseOwnedPreview();
  assert.deepEqual(runtime.controls, beforeInvalidPatch);
  assert.equal(runtime.controlAnimations.some(binding => binding.controlId === 'scale'), true);
  report.checks.push('Scene save and reopen preserve typed values and the numeric LFO');

  await page.setViewportSize({ width: 1360, height: 900 });
  await sleep(150);
  await screenshot('wide-typed-controls');
  await page.setViewportSize({ width: 820, height: 720 });
  await sleep(150);
  const inspector = page.locator('.studio-pane-inspector');
  const beforeInspector = await inspector.boundingBox();
  assert.ok(beforeInspector, 'Inspector is visible in the narrow layout');
  const inspectorSash = await page.locator('.dv-sash').evaluateAll((nodes, left) => nodes
    .map(node => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    })
    .find(box => box.height > 100 && box.width > 0 && box.width < 20 && Math.abs(box.x - left) < 12), beforeInspector.x);
  assert.ok(inspectorSash, 'A visible native dock divider borders the Inspector');
  const targetWidth = Math.max(240, beforeInspector.width);
  const delta = targetWidth - beforeInspector.width;
  if (delta > 1) {
    await page.mouse.move(inspectorSash.x + inspectorSash.width / 2, inspectorSash.y + inspectorSash.height / 2);
    await page.mouse.down();
    await page.mouse.move(inspectorSash.x - delta, inspectorSash.y + inspectorSash.height / 2, { steps: 15 });
    await page.mouse.up();
  }
  await page.waitForFunction(target => document.querySelector('.studio-pane-inspector')?.getBoundingClientRect().width >= target - 2, targetWidth);
  const afterInspector = await inspector.boundingBox();
  assert.ok(afterInspector && afterInspector.width >= 238, 'Narrow Inspector remains at least 240px within dock rounding');
  report.narrowInspector = {
    window: { width: 820, height: 720 },
    before: beforeInspector.width,
    after: afterInspector.width,
    target: targetWidth,
  };
  await screenshot('narrow-typed-controls');
  await page.setViewportSize({ width: 1360, height: 900 });

  const originalOptions = `        { id: 'violet', label: 'Violet', description: 'Electric violet tones.' },\n        { id: 'ember', label: 'Ember', description: 'Warm ember tones.' },\n        { id: 'mint', label: 'Mint', description: 'Fresh mint tones.' },`;
  const reorderedOptions = `        { id: 'mint', label: 'Fresh Mint', description: 'Fresh mint tones.' },\n        { id: 'violet', label: 'Electric Violet', description: 'Electric violet tones.' },\n        { id: 'ember', label: 'Warm Ember', description: 'Warm ember tones.' },`;
  const reorderedFixture = fixture.replace(originalOptions, reorderedOptions);
  assert.notEqual(reorderedFixture, fixture, 'Enum reorder fixture changes the palette declaration');
  await buildFromFreshRead({ ...source, files: { 'visual.ts': reorderedFixture } });
  runtime = await statusWhen(value => value?.controlSchema?.find(control => control.id === 'palette')?.options[0]?.id === 'mint', 'enum option reorder');
  assert.equal(runtime.controls.palette, 'mint', 'Selected enum option survives label and declaration reorder by ID');
  report.checks.push('Enum labels and order can change without moving the selected stable option ID');

  await pauseOwnedPreview();
  const beforeFailure = await capturePreview('before-invalid-build');
  const failureRead = await freshRead();
  const invalidSource = structuredClone(source);
  invalidSource.files['visual.ts'] += '\nthis is not valid TypeScript !!\n';
  let failedBuild = await raw('build', { source: invalidSource, expectedDraftVersion: failureRead.draftVersion });
  if (failedBuild.isError && /\bbusy\b|build.*progress|authoring.*busy/i.test(resultText(failedBuild))) {
    const retryRead = await freshRead();
    await pauseOwnedPreview();
    failedBuild = await raw('build', { source: invalidSource, expectedDraftVersion: retryRead.draftVersion });
  }
  assert.equal(failedBuild.isError, true, 'Invalid authored TypeScript is rejected');
  assert.doesNotMatch(resultText(failedBuild), /\bbusy\b|build.*progress|authoring.*busy/i, 'Failure is the intended compiler guard');
  const afterFailureRuntime = (await call('status')).authoring;
  assert.equal(afterFailureRuntime.revisionId, runtime.revisionId);
  assert.deepEqual(afterFailureRuntime.controls, runtime.controls);
  const afterFailure = await capturePreview('after-invalid-build');
  assert.equal(afterFailure.hash, beforeFailure.hash, 'Failed build preserves the exact paused preview frame');
  report.previewContinuity = { before: beforeFailure, after: afterFailure };
  report.checks.push('An invalid build preserves the accepted revision, typed values, and exact paused preview');
  await screenshot('invalid-build-preserved');

  await buildFromFreshRead(componentSource);
  runtime = await statusWhen(value => value?.sdkVersion === '0.4.0' && value.nodeControls?.nodes.some(node => node.nodePath[0] === componentB), 'two-instance typed component fixture');
  const componentValues = (value, id) => value.nodeControls.nodes.find(node => node.nodePath.length === 1 && node.nodePath[0] === id)?.values;
  assert.deepEqual(componentValues(runtime, componentA), { segments: 6, mirrored: true, direction: 'forward' });
  assert.deepEqual(componentValues(runtime, componentB), { segments: 6, mirrored: true, direction: 'forward' });

  const componentNodeA = page.locator('.graph-node').filter({ hasText: 'Kaleidoscope' }).first();
  if (!await componentNodeA.count()) {
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Graph', exact: true }).click();
  }
  await componentNodeA.click();
  const componentNumber = page.getByRole('spinbutton', { name: 'Mirror segments value', exact: true });
  await componentNumber.fill('9');
  await componentNumber.press('Enter');
  await page.getByRole('switch', { name: 'Mirrored', exact: true }).click();
  await page.getByLabel('Direction value', { exact: true }).click();
  await page.getByRole('option', { name: 'Reverse', exact: true }).click();
  runtime = await statusWhen(value => {
    const values = componentValues(value, componentA);
    return values?.segments === 9 && values.mirrored === false && values.direction === 'reverse';
  }, 'component A Inspector edits');
  assert.deepEqual(componentValues(runtime, componentB), { segments: 6, mirrored: true, direction: 'forward' }, 'Component B is unchanged by component A Inspector edits');

  runtime = (await call('parameters', {
    ...controlTarget(runtime),
    values: { segmentsA: 11, mirroredA: false, directionA: 'reverse' },
  })).status.authoring;
  assert.deepEqual(componentValues(runtime, componentA), { segments: 11, mirrored: false, direction: 'reverse' });
  assert.deepEqual(componentValues(runtime, componentB), { segments: 6, mirrored: true, direction: 'forward' }, 'Component B is unchanged by component A public aliases');
  await screenshot('component-instance-a');
  report.checks.push('Selected-node Inspector edits and guarded public aliases change one typed component instance without changing its sibling');

  const componentPath = join(output, 'typed-component-isolation.lux-scene');
  const componentRead = await freshRead();
  await call('save', { path: componentPath, expectedDraftVersion: componentRead.draftVersion, overwrite: false });
  const componentSaved = JSON.parse(await readFile(componentPath, 'utf8'));
  assert.equal(componentSaved.version, 4);
  assert.deepEqual(componentSaved.source, componentSource);

  runtime = (await call('parameters', {
    ...controlTarget(runtime),
    values: {
      segmentsA: 6,
      mirroredA: true,
      directionA: 'forward',
      segmentsB: 13,
      mirroredB: false,
      directionB: 'reverse',
    },
  })).status.authoring;
  assert.deepEqual(componentValues(runtime, componentB), { segments: 13, mirrored: false, direction: 'reverse' });
  await pauseOwnedPreview();
  const beforeComponentOpen = await freshRead();
  await call('open', { path: componentPath, expectedDraftVersion: beforeComponentOpen.draftVersion, discardDirty: true });
  runtime = await statusWhen(value => componentValues(value, componentA)?.segments === 11 && componentValues(value, componentB)?.segments === 6, 'component isolation reopen');
  await pauseOwnedPreview();
  assert.deepEqual(componentValues(runtime, componentA), { segments: 11, mirrored: false, direction: 'reverse' });
  assert.deepEqual(componentValues(runtime, componentB), { segments: 6, mirrored: true, direction: 'forward' });
  report.checks.push('SDK 0.4 save and reopen preserve distinct number, boolean, and enum values for two instances of one component');

  assert.deepEqual(report.errors, []);
  report.ok = true;
} catch (error) {
  report.error = error.stack ?? String(error);
  process.exitCode = 1;
  if (page && !page.isClosed()) {
    try {
      if (call) {
        const runtime = (await call('status')).authoring;
        if (runtime?.playback === 'playing') {
          await call('playback', { instanceId: runtime.instanceId, expectedGeneration: runtime.generation, action: 'pause' });
        }
      }
    } catch {}
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
    try {
      process.kill(report.pid, 0);
      report.processExited = false;
    } catch {
      report.processExited = true;
    }
  }
  await writeFile(join(output, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, ...report }, null, 2));
}
