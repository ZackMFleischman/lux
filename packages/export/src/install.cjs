'use strict';
const path = require('node:path');
const { installPackage, retireRelease } = require('./package.cjs');
const { registerSource } = require('./register.cjs');
try {
  const [packageDirectory, destination, action, pluginDirectory] = process.argv.slice(2);
  if (!packageDirectory) throw Error('Usage: install.cmd [install-directory] [release-id-to-retire]');
  const root = destination || (process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Lux', 'Installed'));
  if (!root) throw Error('Choose an installation directory');
  const result = action && action !== '--register' ? retireRelease(root, action) : installPackage(packageDirectory, root);
  if (action === '--register') {
    if (!pluginDirectory) throw Error('Registration requires a Resolume Extra Effects directory');
    result.registration = registerSource({ installRoot: root, releaseId: result.releaseId, pluginDirectory });
  }
  console.log(JSON.stringify(result, null, 2));
  console.log('Package storage complete. Installed playback requires the descriptor-aware native build and host acceptance.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
