// Fixed trusted CPU linker. Generated modules are parsed and bundled, never run.
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join, resolve, relative, isAbsolute, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertResultBudgets } from './result-budget.mjs';
import { violation, limits } from './source-policy.mjs';
import { verifyArtifact, linkedBody } from './artifact-identity.mjs';
import { readBoundedJson } from './bounded-json.mjs';
import { sdkSourceFile } from './sdk-selection.mjs';
import { assetDependencyPaths } from './asset-dependencies.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw violation(message); };
async function link() {
  const { artifact:raw, dependencyRoot } = await readBoundedJson(process.argv[2],limits.requestBytes);
  assertResultBudgets({ ok: true, artifact:raw, diagnostics: [] });
  const artifact=await verifyArtifact(raw,hash);
  const selectedSdk = sdkSourceFile(artifact.sdkVersion);
  if (artifact.compilerVersion !== '7.0.2') fail('Unsupported compiler identity');
  const moduleKeys = Object.keys(artifact.modules), folded = new Set();
  for (const key of moduleKeys) {
    if (key.length > 240 || !/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.js$/.test(key) || folded.has(key.toLowerCase()) || typeof artifact.modules[key] !== 'string') fail('Invalid virtual module path');
    folded.add(key.toLowerCase());
  }
  if (!Object.hasOwn(artifact.modules, artifact.entry) || !Object.hasOwn(artifact.modules, '__lux/sdk.js')) fail('Missing entry or emitted SDK module');
  if (artifact.artifactVersion===3 && !Object.hasOwn(artifact.modules, '__lux/parameters.js')) fail('Missing SDK parameter policy module');
  const { default: getExePath } = await import(pathToFileURL(join(dependencyRoot, 'typescript/lib/getExePath.js')).href);
  const known = {
    ...await assetDependencyPaths(root),
    'typescript/package.json': join(dependencyRoot, 'typescript/package.json'),
    '@babel/parser/package.json': join(dependencyRoot, '@babel/parser/package.json'),
    'three/package.json': join(dependencyRoot, 'three/package.json'),
    '@types/three/package.json': join(dependencyRoot, '@types/three/package.json'),
    'compiler/worker.mjs': join(root, 'apps/build-worker/src/worker.mjs'),
    'compiler/source-policy.mjs': join(root, 'apps/build-worker/src/source-policy.mjs'),
    'compiler/result-budget.mjs': join(root, 'apps/build-worker/src/result-budget.mjs'),
    'compiler/artifact-identity.mjs': join(root, 'apps/build-worker/src/artifact-identity.mjs'),
    'compiler/bounded-json.mjs': join(root, 'apps/build-worker/src/bounded-json.mjs'),
    'compiler/sdk-selection.mjs': join(root, 'apps/build-worker/src/sdk-selection.mjs'),
    'compiler/parameter-declarations.mjs': join(root, 'apps/build-worker/src/parameter-declarations.mjs'),
    'contracts/parameters.mjs': join(root, 'packages/runtime-contracts/src/parameters.mjs'),
    'contracts/parameters.d.mts': join(root, 'packages/runtime-contracts/src/parameters.d.mts'),
    'assets/index.mjs': join(root, 'packages/assets/src/index.mjs'),
    'node/executable': process.execPath, [`sdk/${selectedSdk}`]: join(root, 'packages/visual-sdk/src', selectedSdk),
    'sdk/metadata.mjs': join(root, 'packages/visual-sdk/src/metadata.mjs'),
    'contracts/index.ts': join(root, 'packages/runtime-contracts/src/index.ts'),
    'typescript/compiler': getExePath(),
    '@babel/parser/index.js': join(dependencyRoot, '@babel/parser/lib/index.js'),
    'three/webgpu': join(dependencyRoot, 'three/build/three.webgpu.js'),
    'three/tsl': join(dependencyRoot, 'three/build/three.tsl.js'),
    'three/core': join(dependencyRoot, 'three/build/three.core.js'),
  };
  for (const key of Object.keys(known)) if (!Object.hasOwn(artifact.dependencyHashes, key)) fail(`Missing required dependency identity: ${key}`);
  const realRoot = await realpath(dependencyRoot), snapshots = new Map();
  for (const [key, expected] of Object.entries(artifact.dependencyHashes)) {
    let path = known[key];
    if (!path) {
      if (!key.startsWith('declarations/')) fail('Unknown dependency identity');
      const suffix = key.slice('declarations/'.length);
      if (!suffix || suffix.includes('\\') || suffix.includes(':') || suffix.startsWith('/') || posix.normalize(suffix) !== suffix || suffix.startsWith('../')) fail('Unsafe dependency path');
      path = resolve(dependencyRoot, suffix);
      const inside = relative(realRoot, await realpath(path));
      if (inside.startsWith('..') || isAbsolute(inside)) fail('Dependency path escapes pinned root');
    }
    const bytes = await readFile(path);
    if (hash(bytes) !== expected) fail(`Dependency hash mismatch: ${key}`);
    if (['three/webgpu', 'three/tsl', 'three/core'].includes(key)) snapshots.set(key, bytes.toString('utf8'));
  }
  const esbuildPackage = JSON.parse(await readFile(join(dependencyRoot, 'esbuild/package.json'), 'utf8'));
  if (esbuildPackage.version !== '0.28.2') fail('Install pinned esbuild 0.28.2');
  const esbuildEntry = join(dependencyRoot, 'esbuild/lib/main.js');
  const esbuildBinary = createRequire(await realpath(join(dependencyRoot, 'esbuild/package.json'))).resolve('@esbuild/win32-x64/esbuild.exe');
  const linker = { version: '0.28.2', implementationHash: hash(await readFile(fileURLToPath(import.meta.url))),
    apiHash: hash(await readFile(esbuildEntry)), binaryHash: hash(await readFile(esbuildBinary)) };
  const { parse } = await import(pathToFileURL(known['@babel/parser/index.js']).href);
  const virtual = new Map([
    ['entry', `import visual from 'lux:visual'; export default visual; export { WebGPURenderer, RenderTarget, SRGBColorSpace, QuadMesh, MeshBasicNodeMaterial } from 'three/webgpu'; export { texture as sampleTexture } from 'three/tsl';`],
    ...moduleKeys.map(key => [`module/${key}`, artifact.modules[key]]),
    ['dep/three.webgpu.js', snapshots.get('three/webgpu')], ['dep/three.tsl.js', snapshots.get('three/tsl')], ['dep/three.core.js', snapshots.get('three/core')],
  ]);
  function resolveImport(specifier, importer) {
    if (importer === 'entry' && specifier === 'lux:visual') return `module/${artifact.entry}`;
    if (specifier === '@lux/visual-sdk') return 'module/__lux/sdk.js';
    if (specifier === 'three/webgpu') return 'dep/three.webgpu.js';
    if (specifier === 'three/tsl') return 'dep/three.tsl.js';
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) fail(`Import not allowed: ${specifier}`);
    if (specifier.includes('\\') || specifier.includes(':')) fail('Invalid relative import');
    const target = posix.normalize(posix.join(posix.dirname(importer), specifier));
    const zone = importer.startsWith('module/') ? 'module/' : 'dep/';
    if (!target.startsWith(zone) || !virtual.has(target)) fail(`Cannot resolve virtual import: ${specifier}`);
    return target;
  }
  for (const [name, code] of virtual) {
    const ast = parse(code, { sourceType: 'module' }), stack = [ast.program];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      // Generated modules cannot defer arbitrary loads beyond the virtual linker.
      if (name.startsWith('module/') && (node.type === 'ImportExpression' || (node.type === 'CallExpression' && node.callee?.name === 'require'))) fail('Dynamic imports are not allowed in generated modules');
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) resolveImport(node.source.value, name);
      for (const [key, value] of Object.entries(node)) if (!['loc', 'extra', 'comments', 'tokens'].includes(key)) {
        if (Array.isArray(value)) stack.push(...value); else if (value && typeof value === 'object') stack.push(value);
      }
    }
    // AST ranges avoid modifying comment-like text inside user strings. Never
    // let an input source-map directive trigger esbuild filesystem lookups.
    let clean = code;
    for (const comment of ast.comments.filter(c => /[@#]\s*sourceMappingURL\s*=/.test(c.value)).reverse()) clean = clean.slice(0, comment.start) + ' '.repeat(comment.end - comment.start) + clean.slice(comment.end);
    virtual.set(name, clean);
  }
  const { build, stop } = await import(pathToFileURL(esbuildEntry).href);
  let output;
  try {
    output = await build({ entryPoints: ['lux:entry'], outfile: 'linked.js', bundle: true, write: false,
      platform: 'browser', format: 'esm', target: 'es2023', sourcemap: 'external', sourcesContent: true, logLevel: 'silent',
      plugins: [{ name: 'verified-virtual-only', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => ({ path: args.kind === 'entry-point' && args.path === 'lux:entry' ? 'entry' : resolveImport(args.path, args.importer), namespace: 'lux' }));
        builder.onLoad({ filter: /.*/, namespace: 'lux' }, args => {
          if (!virtual.has(args.path)) fail('Unknown virtual module');
          return { contents: virtual.get(args.path), loader: 'js' };
        });
      } }],
    });
  } finally { stop(); }
  const code = output.outputFiles.find(f => f.path.endsWith('linked.js')).text;
  const sourceMap = output.outputFiles.find(f => f.path.endsWith('linked.js.map')).text;
  const body = linkedBody({ code, sourceMap, bundleHash: artifact.bundleHash, linker,
    ...(artifact.artifactVersion ? {linkedVersion:artifact.artifactVersion,assets:artifact.assets,assetSetHash:artifact.assetSetHash}: {}),
    ...(artifact.artifactVersion===3 ? {controls:artifact.controls,controlSchemaHash:artifact.controlSchemaHash} : {}) });
  const linked = { ...body, linkedHash: hash(JSON.stringify(body)) };
  if (Buffer.byteLength(JSON.stringify(linked), 'utf8') > 16777216 - 128) throw violation('Linked ESM result exceeds 16 MiB', 'QUOTA_EXCEEDED');
  return linked;
}
let result;
try { result = { ok: true, linked: await link() }; }
catch (error) {
  console.error(error);
  const known = ['SOURCE_BOUNDARY_VIOLATION', 'COMPILE_FAILED', 'QUOTA_EXCEEDED', 'SERVICE_UNAVAILABLE'].includes(error.code);
  result = { ok: false, code: known ? error.code : 'SERVICE_UNAVAILABLE', message: known ? String(error.message).slice(0, 2000) : 'Runtime linking failed; verify pinned dependencies and emitted JavaScript' };
}
await writeFile(join(process.cwd(), 'link-result.json'), JSON.stringify(result));
