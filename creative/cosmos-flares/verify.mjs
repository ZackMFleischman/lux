import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { _electron } from 'playwright';
import { studioTestEnvironment, resolveStudioSession, createStudioConnection } from '../../scripts/studio-session.mjs';
const dir = import.meta.dirname;
const installation = JSON.parse(await readFile(process.env.LOCALAPPDATA + '/Programs/Lux/installation.json', 'utf8'));
const output = dir + '/evidence-' + Date.now();
await mkdir(output, { recursive: true });
const publish = process.argv.includes('--publish');
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: installation.node,
  ...(publish ? { LUX_STUDIO_LIBRARY_ROOT: installation.canonicalLibraryRoot } : {}) };
const session = resolveStudioSession({ workspace: installation.workspace, env });
const call = createStudioConnection(session, { timeoutMs: 75000 });
let app;
const report = { profile: session.profile, root: installation.workspace, screenshots: [], checks: [], ok: false };
try {
  app = await _electron.launch({ executablePath: installation.executable, args: [], cwd: installation.directory, env, timeout: 30000, chromiumSandbox: true });
  report.pid = app.process().pid;
  app.process().stderr.on('data', data => void appendFile(output + '/stderr.log', data));
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  let ready;
  for (let i = 0; i < 150; i++) {
    try {
      ready = await call('read');
      if (ready.status?.authoring?.frameId && await page.getByRole('button', { name: 'Build', exact: true }).isEnabled()) break;
    } catch {}
    await page.waitForTimeout(200);
  }
  if (!ready?.source) throw Error('Isolated Studio did not become ready');
  const requestedKinds = process.argv.slice(2).filter(argument => argument !== '--publish');
  for (const kind of requestedKinds.length ? requestedKinds : ['diffraction', 'optical']) {
    const source = JSON.parse(await readFile(dir + '/' + kind + '-visual.json', 'utf8'));
    const before = await call('read');
    const state = before.status.authoring;
    await call('playback', { instanceId: state.instanceId, expectedGeneration: state.generation, action: 'pause' });
    const build = await call('build', { source, expectedDraftVersion: before.draftVersion });
    await writeFile(output + '/' + kind + '-build.json', JSON.stringify(build, null, 2));
    const current = await call('status');
    if (current.authoring.fault) throw Error(JSON.stringify(current.authoring.fault));
    const capture = await call('capture');
    await writeFile(output + '/' + kind + '.png', Buffer.from(capture.base64, 'base64'));
    await writeFile(output + '/' + kind + '-capture.json', JSON.stringify(capture.metadata, null, 2));
    report.screenshots.push(output + '/' + kind + '.png');
    report.checks.push(kind + ': built and captured');
    if (publish) {
      const componentSource = JSON.parse(await readFile(dir + '/' + kind + '-component.json', 'utf8'));
      const name = kind === 'optical' ? 'Layered Optical Flare' : 'Webb Diffraction Star';
      const catalog = await call('library.list');
      const existing = catalog.find(row => row.name === name);
      if (existing) throw Error('Library entry already exists; read its revision before updating: ' + name);
      const published = await call('library.create', { name,
        description: kind === 'optical' ? 'Camera-axis chromatic ghosts, soft bloom, rounded aperture layers and a restrained optional streak. Transparent source with independent placement and tint.' : 'Six fine diffraction rays with optional faint horizontal pair, soft stellar core and independent rotation. Transparent source; suitable for sparse bright stars.',
        source: componentSource });
      await writeFile(dir + '/' + kind + '-published.json', JSON.stringify(published, null, 2));
      report.checks.push(kind + ': published ' + published.id + ' revision ' + published.revision);
      const saved = await call('read');
      await call('scene.save', { path: 'C:/Users/zFlei/.codex/visualizations/2026/09/17/01a0ae07-95ec-74b3-b286-97d2f2010459/' + name + '.lux-scene', expectedDraftVersion: saved.draftVersion, overwrite: true });
    }
  }
  report.ok = true;
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await app?.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app?.close().catch(() => {});
  await writeFile(output + '/result.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, ...report }));
}
