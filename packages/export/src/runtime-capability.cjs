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
function assertRuntimeCapabilities(root) {
  for (const [relative, marker] of Object.entries(capabilities)) {
    const filename = path.join(root, relative);
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile() || fs.statSync(filename).size > 32 * 1024 * 1024 || !fs.readFileSync(filename).includes(Buffer.from(marker)))
      throw Error('Rebuild the installed runtime before export/registration: ' + relative + ' lacks ' + marker);
  }
  for (const name of ['supervisor', 'registry', 'instance']) {
    const filename = path.join(root, 'apps/installed-runtime/src', name + '.cjs');
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) throw Error('Rebuild the installed runtime: missing ' + name);
  }
}
module.exports = {assertRuntimeCapabilities, capabilities};
