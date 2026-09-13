'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { noLinks, validateRelease, validateRuntime } = require('./package.cjs');
const { assertRuntimeCapabilities } = require('./runtime-capability.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const protocol = 'lux-installed-source-v1';
const supervisorFiles = ['apps/installed-runtime/src/supervisor.cjs', 'apps/installed-runtime/src/registry.cjs', 'apps/installed-runtime/src/instance.cjs'];
function sourceIdentity(release) {
  if (!/^[a-f0-9]{64}$/.test(release.releaseId) || !/^[a-f0-9]{64}$/.test(release.runtimeId)) throw Error('Invalid source identity');
  const pluginId = (Number.parseInt(hash(release.releaseId).slice(0, 8), 16) % (36 ** 4)).toString(36).toUpperCase().padStart(4, '0');
  const displayName = release.name.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').trim().slice(0, 16) || 'Lux Source';
  if(release.version===2){
    const {parameterMapping}=require(fs.existsSync(path.join(__dirname,'parameter-mapping.cjs'))?'./parameter-mapping.cjs':'../../../tools/gpu-spike/parameter-mapping.cjs');
    const mapping=parameterMapping(release.controls,release.savedControls,release.controlSchemaHash);
    const sidecar=['lux-installed-source-v2',release.releaseId,release.runtimeId,pluginId,displayName,release.controlSchemaHash,String(mapping.length),
      ...mapping.map(row=>[row.id,row.hostLabel,String(row.initial)].join('\t')),''].join('\n');
    if(Buffer.byteLength(sidecar)>8192)throw Error('Installed descriptor exceeds limit');
    return {pluginId,displayName,sidecar};
  }
  return { pluginId, displayName, sidecar: [protocol, release.releaseId, release.runtimeId, pluginId, displayName, ''].join('\n') };
}
/** Explicit trusted registration step; never called by package installation automatically. */
function registerSource({ installRoot, releaseId, pluginDirectory }) {
  if (!/^[a-f0-9]{64}$/.test(releaseId)) throw Error('Invalid release identity');
  installRoot = noLinks(installRoot); pluginDirectory = noLinks(pluginDirectory);
  const expectedRoot = process.env.LOCALAPPDATA && path.resolve(process.env.LOCALAPPDATA, 'Lux', 'Installed');
  const comparable = value => process.platform === 'win32' ? value.toLowerCase() : value;
  if (!expectedRoot || comparable(installRoot) !== comparable(expectedRoot)) throw Error('Source registration requires the standard installed runtime location: %LOCALAPPDATA%/Lux/Installed');
  const release = validateRelease(path.join(installRoot, 'releases', releaseId), releaseId);
  const runtimePath = path.join(installRoot, 'runtimes', release.runtimeId);
  const runtime = validateRuntime(runtimePath, release.runtimeId);
  for (const name of supervisorFiles) if (!runtime.files.some(file => file.path === name)) throw Error('Installed supervisor is not packaged: ' + name);
  assertRuntimeCapabilities(runtimePath,{parameters:release.version===2});
  const identity = sourceIdentity(release);
  const dllName = 'Lux_' + releaseId + '.dll', dllPath = noLinks(path.join(pluginDirectory, dllName));
  const sidecarPath = noLinks(dllPath + '.lux-source');
  const sourceDll = path.join(runtimePath, 'native/build/Release/LuxTracerTR02.dll');
  const dllBytes = fs.readFileSync(sourceDll), dllHash = hash(dllBytes);
  fs.mkdirSync(pluginDirectory, { recursive: true });
  const entries = fs.readdirSync(pluginDirectory);
  if (entries.length > 10000) throw Error('Plugin directory exceeds registration scan limit');
  for (const entry of entries.filter(name => /^Lux_[a-f0-9]{64}\.dll\.lux-source$/i.test(name))) {
    const filename = noLinks(path.join(pluginDirectory, entry));
    if (fs.statSync(filename).size > 8192) throw Error('Invalid installed Lux source descriptor');
    const lines = fs.readFileSync(filename, 'utf8').split('\n');
    if (![protocol,'lux-installed-source-v2'].includes(lines[0]) || (lines[0]===protocol&&(lines.length!==6||fs.statSync(filename).size>512)) || !/^[a-f0-9]{64}$/.test(lines[1]) || !/^[a-f0-9]{64}$/.test(lines[2]) || !/^[A-Z0-9]{4}$/.test(lines[3])) throw Error('Invalid installed Lux source descriptor');
    if(lines[0]==='lux-installed-source-v2'&&(!/^[a-f0-9]{64}$/.test(lines[5])||!/^(0|[1-9]|[12][0-9]|3[0-2])$/.test(lines[6])||lines.length!==8+Number(lines[6])))throw Error('Invalid installed parameter descriptor');
    if (lines[3] === identity.pluginId && lines[1] !== releaseId) throw Error('FFGL identity collision; keep the existing source and choose a different exported name');
  }
  if (fs.existsSync(dllPath)) {
    if (hash(fs.readFileSync(dllPath)) !== dllHash || !fs.existsSync(sidecarPath) || fs.readFileSync(sidecarPath, 'utf8') !== identity.sidecar) throw Error('Installed source differs; refusing replacement');
    return { releaseId, dllPath, sidecarPath, ...identity, alreadyRegistered: true };
  }
  if (fs.existsSync(sidecarPath) && fs.readFileSync(sidecarPath, 'utf8') !== identity.sidecar) throw Error('Existing source descriptor differs; refusing replacement');
  const stagedDll = noLinks(path.join(pluginDirectory, '.lux-register-' + crypto.randomUUID() + '.tmp'));
  fs.writeFileSync(stagedDll, dllBytes, { flag: 'wx' });
  if (hash(fs.readFileSync(stagedDll)) !== dllHash) throw Error('Staged source DLL hash mismatch');
  // Publish metadata first. FFGL discovery cannot see a new DLL without its binding.
  if (!fs.existsSync(sidecarPath)) fs.writeFileSync(sidecarPath, identity.sidecar, { flag: 'wx' });
  // Hard-link creation is exclusive on Windows; unlike rename it cannot replace
  // a concurrently registered DLL. The temporary file is always in this folder.
  try { fs.linkSync(stagedDll, dllPath); }
  catch (error) {
    if (error.code !== 'EEXIST' || hash(fs.readFileSync(dllPath)) !== dllHash) throw error;
  }
  fs.unlinkSync(stagedDll);
  return { releaseId, dllPath, sidecarPath, ...identity, alreadyRegistered: false };
}
module.exports = { registerSource, sourceIdentity, supervisorFiles };
