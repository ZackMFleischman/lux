// Trusted compiler implementation. Submitted source is parsed and compiled only;
// it is never imported, evaluated, required, or used as a process command.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve, posix, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { limits, validateSource, violation } from './source-policy.mjs';
import { sdkMetadata } from '../../../packages/visual-sdk/src/metadata.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const workspace = process.cwd();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pinned = { typescript: '7.0.2', '@babel/parser': '8.0.5', three: '0.186.0', '@types/three': '0.186.0' };
const allowed = new Set(sdkMetadata.allowedImports);
function diagnostic(error, file) {
  return { code: error.code || 'COMPILE_FAILED', message: String(error.message).slice(0, 4000), ...(file ? { file } : {}), ...(error.loc ? { line: error.loc.line, column: error.loc.column + 1 } : {}) };
}
async function main() {
  const { source: raw, dependencyRoot } = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const source = validateSource(raw), dependencyHashes = {};
  for (const [name, version] of Object.entries(pinned)) {
    const bytes = await readFile(join(dependencyRoot, name, 'package.json'));
    if (JSON.parse(bytes).version !== version) throw violation(`Install pinned ${name}@${version}`, 'SERVICE_UNAVAILABLE');
    dependencyHashes[`${name}/package.json`] = sha(bytes);
  }
  const { parse } = await import(pathToFileURL(join(dependencyRoot, '@babel/parser/lib/index.js')).href);
  for (const [path, text] of Object.entries(source.files)) {
    let ast;
    try { ast = parse(text, { sourceType: 'module', plugins: ['typescript'], errorRecovery: false }); }
    catch (error) { return { ok: false, code: 'COMPILE_FAILED', diagnostics: [diagnostic(error, path)] }; }
    try {
      if (ast.comments.some(c => /<reference\b|@ts-(?:ignore|nocheck|expect-error)/i.test(c.value))) throw violation('Compiler references and diagnostic-suppression directives are prohibited');
      const stack = [ast.program];
      while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== 'object') continue;
        if (['ImportExpression', 'TSImportType', 'TSImportEqualsDeclaration', 'TSModuleDeclaration'].includes(node.type) || node.declare === true) throw violation('Dynamic imports, ambient declarations, and import-equals are prohibited');
        if (node.type === 'Identifier' && ['require', 'eval', 'Function', 'process', 'Buffer', 'global', 'globalThis', 'window', 'document', 'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker'].includes(node.name)) throw violation(`Unavailable privileged capability: ${node.name}`);
        if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) {
          const specifier = node.source.value;
          if (!allowed.has(specifier)) {
            if (!specifier.startsWith('./') && !specifier.startsWith('../')) throw violation(`Import not allowed: ${specifier}`);
            const target = posix.normalize(posix.join(posix.dirname(path), specifier));
            if (!specifier.endsWith('.ts') || !Object.hasOwn(source.files, target)) throw violation(`Import must resolve to a submitted .ts module: ${specifier}`);
          }
        }
        for (const [key, value] of Object.entries(node)) if (!['loc', 'extra', 'comments', 'tokens'].includes(key)) {
          if (Array.isArray(value)) stack.push(...value); else if (value && typeof value === 'object') stack.push(value);
        }
      }
      if (path === source.entry) {
        const imported = ast.program.body.flatMap(n => n.type === 'ImportDeclaration' && n.source.value === '@lux/visual-sdk' ? n.specifiers.filter(s => s.type === 'ImportSpecifier' && s.imported.name === 'defineVisual').map(s => s.local.name) : []);
        const declaration = ast.program.body.find(n => n.type === 'ExportDefaultDeclaration')?.declaration;
        if (declaration?.type !== 'CallExpression' || declaration.callee.type !== 'Identifier' || !imported.includes(declaration.callee.name)) throw violation('Entry must export default defineVisual({...}) imported from @lux/visual-sdk');
      }
    } catch (error) { return { ok: false, code: error.code, diagnostics: [diagnostic(error, path)] }; }
  }
  for (const [path, text] of Object.entries(source.files)) {
    await mkdir(dirname(join(workspace, 'source', path)), { recursive: true });
    await writeFile(join(workspace, 'source', path), text);
  }
  await mkdir(join(workspace, 'types'));
  const sdk = await readFile(join(root, 'packages/visual-sdk/src/index.ts'), 'utf8');
  const shared = await readFile(join(root, 'packages/runtime-contracts/src/index.ts'), 'utf8');
  await writeFile(join(workspace, 'types/sdk.ts'), sdk.replace('../../runtime-contracts/src/index.ts', './shared.ts'));
  await writeFile(join(workspace, 'types/shared.ts'), shared);
  await writeFile(join(workspace, '__lux_check.ts'), `import visual from './source/${source.entry}';\nimport type { VisualDefinition } from '@lux/visual-sdk';\nconst checked: VisualDefinition = visual;\nexport { checked };\n`);
  const zod = JSON.parse(await readFile(join(dependencyRoot, 'zod/package.json'), 'utf8'));
  const config = { compilerOptions: { target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
    types: [], lib: ['ES2023', 'DOM'], skipLibCheck: true, noEmitOnError: true, sourceMap: true, inlineSources: true,
    rewriteRelativeImportExtensions: true, rootDir: '.', outDir: './out',
    paths: { '@lux/visual-sdk': ['./types/sdk.ts'], zod: [join(dependencyRoot, 'zod', zod.types)],
      'three/webgpu': [join(dependencyRoot, '@types/three/build/three.webgpu.d.ts')],
      'three/tsl': [join(dependencyRoot, '@types/three/build/three.tsl.d.ts')] } },
    files: [...Object.keys(source.files).map(p => `source/${p}`), '__lux_check.ts'] };
  await writeFile(join(workspace, 'tsconfig.json'), JSON.stringify(config));
  const { default: getExePath } = await import(pathToFileURL(join(dependencyRoot, 'typescript/lib/getExePath.js')).href);
  const executable = getExePath();
  const compiler = spawnSync(executable, ['-p', join(workspace, 'tsconfig.json'), '--pretty', 'false'], { cwd: workspace, encoding: 'utf8', windowsHide: true, maxBuffer: limits.diagnosticBytes });
  if (compiler.error?.code === 'ENOBUFS') throw violation('Compiler diagnostics exceed 128 KiB', 'QUOTA_EXCEEDED');
  if (compiler.error) throw violation('Pinned TypeScript compiler could not start', 'SERVICE_UNAVAILABLE');
  if (compiler.status !== 0) {
    const lines = (compiler.stdout + compiler.stderr).trim().split(/\r?\n/);
    const diagnostics = lines.slice(0, 128).map(line => {
      const match = line.match(/^source\/(.+)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
      return match ? { code: match[4], file: match[1], line: +match[2], column: +match[3], message: match[5].slice(0, 800) }
        : { code: 'COMPILE_FAILED', message: line.replaceAll(workspace, '<build>').replaceAll(dependencyRoot, '<dependencies>').slice(0, 800) };
    });
    return { ok: false, code: 'COMPILE_FAILED', diagnostics: diagnostics.length ? diagnostics : [{ code: 'COMPILE_FAILED', message: 'Compiler exited without emitting a diagnostic' }] };
  }
  const modules = {}, sourceMaps = {};
  for (const path of Object.keys(source.files)) {
    const output = path.replace(/\.ts$/, '.js');
    modules[output] = await readFile(join(workspace, 'out/source', output), 'utf8');
    sourceMaps[output + '.map'] = await readFile(join(workspace, 'out/source', output + '.map'), 'utf8');
  }
  modules['__lux/sdk.js'] = await readFile(join(workspace, 'out/types/sdk.js'), 'utf8');
  sourceMaps['__lux/sdk.js.map'] = await readFile(join(workspace, 'out/types/sdk.js.map'), 'utf8');
  const dependencies = {
    'compiler/worker.mjs': fileURLToPath(import.meta.url),
    'compiler/source-policy.mjs': join(root, 'apps/build-worker/src/source-policy.mjs'),
    'node/executable': process.execPath,
    'sdk/index.ts': join(root, 'packages/visual-sdk/src/index.ts'),
    'sdk/metadata.mjs': join(root, 'packages/visual-sdk/src/metadata.mjs'),
    'contracts/index.ts': join(root, 'packages/runtime-contracts/src/index.ts'),
    'typescript/compiler': executable, '@babel/parser/index.js': join(dependencyRoot, '@babel/parser/lib/index.js'),
    'three/webgpu': join(dependencyRoot, 'three/build/three.webgpu.js'), 'three/tsl': join(dependencyRoot, 'three/build/three.tsl.js'),
    'three/core': join(dependencyRoot, 'three/build/three.core.js'),
  };
  for (const [name, path] of Object.entries(dependencies)) dependencyHashes[name] = sha(await readFile(path));
  const listed = spawnSync(executable, ['-p', join(workspace, 'tsconfig.json'), '--listFilesOnly', '--pretty', 'false'], { cwd: workspace, encoding: 'utf8', windowsHide: true, maxBuffer: 1048576 });
  if (listed.error || listed.status !== 0) throw violation('Could not inventory the compiler declaration closure', 'SERVICE_UNAVAILABLE');
  for (const path of listed.stdout.trim().split(/\r?\n/).sort()) {
    if (!relative(workspace, path).startsWith('..')) continue;
    const key = relative(dependencyRoot, path).replaceAll('\\', '/');
    if (key.startsWith('../')) throw violation('Compiler loaded a declaration outside the pinned dependency root', 'SOURCE_BOUNDARY_VIOLATION');
    dependencyHashes[`declarations/${key}`] = sha(await readFile(path));
  }
  const artifact = { sourceHash: sha(JSON.stringify(source)), entry: source.entry.replace(/\.ts$/, '.js'), modules, sourceMaps,
    sdkVersion: source.sdkVersion, compilerVersion: pinned.typescript, dependencyHashes };
  if (Buffer.byteLength(JSON.stringify(artifact)) > limits.outputBytes) throw violation('Emitted artifact exceeds 4 MiB', 'QUOTA_EXCEEDED');
  return { ok: true, artifact: { ...artifact, bundleHash: sha(JSON.stringify(artifact)) }, diagnostics: [] };
}
let result;
try { result = await main(); }
catch (error) {
  const codes = ['SOURCE_BOUNDARY_VIOLATION', 'COMPILE_FAILED', 'QUOTA_EXCEEDED', 'TIMEOUT', 'SERVICE_UNAVAILABLE'];
  const known = codes.includes(error.code);
  const safe = known ? error : Object.assign(Error('Compiler setup failed; check pinned dependencies and build-worker files'), { code: 'SERVICE_UNAVAILABLE' });
  result = { ok: false, code: safe.code, diagnostics: [diagnostic(safe)] };
}
await writeFile(join(workspace, 'compile-result.json'), JSON.stringify(result));
