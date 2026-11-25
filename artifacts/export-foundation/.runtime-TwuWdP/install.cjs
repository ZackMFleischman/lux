'use strict';
const path = require('node:path');
const { installPackage, retireRelease } = require('./package.cjs');
try {
  const [packageDirectory, destination, releaseToRetire] = process.argv.slice(2);
  if (!packageDirectory) throw Error('Usage: install.cmd [install-directory] [release-id-to-retire]');
  const root = destination || (process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Lux', 'Installed'));
  if (!root) throw Error('Choose an installation directory');
  const result = releaseToRetire ? retireRelease(root, releaseToRetire) : installPackage(packageDirectory, root);
  console.log(JSON.stringify(result, null, 2));
  console.log('Package storage complete. Resolume source registration and automatic startup are not implemented in this foundation.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
