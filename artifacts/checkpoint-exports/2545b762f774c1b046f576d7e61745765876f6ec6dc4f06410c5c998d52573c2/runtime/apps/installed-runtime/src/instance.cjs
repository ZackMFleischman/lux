'use strict';
// The supervisor starts this pinned entrypoint suspended, assigns a kill-on-close
// Job, then resumes it. No authoring application, compiler or checkout is used.
const fs = require('node:fs'), path = require('node:path');
const {validateRequest, sameInstalledPath} = require('./registry.cjs');
const runtimeDirectory = path.resolve(__dirname, '../../..');
const runtimeId = path.basename(runtimeDirectory), root = path.resolve(runtimeDirectory, '../..');
const {validateRelease, noLinks} = require(path.join(runtimeDirectory, 'package.cjs'));
const requestPath = noLinks(path.resolve(process.argv[2] || ''));
if (fs.statSync(requestPath).size > 512) throw Error('Installed request exceeds limit');
const request = validateRequest(JSON.parse(fs.readFileSync(requestPath, 'utf8')), runtimeId);
const directory = path.join(root, 'instances', runtimeId);
const attemptId = path.basename(requestPath, '.json');
if (!/^[a-f0-9]{32}$/.test(attemptId) || !sameInstalledPath(requestPath, path.join(directory, request.instanceId + '.attempts', attemptId + '.json'))) throw Error('Installed instance path mismatch');
const release = validateRelease(path.join(root, 'releases', request.releaseId), request.releaseId);
if (release.runtimeId !== runtimeId) throw Error('Installed release runtime mismatch');
if(release.version===2){
 const {sourceIdentity}=require(path.join(runtimeDirectory,'register.cjs'));
 const digest=require('node:crypto').createHash('sha256').update(sourceIdentity(release).sidecar).digest('hex');
 if(request.version!==2||request.descriptorHash!==digest)throw Error('Installed native parameter descriptor mismatch');
}else if(request.version!==1)throw Error('Installed legacy descriptor version mismatch');
globalThis.luxInstalledContext = {
  protocol:'lux-installed-render-host-v2',
  requestPath:path.join(directory, request.instanceId + '.json'), hostPid:request.hostPid, supervisorReady:path.join(directory, 'supervisor.ready'),
  attemptId, healthPath:path.join(path.dirname(requestPath), attemptId + '.status'),
  rendezvous:path.join(directory, request.instanceId + '.rendezvous'),
};
process.env.LUX_TRANSPORT_BUNDLE = path.join(root, 'releases', request.releaseId, release.transportHash + '.json');
process.env.LUX_TRANSPORT_PLAYBACK = '1';
process.env.LUX_TRANSPORT_STOP = path.join(directory, request.instanceId + '.stop');
process.env.LUX_GPU_OUTPUT = path.join(directory, request.instanceId, attemptId);
delete process.env.LUX_RESOLUME_PID;
require(path.join(runtimeDirectory, 'apps/render-host/src/main.cjs'));
