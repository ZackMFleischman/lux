import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const inventoryPaths = {
  sources: [
    'package.json', 'pnpm-lock.yaml', 'native/CMakeLists.txt',
    'scripts/native-build.ps1', 'scripts/test-gpu.ps1', 'scripts/prepare-gpu-review.mjs',
    'scripts/experiment-runner.mjs', 'scripts/experiment-job.ps1', 'scripts/experiment-job.cs',
    'scripts/gpu-experiment.mjs', 'scripts/gpu-evidence.mjs',
    'tools/gpu-spike/build.mjs', 'tools/gpu-spike/standalone_host.cc',
    'tools/gpu-spike/producer-session.cjs', 'tools/gpu-spike/recorder.cjs',
    'apps/render-host/src/main.ts', 'apps/render-host/src/main.cjs',
    'apps/render-host/src/visual-worker.js', 'apps/render-host/src/output.html',
    'node_modules/electron/package.json', 'node_modules/electron/index.js',
    'node_modules/electron/dist/version', 'node_modules/three/package.json',
    'node_modules/three/build/three.webgpu.js', 'node_modules/three/build/three.core.js',
  ],
  binaries: [
    'native/build/Release/LuxTracerTR02.dll',
    'native/build/Release/lux_texture_bridge.node',
    'native/build/Release/lux_standalone_host.exe',
    'node_modules/electron/dist/electron.exe',
    'native/vendor/node/node.lib',
  ],
};
const sourceTrees = ['native/ffgl-source/src', 'native/texture-bridge/include', 'native/texture-bridge/src', 'native/vendor/ffgl/source/lib', 'native/vendor/node/node-v24.20.0/include/node'];
async function digest(path) {
  try {
    const info = await stat(path);
    if (!info.isFile()) throw Error('not a file');
    const hash = createHash('sha256');
    for await (const bytes of createReadStream(path)) hash.update(bytes);
    return { path: resolve(path), sha256: hash.digest('hex'), bytes: info.size, modifiedUtc: info.mtime.toISOString() };
  } catch (error) { throw Error(`Missing required inventory or unreadable file: ${path}: ${error.message}`); }
}
async function collectSources(folder) {
  let entries;
  try { entries = await readdir(folder, { withFileTypes: true }); }
  catch (error) { throw Error(`Missing required inventory source directory: ${folder}: ${error.message}`); }
  const result = [];
  for (const entry of entries) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) result.push(...await collectSources(path));
    else if (/\.(h|hpp|hxx|c|cc|cpp|cxx|inl)$/i.test(entry.name)) result.push(path);
  }
  return result;
}

export async function prepareGpuReview({ root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), output, buildAttribution } = {}) {
  if (!output) throw Error('An output request.json path is required; this command never launches hardware');
  root = resolve(root); output = resolve(output);
  const git = args => execFileSync('git', ['-c', `safe.directory=${root}`, '-C', root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
  const commit = git(['rev-parse', 'HEAD']);
  const status = git(['status', '--porcelain=v1', '--untracked-files=normal']);
  const sourceFiles = inventoryPaths.sources.map(path => join(root, path));
  for (const tree of sourceTrees) {
    const found = await collectSources(join(root, tree));
    if (!found.length) throw Error(`Missing required inventory source files: ${tree}`);
    sourceFiles.push(...found);
  }
  const sources = [];
  for (const path of [...new Set(sourceFiles)].sort()) sources.push(await digest(path));
  const binaries = [];
  for (const path of [...inventoryPaths.binaries.map(path => join(root, path)), process.execPath]) binaries.push(await digest(path));
  const dependencyVersions = {};
  for (const name of ['electron', 'three']) dependencyVersions[name] = JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
  const request = {
    schema: 1, preparedUtc: new Date().toISOString(), authorized: false, reviewer: null,
    hypothesis: 'One exclusive 5-second producer / 10-second receiver diagnostic within a 20-second supervised process budget',
    hostClosedConfirmed: false, expiresUtc: null,
    executable: process.execPath, args: [join(root, 'scripts/gpu-experiment.mjs')],
    sources, binaries, sourceState: { root, commit, dirty: status.length > 0, status },
    dependencies: { ...dependencyVersions, node: process.version, platform: process.platform, architecture: process.arch },
    buildAttribution: buildAttribution
      ? { status: 'supplied-unverified', file: await digest(buildAttribution), record: JSON.parse(await readFile(buildAttribution, 'utf8')) }
      : { status: 'unverified', reason: 'No build attribution record supplied; hashes and mtimes do not establish which source produced a binary.' },
    generatedMapping: [{ source: join(root, 'apps/render-host/src/main.ts'), output: join(root, 'apps/render-host/src/main.cjs'), generator: join(root, 'tools/gpu-spike/build.mjs'), verified: false }],
    limits: [
      'This is a review request, not permission to execute; reviewers must establish source/build attribution and incident gates before authorizing.',
      'Inventory snapshots exact listed files; it does not prove reproducible builds, immutable files during launch, or absence of additional dynamic loads.',
      'Dependency inventory includes lockfile, package metadata, Electron executable/entry and Three WebGPU/core bytes; it does not recursively hash node_modules, Electron resources, Windows DLLs or graphics drivers.',
      'Native source/header trees and node.lib are hashed; compiler/SDK binaries and toolchain environment are not inventoried. Supply build commands, toolchain versions, source checkpoint, output hashes and validation logs in build attribution.',
      'Process deadlines cannot recover a whole-system GPU or driver freeze.',
    ],
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(request, null, 2) + '\n', { flag: 'wx' });
  return request;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [output, buildAttribution] = process.argv.slice(2);
  prepareGpuReview({ output, buildAttribution }).then(request => console.log(`Unauthorized review request written to ${resolve(output)} (${request.sources.length} source/dependency files, ${request.binaries.length} binaries). No hardware launched.`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
