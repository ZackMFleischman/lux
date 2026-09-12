'use strict';
// Filesystem-only package contract. Never starts a producer or changes FFGL plugins.
// Electron's fs transparently mounts .asar archives, including in RUN_AS_NODE
// mode. Packages hash and copy physical distribution bytes, not archive members.
const fs = process.versions.electron ? require('original-fs') : require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readTransportRelease } = require(fs.existsSync(path.join(__dirname, 'transport-release.cjs')) ? './transport-release.cjs' : '../../../tools/gpu-spike/transport-release.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const encode = value => JSON.stringify(value, null, 2) + '\n';
const digest = value => hash(encode(value));
const idPattern = /^[a-f0-9]{64}$/;
const installer = '@echo off\r\nsetlocal\r\nset "ELECTRON_RUN_AS_NODE="\r\nstart "" "%~dp0runtime\\electron\\electron.exe" "%~dp0runtime\\install-gui.cjs" "%~dp0."\r\n';
const intensityControl = { id: 'intensity', type: 'number', label: 'Intensity', default: 0.5, min: 0, max: 1, changeCost: 'live' };
const nativeRuntimeFiles = ['msvcp140.dll', 'msvcp140_1.dll', 'msvcp140_2.dll', 'msvcp140_atomic_wait.dll', 'msvcp140_codecvt_ids.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'];
const electronRuntimeFiles = ['electron.exe', 'version', 'LICENSE', 'LICENSES.chromium.html', 'chrome_100_percent.pak', 'chrome_200_percent.pak',
  'd3dcompiler_47.dll', 'dxcompiler.dll', 'dxil.dll', 'ffmpeg.dll', 'icudtl.dat', 'resources.pak', 'snapshot_blob.bin', 'v8_context_snapshot.bin',
  'vk_swiftshader_icd.json', 'vk_swiftshader.dll', 'vulkan-1.dll', 'locales/en-US.pak', 'resources/default_app.asar'];
const requiredRuntimeFiles = [
  'electron/electron.exe', 'electron/version', 'install.cjs', 'package.cjs', 'register.cjs', 'runtime-capability.cjs', 'transport-release.cjs',
  'install-gui.cjs', 'install-flow.cjs',
  'apps/render-host/src/main.cjs', 'apps/render-host/src/compiled-output.html',
  'apps/render-host/src/compiled-worker.js', 'native/build/Release/lux_texture_bridge.node',
  'native/build/Release/LuxTracerTR02.dll', 'tools/gpu-spike/producer-session.cjs',
  'tools/gpu-spike/transport-release.cjs', 'tools/gpu-spike/host-startup.cjs', 'tools/gpu-spike/frame-progress.cjs',
  ...nativeRuntimeFiles.map(name => 'native/build/Release/' + name),
  ...electronRuntimeFiles.filter(name => !['electron.exe', 'version'].includes(name)).map(name => 'electron/' + name),
];
function safeRelative(value) {
  if (typeof value !== 'string' || value.length > 240 || !value.length || value.includes('\\')) throw Error('Unsafe package path');
  for (const part of value.split('/')) {
    if (!/^[A-Za-z0-9_.-]+$/.test(part) || part === '.' || part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)) throw Error('Unsafe package path: ' + value);
  }
  return value;
}
function assertId(id) { if (typeof id !== 'string' || !idPattern.test(id)) throw Error('Invalid release/runtime identity'); return id; }
function noLinks(filename) {
  filename = path.resolve(filename);
  let current = path.parse(filename).root;
  for (const part of filename.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw Error('Symbolic links/reparse points are not allowed: ' + current);
  }
  return filename;
}
function files(directory, prefix = '') {
  noLinks(directory);
  const result = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = safeRelative(prefix + item.name);
    if (item.isSymbolicLink()) throw Error('Symbolic links are not allowed');
    if (item.isDirectory()) result.push(...files(path.join(directory, item.name), relative + '/'));
    else if (item.isFile()) result.push(relative);
    else throw Error('Unsupported filesystem entry');
  }
  return result.sort();
}
function inventory(directory) {
  return files(directory).map(name => { const bytes = fs.readFileSync(path.join(directory, name)); return { path: name, bytes: bytes.length, sha256: hash(bytes) }; });
}
function readJson(filename) {
  noLinks(filename);
  if (fs.statSync(filename).size > 4 * 1024 * 1024) throw Error('Manifest exceeds limit');
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}
function validateRuntime(directory, expectedId) {
  const manifest = readJson(path.join(directory, 'runtime.json'));
  const { runtimeId, ...body } = manifest;
  if (body.format !== 'lux-runtime' || body.version !== 1 || body.platform !== 'win32-x64' || digest(body) !== assertId(runtimeId) || (expectedId && expectedId !== runtimeId)) throw Error('Runtime manifest identity mismatch');
  if (!/^\d+\.\d+\.\d+$/.test(body.electronVersion) || !Array.isArray(body.files) || body.files.length > 10000) throw Error('Invalid runtime manifest');
  const seen = new Set();
  for (const entry of body.files) {
    const name = safeRelative(entry.path), lower = name.toLowerCase();
    if (seen.has(lower) || lower === 'runtime.json' || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !idPattern.test(entry.sha256)) throw Error('Invalid runtime inventory');
    seen.add(lower);
    const filename = noLinks(path.join(directory, name));
    if (!fs.statSync(filename).isFile() || fs.statSync(filename).size !== entry.bytes || hash(fs.readFileSync(filename)) !== entry.sha256) throw Error('Runtime file hash mismatch: ' + name);
  }
  for (const name of requiredRuntimeFiles) if (!seen.has(name.toLowerCase())) throw Error('Missing runtime dependency: ' + name);
  if (files(directory).length !== seen.size + 1) throw Error('Unlisted runtime files');
  if (fs.readFileSync(path.join(directory, 'electron/version'), 'utf8').trim() !== body.electronVersion) throw Error('Electron version mismatch');
  return manifest;
}
function validateRelease(directory, expectedId) {
  const manifest = readJson(path.join(directory, 'release.json'));
  const { releaseId, ...body } = manifest;
  if (body.format !== 'lux-resolume-source' || body.version !== 1 || digest(body) !== assertId(releaseId) || (expectedId && expectedId !== releaseId)) throw Error('Release manifest identity mismatch');
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80 || /[\x00-\x1f]/.test(body.name)) throw Error('Invalid source name');
  assertId(body.runtimeId); assertId(body.transportHash);
  const intensity = body.savedControls?.intensity;
  if (JSON.stringify(body.controls) !== JSON.stringify([intensityControl]) || Object.keys(body.savedControls).join() !== 'intensity') throw Error('Unsupported control schema');
  if (typeof intensity !== 'number' || !Number.isFinite(intensity) || intensity < 0 || intensity > 1) throw Error('Invalid intensity');
  const visual = readTransportRelease(noLinks(path.join(directory, body.transportHash + '.json')));
  if (encode(visual.settings) !== encode(body.settings) || visual.sourceHash !== body.sourceHash || visual.linked.linkedHash !== body.linkedHash) throw Error('Release visual mismatch');
  if (files(directory).join('|') !== [body.transportHash + '.json', 'release.json'].sort().join('|')) throw Error('Unlisted release files');
  return manifest;
}
function validatePackage(directory) {
  noLinks(directory);
  if (fs.readdirSync(directory).sort().join('|') !== 'install.cmd|release|runtime') throw Error('Unexpected package contents');
  if (fs.readFileSync(noLinks(path.join(directory, 'install.cmd')), 'utf8') !== installer) throw Error('Installer bootstrap mismatch');
  const release = validateRelease(path.join(directory, 'release'));
  const runtime = validateRuntime(path.join(directory, 'runtime'), release.runtimeId);
  return { release, runtime };
}
function copyTree(source, destination) {
  const relative = path.relative(path.resolve(source), path.resolve(destination));
  if (relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep))) throw Error('Copy destination must be outside the source tree');
  const names = files(source);
  fs.mkdirSync(destination, { recursive: true });
  for (const name of names) {
    const target = path.join(destination, name);
    noLinks(target); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(noLinks(path.join(source, name)), target, fs.constants.COPYFILE_EXCL);
  }
}
function removeStage(parent, stage) {
  parent = noLinks(parent); stage = noLinks(stage);
  if (path.dirname(stage) !== parent || !/^\.(export|runtime|install)-[A-Za-z0-9]+$/.test(path.basename(stage))) throw Error('Refusing unsafe stage cleanup');
  files(stage); // Reject redirected descendants before recursive removal.
  fs.rmSync(stage, { recursive: true });
}
function createPackage({ name, transportPath, runtimeDirectory, electronVersion, outputDirectory, intensity = 0.5 }) {
  noLinks(outputDirectory); noLinks(runtimeDirectory); noLinks(transportPath);
  const relative = path.relative(path.resolve(runtimeDirectory), path.resolve(outputDirectory));
  if (relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep))) throw Error('Export output must be outside the runtime input tree');
  const visual = readTransportRelease(transportPath);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const stage = fs.mkdtempSync(path.join(outputDirectory, '.export-'));
  // Failed stages are retained for diagnosis, never replace a published package.
  copyTree(runtimeDirectory, path.join(stage, 'runtime'));
  const body = { format: 'lux-runtime', version: 1, platform: 'win32-x64', electronVersion, files: inventory(path.join(stage, 'runtime')) };
  const runtimeId = digest(body);
  fs.writeFileSync(path.join(stage, 'runtime/runtime.json'), encode({ ...body, runtimeId }), { flag: 'wx' });
  const transportHash = hash(fs.readFileSync(transportPath));
  const source = { format: 'lux-resolume-source', version: 1, name, runtimeId, transportHash,
    sourceHash: visual.sourceHash, linkedHash: visual.linked.linkedHash, settings: visual.settings,
    controls: [intensityControl], savedControls: { intensity } };
  const releaseId = digest(source);
  fs.mkdirSync(path.join(stage, 'release'));
  fs.copyFileSync(transportPath, path.join(stage, 'release', transportHash + '.json'));
  fs.writeFileSync(path.join(stage, 'release/release.json'), encode({ ...source, releaseId }), { flag: 'wx' });
  fs.writeFileSync(path.join(stage, 'install.cmd'), installer, { flag: 'wx' });
  validatePackage(stage);
  const destination = path.join(outputDirectory, releaseId);
  if (fs.existsSync(destination)) { validatePackage(destination); removeStage(outputDirectory, stage); }
  else fs.renameSync(stage, destination);
  return { path: destination, releaseId, runtimeId };
}
function publishTree(source, parent, id, validator) {
  const destination = noLinks(path.join(parent, assertId(id)));
  if (fs.existsSync(destination)) { validator(destination, id); return destination; }
  const stage = fs.mkdtempSync(path.join(parent, '.install-'));
  copyTree(source, stage); validator(stage, id);
  try { fs.renameSync(stage, destination); }
  catch (error) { if (!fs.existsSync(destination)) throw error; validator(destination, id); removeStage(parent, stage); }
  return destination;
}
function installPackage(packageDirectory, installRoot) {
  const { release, runtime } = validatePackage(packageDirectory);
  installRoot = noLinks(installRoot);
  const relative = path.relative(path.resolve(packageDirectory), installRoot);
  if (relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep))) throw Error('Installation root must be outside the export package');
  for (const name of ['runtimes', 'releases', 'retired', 'instances']) fs.mkdirSync(noLinks(path.join(installRoot, name)), { recursive: true });
  const runtimePath = publishTree(path.join(packageDirectory, 'runtime'), path.join(installRoot, 'runtimes'), runtime.runtimeId, validateRuntime);
  const releasePath = publishTree(path.join(packageDirectory, 'release'), path.join(installRoot, 'releases'), release.releaseId, validateRelease);
  return { releaseId: release.releaseId, runtimeId: runtime.runtimeId, releasePath, runtimePath, playbackReady: false };
}
function retireRelease(installRoot, releaseId) {
  installRoot = noLinks(installRoot); assertId(releaseId);
  const source = noLinks(path.join(installRoot, 'releases', releaseId));
  validateRelease(source, releaseId);
  const retired = noLinks(path.join(installRoot, 'retired'));
  fs.mkdirSync(retired, { recursive: true });
  const destination = path.join(retired, releaseId + '-' + crypto.randomUUID());
  // Retain bytes and shared runtime, including for already attached consumers.
  fs.renameSync(source, destination);
  return { releaseId, retiredPath: destination, runtimeRetained: true };
}
module.exports = { createPackage, validatePackage, validateRelease, validateRuntime, installPackage, retireRelease, safeRelative, noLinks, copyTree, removeStage, requiredRuntimeFiles, nativeRuntimeFiles };
