'use strict';
const path = require('node:path');
const {promisify} = require('node:util');
const {execFile} = require('node:child_process');
async function queryResolumeProcesses({run = promisify(execFile), systemRoot = process.env.SystemRoot || 'C:\\Windows'} = {}) {
  let result;
  try {
    result = await run(path.win32.join(systemRoot, 'System32', 'tasklist.exe'), ['/FO', 'CSV', '/NH'],
      {windowsHide:true,timeout:5000,maxBuffer:4 * 1024 * 1024,encoding:'utf8'});
  } catch { throw Error('Could not verify whether Resolume is closed. Close Resolume and retry the installer.'); }
  const rows = [...String(result.stdout || '').matchAll(/^"([^"\r\n]+)","(\d+)"/gm)];
  if (!rows.length || String(result.stderr || '').trim()) throw Error('Could not verify whether Resolume is closed. Close Resolume and retry the installer.');
  return [...new Set(rows.map(row => row[1]).filter(name => /^(avenue|arena)\.exe$/i.test(name)))];
}
async function assertHostClosed(ports) {
  const hosts = await ports.queryHosts();
  if (!Array.isArray(hosts)) throw Error('Could not verify whether Resolume is closed. Retry the installer.');
  if (hosts.length) throw Error('Close Resolume (' + hosts.join(', ') + ') before installing this source, then run the installer again.');
}
async function runInstallFlow({packageDirectory, localAppData, ports}) {
  if (!packageDirectory || !localAppData) throw Error('The package location or Windows local application-data folder is unavailable.');
  const installRoot = path.resolve(localAppData, 'Lux', 'Installed');
  const {release} = await ports.validate(packageDirectory);
  const details = {name:release.name,releaseId:release.releaseId,installRoot};
  if (!await ports.welcome(details)) return {cancelled:true};
  const pluginDirectory = await ports.chooseFolder(details);
  if (!pluginDirectory) return {cancelled:true};
  if (!await ports.confirm({...details,pluginDirectory})) return {cancelled:true};
  await assertHostClosed(ports);
  const installed = await ports.install(packageDirectory, installRoot);
  // Installation can take time. A source DLL is not published if the user has
  // opened Resolume since the first check. Immutable package storage is retained.
  await assertHostClosed(ports);
  const registration = await ports.register({installRoot,releaseId:release.releaseId,pluginDirectory});
  return {cancelled:false,...details,installed,registration};
}
module.exports = {runInstallFlow,queryResolumeProcesses};
