import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { _electron } from 'playwright';
import { installedElectron } from '../../scripts/studio-electron.mjs';
import { studioTestEnvironment } from '../../scripts/studio-session.mjs';

const root = resolve(import.meta.dirname, '../..');
const output = resolve(import.meta.dirname);
const sharedRoot = join(tmpdir(), 'lux-standard-library-native', randomUUID(),
  'shared-library-with-a-deliberately-long-path-for-layout-verification', 'library');
await mkdir(output, { recursive: true });
const report = { ok: false, commit: 'add6587b21410ea42699c6985553ff8a0708ba92', sharedRoot,
  profiles: [], checks: [], exits: [], errors: [] };
const parsed = result => JSON.parse(result.content.find(item => item.type === 'text').text);

async function launch(label) {
  const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath, LUX_STUDIO_LIBRARY_ROOT: sharedRoot };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ executablePath: installedElectron(root),
    args: [join(root, 'apps/studio/dist/main.cjs')], cwd: root, env, timeout: 30000, chromiumSandbox: true });
  const page = await app.firstWindow(); page.setDefaultTimeout(20000);
  const client = new Client({ name: `lux-library-native-${label}`, version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: [join(root, 'scripts/studio-mcp.mjs')], cwd: root, env }));
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 75000 });
    assert.equal(result.isError, undefined, JSON.stringify(result)); return parsed(result);
  };
  report.profiles.push(env.LUX_STUDIO_PROFILE);
  return { app, page, client, call, label };
}

async function showLibrary(instance, screenshot) {
  await instance.page.getByText('View', { exact: true }).click();
  await instance.page.getByRole('menuitem', { name: 'Library', exact: true }).click();
  const panel = instance.page.getByRole('region', { name: 'Shared component library' });
  await panel.waitFor();
  await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
  await panel.getByText('Prismatic Ball', { exact: true }).waitFor();
  await panel.getByText('QA Saved Ball', { exact: true }).waitFor();
  await panel.getByText(new RegExp(`Isolated test library.*${sharedRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')).waitFor();
  const heading = await panel.locator('.library-heading').boundingBox();
  const pane = await panel.boundingBox();
  assert.ok(heading && pane && heading.width <= pane.width + 1, 'Library path heading stays inside the pane');
  await instance.page.screenshot({ path: join(output, screenshot) });
}

async function stop(instance) {
  await instance.client.close();
  const child = instance.app.process(), exited = child.exitCode === null ? once(child, 'exit') : Promise.resolve([child.exitCode]);
  await instance.app.evaluate(({ app }) => app.exit(0));
  const [code] = await Promise.race([exited, new Promise((_, reject) => setTimeout(() => reject(Error(`${instance.label} did not exit`)), 10000))]);
  await instance.app.close().catch(() => {});
  assert.equal(code, 0, `${instance.label} process exit`); report.exits.push({ label: instance.label, code });
}

let first, second;
try {
  first = await launch('profile-a');
  const initial = await first.call('lux.library.list');
  const builtIn = initial.find(item => item.name === 'Prismatic Ball');
  assert.ok(builtIn, 'Packaged repository seed exposes Prismatic Ball');
  const builtInSource = await first.call('lux.library.read', { id: builtIn.id });
  const created = await first.call('lux.library.create', { name: 'QA Saved Ball',
    description: 'Explicit reusable save created by native library QA.', source: builtInSource.source });
  assert.equal(created.revision, 1);
  report.builtIn = { id: builtIn.id, revision: builtIn.revision };
  report.created = { id: created.id, revision: created.revision };
  report.checks.push('Built-in Prismatic Ball is present and explicit library create succeeds');
  await showLibrary(first, 'profile-a-library.png');
  await stop(first); first = null;

  second = await launch('profile-b');
  const shared = await second.call('lux.library.list');
  assert.ok(shared.some(item => item.id === report.builtIn.id));
  assert.ok(shared.some(item => item.id === report.created.id));
  report.checks.push('A distinct Studio profile sees both the built-in and explicit save through one isolated root');
  const scene = {
    sdkVersion: '0.4.0', entry: 'composition.ts', files: { 'composition.ts': `import { defineComposition } from '@lux/visual-sdk';
import ball from './library/qa-saved-ball/component.ts';
export default defineComposition({
  definitions: { ball },
  nodes: [{ id: '11111111-1111-4111-8111-111111111111', definition: 'ball' }],
  edges: [],
  output: { nodeId: '11111111-1111-4111-8111-111111111111', portId: 'image' },
  expose: [{ id: 'intensity', nodeId: '11111111-1111-4111-8111-111111111111', controlId: 'intensity' }],
});\n` },
  };
  const current = await second.call('lux.studio.read');
  const built = await second.call('lux.studio.build', { expectedDraftVersion: current.draftVersion, source: scene,
    libraryLinks: [{ componentId: report.created.id, mountPath: 'library/qa-saved-ball' }] });
  assert.equal(built.status.authoring.playback, 'playing');
  const scenePath = join(output, 'shared-library-scene.lux-scene');
  const saved = await second.call('lux.studio.save', { path: scenePath, expectedDraftVersion: built.draftVersion, overwrite: true });
  const opened = await second.call('lux.studio.open', { path: scenePath, expectedDraftVersion: built.draftVersion });
  assert.equal(opened.name, 'shared-library-scene.lux-scene');
  const reopened = await second.call('lux.studio.read');
  assert.equal(reopened.libraryLinks[0].componentId, report.created.id);
  assert.equal(reopened.libraryLinks[0].resolvedRevision, 1);
  assert.ok(reopened.source.files['library/qa-saved-ball/component.ts']);
  assert.equal(JSON.parse(await readFile(scenePath, 'utf8')).libraryLinks[0].componentId, report.created.id);
  report.checks.push('Linked composition builds, saves, and reopens with its resolved revision and mounted fallback source');
  await showLibrary(second, 'profile-b-library.png');
  report.checks.push('Actual Library panel identifies the isolated storage path without overflowing its pane');
  await stop(second); second = null;
  report.ok = true;
} catch (error) {
  report.errors.push(error.stack || String(error)); process.exitCode = 1;
} finally {
  for (const instance of [first, second]) if (instance) {
    await instance.client.close().catch(() => {});
    await instance.app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await instance.app.close().catch(() => {});
  }
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
