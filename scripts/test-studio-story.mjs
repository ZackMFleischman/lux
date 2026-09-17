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
const modeArgument = process.argv.find(value => value.startsWith('--focus='));
const mode = modeArgument?.slice('--focus='.length) ?? 'full';
assert.ok(['full', 'transport', 'faults', 'layout', 'tail'].includes(mode), 'Expected --focus=transport, faults, layout, or tail');
const output = join(root, 'artifacts/studio-story', `native-${Date.now()}-${mode}`);
await mkdir(output, { recursive: true });
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
const session = resolveStudioSession({ workspace: root, env });
const scenePath = join(root, 'artifacts/story-controls/Vinyl Cosmos Story.lux-scene');
const sceneBytes = await readFile(scenePath);
const scene = JSON.parse(sceneBytes);
const baselineCommit = execFileSync('git', ['-C', root, '-c', `safe.directory=${root}`, '-c', 'core.excludesFile=', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const trackedDiff = execFileSync('git', ['-C', root, '-c', `safe.directory=${root}`, '-c', 'core.excludesFile=', 'diff', '--binary', baselineCommit]);
const harnessBytes = await readFile(new URL(import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const report = {
  ok: false,
  mode,
  root,
  profile: session.profile,
  scene: { path: scenePath, sha256: sha256(sceneBytes), sourceHash: scene.controls.sourceHash },
  testedSource: { baselineCommit, trackedDiffSha256: sha256(trackedDiff), harnessSha256: sha256(harnessBytes) },
  checks: [], screenshots: [], errors: [],
};

assert.equal(scene.version, 6);
assert.equal(scene.story.beats.length, 6);
assert.equal(scene.story.sequence.length, 6);
assert.equal(scene.story.sequence.filter(row => row.beatId === 'orbit').length, 1);
const repeatedStory = structuredClone(scene.story);
repeatedStory.sequence.splice(2, 0, { id: 'orbit-2', beatId: 'orbit', follow: { kind: 'after', seconds: 4 } });
repeatedStory.sequence[1] = { id: 'orbit-1', beatId: 'orbit', follow: { kind: 'after', seconds: 4 } };

let app;
let child;
let client;
let page;
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
  page.setDefaultTimeout(20000);
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
  client = new Client({ name: 'lux-story-native-qa', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root, 'scripts/studio-mcp.mjs')], cwd: root, env }));
  const rawTool = (name, args = {}) => client.callTool({ name, arguments: args }, undefined, { timeout: 90000 });
  const callTool = async (name, args = {}) => {
    const result = await rawTool(name, args);
    assert.equal(result.isError, undefined, `${name}: ${resultText(result)}`);
    return parse(result);
  };
  const studio = (name, args = {}) => callTool(`lux.studio.${name}`, args);
  const rawStudio = (name, args = {}) => rawTool(`lux.studio.${name}`, args);
  const storyCall = (name, args = {}) => callTool(`lux.story.${name}`, args);
  const rawStory = (name, args = {}) => rawTool(`lux.story.${name}`, args);
  const runtime = async () => (await studio('status')).authoring;
  const statusWhen = async (predicate, label, timeout = 90000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const value = await runtime();
      if (predicate(value)) return value;
      await sleep(50);
    }
    throw Error(`${label} did not settle`);
  };
  const storyWhen = async (predicate, label, timeout = 90000) => statusWhen(value => value?.story && predicate(value.story, value), label, timeout);
  const pausePreview = async () => {
    const value = await runtime();
    if (value?.playback === 'playing') {
      await studio('playback', { instanceId: value.instanceId, expectedGeneration: value.generation, action: 'pause' });
      await statusWhen(next => next.playback === 'paused', 'preview pause');
    }
  };
  const playPreview = async () => {
    const value = await runtime();
    if (value?.playback === 'paused') {
      await studio('playback', { instanceId: value.instanceId, expectedGeneration: value.generation, action: 'play' });
      await statusWhen(next => next.playback === 'playing', 'preview play');
    }
  };
  const freshRead = async () => {
    const read = await studio('read');
    assert.ok(read.source);
    return read;
  };
  const buildStory = async nextStory => {
    let read = await freshRead();
    await pausePreview();
    let result = await rawStudio('build', { source: read.source, story: nextStory, expectedDraftVersion: read.draftVersion });
    if (result.isError && /\bbusy\b|build.*progress|authoring.*busy/i.test(resultText(result))) {
      read = await freshRead();
      await pausePreview();
      result = await rawStudio('build', { source: read.source, story: nextStory, expectedDraftVersion: read.draftVersion });
    }
    assert.equal(result.isError, undefined, `Story build: ${resultText(result)}`);
    return parse(result);
  };
  const backingFrame = async name => {
    const dataUrl = await page.locator('.preview-surface canvas').evaluate(element => element.toDataURL('image/png'));
    const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    assert.ok(bytes.length > 100);
    const path = join(output, `${name}-frame.png`);
    await writeFile(path, bytes);
    return { path, sha256: sha256(bytes) };
  };
  const screenshot = async (name, width, height) => {
    await page.setViewportSize({ width, height });
    await sleep(180);
    const path = join(output, `${name}-${width}x${height}.png`);
    await page.screenshot({ path, timeout: 30000 });
    report.screenshots.push(path);
    return path;
  };
  const storyArgs = (value, action, commandId) => ({
    instanceId: value.instanceId,
    expectedGeneration: value.generation,
    expectedRevisionId: value.revisionId,
    expectedStoryHash: value.story.storyHash,
    expectedStoryRevision: value.story.storyRevision,
    commandId,
    ...action,
  });
  const appliedStory = response => {
    assert.equal(Object.hasOwn(response ?? {}, 'applied'), false, 'MCP returns the documented direct Story result envelope');
    assert.equal(response?.receipt?.result, 'applied');
    assert.ok(typeof response.receipt.frameId === 'string');
    assert.ok(response.currentStatus?.frame);
    return response;
  };
  const transport = async (value, action, commandId) => appliedStory(await storyCall('transport', storyArgs(value, action, commandId)));
  const openStoryPanel = async () => {
    if (await page.locator('.story-panel').count()) return;
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Story', exact: true }).click();
    await page.locator('.story-panel').waitFor();
  };
  const assertPreviewAndStory = async label => {
    const previewBox = await page.locator('.preview-surface canvas').boundingBox();
    const storyBox = await page.locator('.story-panel').boundingBox();
    assert.ok(previewBox && previewBox.width > 0 && previewBox.height > 0, `${label}: Preview canvas must remain visible`);
    assert.ok(storyBox && storyBox.width > 0 && storyBox.height > 0, `${label}: Story panel must remain visible`);
  };

  const buildButton = page.getByRole('button', { name: 'Build', exact: true });
  await buildButton.waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Build' && !button.disabled), undefined, { timeout: 90000 });
  await statusWhen(value => !!value?.revisionId, 'initial compile settlement');
  await pausePreview();
  const beforeOpen = await freshRead();
  await studio('open', { path: scenePath, expectedDraftVersion: beforeOpen.draftVersion, discardDirty: true });
  let value = await storyWhen(story => story.frame.state === 'normal', 'Vinyl Story open');
  assert.equal(value.story.definition.beats.length, 6);
  assert.equal(value.story.definition.sequence.length, 6);
  const publicStory = await storyCall('read', { view: 'status' });
  assert.equal((publicStory.status ?? publicStory.story ?? publicStory).frame.state, 'normal');
  await page.getByRole('slider', { name: 'Preview resolution scale', exact: true }).focus();
  await page.keyboard.press('Home');
  await statusWhen(next => next.output.width === 640 && next.output.height === 360, '640×360 preview output');
  await openStoryPanel();
  await assertPreviewAndStory('View menu Story opener');
  assert.equal(await page.locator('.story-ribbon > li').count(), 6);
  assert.equal(await page.locator('.story-dwell-progress').count(), 0);

  if (mode === 'full' || mode === 'transport') {
    const normalRevision = value.story.storyRevision;
    await page.locator('.story-beat-select').filter({ hasText: 'Orbit and tidal distortion' }).click();
    value = await runtime();
    assert.equal(value.story.frame.state, 'normal', 'Selecting a beat does not launch it');
    assert.equal(value.story.storyRevision, normalRevision, 'Selection is local UI state');
    report.checks.push('Pointer selection changes no runtime Story state or persisted scene');

    await page.getByRole('button', { name: 'Launch Orbit and tidal distortion', exact: true }).click();
    value = await storyWhen(story => story.frame.state === 'active' && story.frame.beatId === 'orbit' && story.sequence.state === 'detached', 'manual sustained launch');
    const sustainedActivation = value.story.frame.activationId;
    const sustainedElapsed = value.story.frame.elapsedSeconds;
    await sleep(14500);
    value = await runtime();
    assert.equal(value.story.frame.activationId, sustainedActivation);
    assert.equal(value.story.sequence.state, 'detached');
    assert.equal(value.story.frame.localTimeSeconds, null);
    assert.equal(value.story.frame.progress, null);
    assert.ok(value.story.frame.elapsedSeconds > sustainedElapsed + 13, 'Sustained launch remains active beyond the scheduled orbit dwell');
    report.checks.push('Manual sustained Orbit remains one activation beyond its scheduled occurrence dwell');

    await page.getByRole('button', { name: 'Pause story', exact: true }).focus();
    await page.keyboard.press('Enter');
    value = await storyWhen(story => story.phase === 'paused', 'Story pause');
    const dwellAtPause = value.story.sequence.dwellElapsedSeconds;
    const ambientA = await backingFrame('story-paused-ambient-a');
    await sleep(700);
    const ambientB = await backingFrame('story-paused-ambient-b');
    value = await runtime();
    assert.notEqual(ambientB.sha256, ambientA.sha256, 'Story pause retains ambient sustained animation');
    assert.equal(value.story.sequence.dwellElapsedSeconds, dwellAtPause);
    await pausePreview();
    const frozenA = await backingFrame('preview-paused-a');
    await sleep(700);
    const frozenB = await backingFrame('preview-paused-b');
    assert.equal(frozenB.sha256, frozenA.sha256, 'Preview pause freezes the complete frame');
    await playPreview();
    await page.getByRole('button', { name: 'Play story', exact: true }).click();
    await storyWhen(story => story.phase === 'running', 'Story play');
    report.checks.push('Story pause keeps sustained ambient motion live while Preview pause freezes all pixels');

    await buildStory(repeatedStory);
    value = await storyWhen(story => story.frame.state === 'normal' && story.definition.sequence.length === 7, 'test-only repeated occurrence Story');
    await playPreview();
    await page.getByRole('button', { name: 'Launch Orbit and tidal distortion', exact: true }).click();
    value = await storyWhen(story => story.frame.state === 'active' && story.frame.beatId === 'orbit' && story.sequence.state === 'detached', 'repeated Story manual Orbit launch');
    const repeatedActivation = value.story.frame.activationId;
    await page.getByRole('button', { name: /Orbit and tidal distortion — occurrence 3 of 7 · orbit-2/ }).click();
    await page.getByRole('button', { name: /Resume here: Orbit and tidal distortion — occurrence 3 of 7/ }).click();
    value = await storyWhen(story => story.sequence.occurrenceId === 'orbit-2', 'explicit repeated occurrence resume');
    assert.equal(value.story.frame.activationId, repeatedActivation, 'Same-beat resume preserves activation');
    assert.ok(value.story.sequence.dwellElapsedSeconds < 4, 'Resume starts a fresh dwell');
    assert.equal(value.story.autoAdvance, true);
    await screenshot('story-attached-occurrence-dwell', 1360, 900);
    assert.ok(await page.locator('.story-dwell-progress').isVisible());
    value = await storyWhen(story => story.sequence.occurrenceId === 'chaos-1', 'scheduled orbit dwell advance', 10000);
    assert.equal(value.story.frame.beatId, 'chaos');
    report.checks.push('Explicit repeated-occurrence resume preserves the pose, starts fresh dwell, and advances on the worker clock');

    await pausePreview();
    const restoreRead = await freshRead();
    await studio('open', { path: scenePath, expectedDraftVersion: restoreRead.draftVersion, discardDirty: true });
    value = await storyWhen(story => story.frame.state === 'normal' && story.definition.sequence.length === 6, 'restore production Story');
    await playPreview();
  }

  if (mode === 'full' || mode === 'transport' || mode === 'tail') {
    value = await runtime();
    const launchArrival = await transport(value, { action: 'launch', beatId: 'arrival' }, 'qa-story-launch-arrival');
    assert.equal(launchArrival.receipt.story.beatId, 'arrival');
    value = await storyWhen(story => story.frame.state === 'active' && story.frame.beatId === 'arrival', 'timed Arrival launch');
    const seekArgs = storyArgs(value, { action: 'seek', localTimeSeconds: 6 }, 'qa-story-seek-six');
    const seekFirst = appliedStory(await storyCall('transport', seekArgs));
    assert.equal(seekFirst.receipt.story.localTimeSeconds, 6);
    assert.equal(seekFirst.receipt.story.progress, 0.5);
    assert.equal(seekFirst.currentStatus.phase, 'paused');
    const seekDuplicate = appliedStory(await storyCall('transport', seekArgs));
    assert.deepEqual(seekDuplicate.receipt, seekFirst.receipt, 'Exact retry returns the original completed-frame receipt');
    await pausePreview();
    const heldSeek = await backingFrame('timed-seek-held');
    const stale = await rawStory('transport', { ...seekArgs, commandId: 'qa-story-stale-seek', localTimeSeconds: 5 });
    assert.equal(stale.isError, true);
    assert.match(resultText(stale), /Story transport changed|STORY_CHANGED|revision/i);
    assert.equal((await backingFrame('timed-seek-after-stale')).sha256, heldSeek.sha256);
    await screenshot('story-timed-paused-seek', 1360, 900);
    report.checks.push('Timed direct seek returns the drawn pose; exact retry is idempotent and stale revision leaves it unchanged');
    await playPreview();

    const beforeReplay = (await runtime()).story.frame.activationId;
    await page.getByRole('button', { name: 'Replay Arrival', exact: true }).click();
    value = await storyWhen(story => story.frame.state === 'active' && story.frame.beatId === 'arrival' && story.frame.activationId > beforeReplay, 'Arrival replay');
    assert.ok((value.story.frame.localTimeSeconds ?? 99) < 2);
    const loopActivation = value.story.frame.activationId;
    await page.getByRole('button', { name: 'Loop Arrival', exact: true }).focus();
    await page.keyboard.press('Space');
    value = await storyWhen(story => story.loop && story.frame.activationId > loopActivation, 'Arrival loop start');
    const firstLoopActivation = value.story.frame.activationId;
    value = await storyWhen(story => story.loop && story.frame.activationId > firstLoopActivation, 'Arrival loop endpoint restart', 20000);
    assert.ok((value.story.frame.localTimeSeconds ?? 99) < 2);
    report.checks.push('Native replay and keyboard loop restart timed beats at local zero and loop across an endpoint');

    await page.getByRole('button', { name: 'Return to normal', exact: true }).focus();
    await page.keyboard.press('Space');
    value = await storyWhen(story => story.frame.state === 'normal', 'Return to normal');
    report.checks.push('Keyboard Return to normal restores the original solar-system behavior without a visual reset command');
  }

  if (mode === 'full' || mode === 'layout' || mode === 'tail') {
    await pausePreview();
    if (mode === 'layout') {
      await page.getByRole('button', { name: /Story status: .*Open Story/ }).click();
      await sleep(180);
      await assertPreviewAndStory('status-bar Story opener');
    }
    await screenshot('story-desktop', 1360, 900);
    await screenshot('story-medium', 1100, 720);
    const ribbon = page.locator('.story-ribbon');
    await ribbon.scrollIntoViewIfNeeded();
    await screenshot('story-compact', 640, 360);
    assert.ok(await ribbon.isVisible());
    await assertPreviewAndStory('compact Normal layout');
    report.checks.push('Native Story panel and sequence ribbon remain visible at desktop, 1100×720, and 640×360');
    await page.setViewportSize({ width: 1360, height: 900 });
    await sleep(180);

    if (mode === 'layout') {
      await playPreview();
      value = await runtime();
      await transport(value, { action: 'launch', beatId: 'arrival' }, 'qa-layout-launch-arrival');
      value = await storyWhen(story => story.frame.state === 'active' && story.frame.beatId === 'arrival', 'layout timed launch');
      await transport(value, { action: 'seek', localTimeSeconds: 6 }, 'qa-layout-seek-arrival');
      await storyWhen(story => story.phase === 'paused' && story.frame.localTimeSeconds === 6, 'layout timed seek');
      await pausePreview();
      await screenshot('story-layout-timed-paused-desktop', 1360, 900);
      await screenshot('story-layout-timed-paused-medium', 1100, 720);
      await screenshot('story-layout-timed-paused-compact', 640, 360);
      await assertPreviewAndStory('compact timed layout');

      await page.setViewportSize({ width: 1360, height: 900 });
      await playPreview();
      value = await runtime();
      await transport(value, { action: 'return-normal' }, 'qa-layout-return-normal');
      value = await storyWhen(story => story.frame.state === 'normal', 'layout return normal');
      await transport(value, { action: 'start' }, 'qa-layout-start-sequence');
      value = await storyWhen(story => story.sequence.state === 'attached' && story.sequence.occurrenceId === 'arrival-1', 'layout attached sequence');
      await transport(value, { action: 'pause' }, 'qa-layout-pause-sequence');
      await storyWhen(story => story.phase === 'paused' && story.sequence.state === 'attached', 'layout paused sequence');
      await pausePreview();
      const autoAdvance = page.getByText('Auto-advance', { exact: true });
      await autoAdvance.scrollIntoViewIfNeeded();
      await screenshot('story-layout-attached-dwell-desktop', 1360, 900);
      await page.setViewportSize({ width: 1100, height: 720 });
      await autoAdvance.scrollIntoViewIfNeeded();
      await screenshot('story-layout-attached-dwell-medium', 1100, 720);
      await page.setViewportSize({ width: 640, height: 360 });
      await autoAdvance.scrollIntoViewIfNeeded();
      await screenshot('story-layout-attached-dwell-compact', 640, 360);
      await assertPreviewAndStory('compact attached layout');
      assert.ok(await page.locator('.story-dwell-progress').isVisible());
      assert.ok(await autoAdvance.isVisible());
      const compactOverflow = await page.locator('.story-panel').evaluate(element => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      assert.ok(compactOverflow.scrollHeight >= compactOverflow.clientHeight && compactOverflow.scrollWidth >= compactOverflow.clientWidth,
        'Compact Story layout retains reachable overflow dimensions');
      report.checks.push('Normal, paused timed seek, and attached dwell remain visible with Preview across desktop, 1100×720, and 640×360');
    }
  }

  if (mode === 'full' || mode === 'faults' || mode === 'tail') {
    value = await runtime();
    if (value.story.frame.state !== 'normal') await transport(value, { action: 'return-normal' }, `qa-story-normal-${mode}`);
    await pausePreview();
    const savedPath = join(output, 'Vinyl Cosmos Story Saved.lux-scene');
    const saveRead = await freshRead();
    await studio('save', { path: savedPath, expectedDraftVersion: saveRead.draftVersion, overwrite: false });
    const savedBytes = await readFile(savedPath);
    const savedDocument = JSON.parse(savedBytes);
    assert.deepEqual(savedDocument.story, scene.story);
    const openRead = await freshRead();
    await studio('open', { path: savedPath, expectedDraftVersion: openRead.draftVersion, discardDirty: true });
    value = await storyWhen(story => story.frame.state === 'normal', 'saved Story reopen');
    assert.deepEqual(value.story.definition, scene.story);
    report.checks.push('Save/reopen preserves Story definitions and starts in Normal without playback transport state');

    await transport(value, { action: 'launch', beatId: 'aftermath' }, `qa-story-fault-pose-${mode}`);
    await storyWhen(story => story.frame.state === 'active' && story.frame.beatId === 'aftermath', 'fault baseline aftermath');
    await pausePreview();
    const beforeFault = await backingFrame('before-invalid-build-open');
    value = await runtime();
    const generation = value.generation;
    const acceptedRevision = value.revisionId;
    const invalidRead = await freshRead();
    const invalidSource = structuredClone(invalidRead.source);
    invalidSource.files[invalidSource.entry] += '\nthis is not valid TypeScript !!!';
    const failedBuild = await rawStudio('build', { source: invalidSource, story: invalidRead.story, expectedDraftVersion: invalidRead.draftVersion });
    assert.equal(failedBuild.isError, true);
    value = await runtime();
    assert.equal(value.generation, generation);
    assert.equal(value.revisionId, acceptedRevision);
    assert.equal((await backingFrame('after-invalid-build')).sha256, beforeFault.sha256);
    assert.deepEqual(await readFile(savedPath), savedBytes);

    const badOpenPath = join(output, 'invalid-story-open.lux-scene');
    await writeFile(badOpenPath, '{"format":"lux-scene","version":6,"broken":true}\n');
    const badOpenRead = await freshRead();
    const failedOpen = await rawStudio('open', { path: badOpenPath, expectedDraftVersion: badOpenRead.draftVersion, discardDirty: true });
    assert.equal(failedOpen.isError, true);
    value = await runtime();
    assert.equal(value.generation, generation);
    assert.equal(value.revisionId, acceptedRevision);
    assert.equal((await backingFrame('after-invalid-open')).sha256, beforeFault.sha256);
    assert.deepEqual(await readFile(savedPath), savedBytes);
    report.checks.push('Invalid build and invalid open preserve the accepted paused output, runtime generation, and saved user copy');
  }

  assert.deepEqual(report.errors, []);
  report.ok = true;
} catch (error) {
  report.error = error.stack ?? String(error);
  process.exitCode = 1;
  if (page && !page.isClosed()) {
    const path = join(output, 'failure.png');
    await page.screenshot({ path, timeout: 30000 }).catch(() => {});
    report.screenshots.push(path);
  }
} finally {
  if (client) await client.close().catch(() => {});
  if (app) await app.close().catch(() => {});
  if (child && child.exitCode === null) await new Promise(resolveExit => child.once('exit', resolveExit));
  report.exitCode = child?.exitCode;
  report.processExited = child ? child.exitCode !== null : true;
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, ...report }, null, 2));
}
