'use strict';
const fs = require('node:fs'), path = require('node:path');
// Build-format markers prevent accidentally packaging the pre-installed probe
// or an old emitted main. They are not a signature or a security trust boundary;
// the package inventory hashes the complete bytes independently.
const capabilities = Object.freeze({
  'native/build/Release/LuxTracerTR02.dll': 'lux-installed-source-protocol-v1',
  'native/build/Release/lux_texture_bridge.node': 'lux-installed-producer-protocol-v1',
  'apps/render-host/src/main.cjs': 'lux-installed-render-host-v2',
});
const parameterCapabilities=Object.freeze({
 'native/build/Release/LuxTracerTR02.dll':'lux-installed-source-protocol-v2-ring-v4',
 'native/build/Release/lux_texture_bridge.node':'lux-installed-producer-protocol-v2-ring-v4',
 'apps/render-host/src/main.cjs':'lux-parameter-render-host-v1',
});
const workerLivenessCapabilities=Object.freeze({
 'apps/render-host/src/main.cjs':'lux-main-worker-liveness-v2',
 'apps/render-host/src/compiled-worker.js':'lux-worker-liveness-v2',
 'apps/render-host/src/compiled-output.html':'lux-relay-worker-liveness-v2',
});
function assertMarkers(root,markers) {
  for (const [relative, marker] of Object.entries(markers)) {
    const filename = path.join(root, relative);
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile() || fs.statSync(filename).size > 32 * 1024 * 1024 || !fs.readFileSync(filename).includes(Buffer.from(marker)))
      throw Error('Rebuild the installed runtime before export/registration: ' + relative + ' lacks ' + marker);
  }
}
// Current export guard only: previously immutable packages retain their pinned
// protocol and continue to validate/register against the original capabilities.
function assertWorkerLivenessCapabilities(root){assertMarkers(root,workerLivenessCapabilities);}
function assertRuntimeCapabilities(root,{parameters=false,workerLiveness=false}={}) {
  assertMarkers(root,parameters?parameterCapabilities:capabilities);
  if(workerLiveness)assertWorkerLivenessCapabilities(root);
  for (const name of ['supervisor', 'registry', 'instance']) {
    const filename = path.join(root, 'apps/installed-runtime/src', name + '.cjs');
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) throw Error('Rebuild the installed runtime: missing ' + name);
  }
}
module.exports = {assertRuntimeCapabilities,assertWorkerLivenessCapabilities, capabilities,parameterCapabilities,workerLivenessCapabilities};
