const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function readTransportRelease(filename) {
  const stat = fs.statSync(filename);
  if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw Error('Invalid transport release size');
  const bytes = fs.readFileSync(filename);
  if (path.basename(filename) !== hash(bytes) + '.json') throw Error('Transport release content hash mismatch');
  const release = JSON.parse(bytes);
  const { linked, settings } = release;
  if (release.format !== 'lux-transport' || release.version !== 1 || !/^[a-f0-9]{64}$/.test(release.sourceHash) ||
      settings?.width !== 1920 || settings.height !== 1080 || settings.fps !== 60 ||
      !Number.isInteger(settings.seed) || settings.seed < 0 || settings.seed > 0xffffffff ||
      typeof linked?.code !== 'string' || typeof linked.sourceMap !== 'string' ||
      !/^[a-f0-9]{64}$/.test(linked.bundleHash)) throw Error('Invalid transport release');
  const body = { code: linked.code, sourceMap: linked.sourceMap, bundleHash: linked.bundleHash, linker: linked.linker };
  if (hash(JSON.stringify(body)) !== linked.linkedHash) throw Error('Linked module hash mismatch');
  return release;
}
module.exports = { readTransportRelease, hash };
