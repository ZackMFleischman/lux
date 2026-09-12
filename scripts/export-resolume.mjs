import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { prepareTransportScene } from './transport-prepare.mjs';
import { SceneFileStore } from '../packages/core/src/scene-file.ts';
import packageIO from '../packages/export/src/package.cjs';
import registration from '../packages/export/src/register.cjs';
import runtimeCapability from '../packages/export/src/runtime-capability.cjs';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Authoring-only entry point. Runtime consumers use the pinned package bytes. */
export async function exportResolume({ scenePath, name, outputDirectory, root = defaultRoot, preparedPath, intensity = 0.5,
  nativeRuntimeDirectory = path.join(process.env.SystemRoot || 'C:/Windows', 'System32') }) {
  if (typeof name !== 'string' || !name.trim() || name.length > 80 || /[\x00-\x1f]/.test(name)) throw Error('A source name of 1–80 characters without control characters is required');
  outputDirectory = path.resolve(outputDirectory || path.join(root, 'artifacts/exports'));
  packageIO.noLinks(outputDirectory);
  fs.mkdirSync(outputDirectory, { recursive: true });
  if (!preparedPath) intensity = (await new SceneFileStore().open(scenePath)).document.controls.intensity;
  // Invalid drafts and stale native payloads fail before copying the pinned runtime.
  const transportPath = preparedPath || (await prepareTransportScene(scenePath, path.join(outputDirectory, '.prepared'))).path;
  runtimeCapability.assertRuntimeCapabilities(root);
  const staging = fs.mkdtempSync(path.join(outputDirectory, '.runtime-'));
  try {
    // Resolve the dependency manager junction once, then copy regular runtime files.
    const electronRoot = fs.realpathSync(path.join(root, 'node_modules/electron'));
    const electronVersion = JSON.parse(fs.readFileSync(path.join(electronRoot, 'package.json'), 'utf8')).version;
    packageIO.copyTree(path.join(electronRoot, 'dist'), path.join(staging, 'electron'));
    for (const relative of packageIO.requiredRuntimeFiles.filter(value => !value.startsWith('electron/'))) {
      const source = ['package.cjs', 'install.cjs', 'install-gui.cjs', 'install-flow.cjs', 'register.cjs', 'runtime-capability.cjs'].includes(relative)
        ? path.join(root, 'packages/export/src', relative)
        : relative === 'transport-release.cjs' ? path.join(root, 'tools/gpu-spike', relative)
        : packageIO.nativeRuntimeFiles.includes(path.basename(relative)) ? path.join(nativeRuntimeDirectory, path.basename(relative)) : path.join(root, relative);
      packageIO.noLinks(source);
      const destination = path.join(staging, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    }
    const installedModules = registration.supervisorFiles.filter(name => fs.existsSync(path.join(root, name)));
    if (installedModules.length && installedModules.length !== registration.supervisorFiles.length) throw Error('Installed supervisor payload is incomplete');
    for (const relative of installedModules) {
      const source = packageIO.noLinks(path.join(root, relative)), destination = path.join(staging, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    }
    return packageIO.createPackage({ name: name.trim(), transportPath, runtimeDirectory: staging, electronVersion, outputDirectory, intensity });
  } finally { packageIO.removeStage(outputDirectory, staging); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [scenePath, name, outputDirectory] = process.argv.slice(2);
  exportResolume({ scenePath, name, outputDirectory }).then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
