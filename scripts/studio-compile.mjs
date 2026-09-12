import { compileVisual } from '../apps/build-worker/src/compile.mjs';
import { linkRuntime } from '../apps/build-worker/src/link-runtime.mjs';
import { assertLegacyPlaybackSource } from '../apps/studio/src/source/asset-playback.ts';
let input = '', bytes = 0;
try {
  for await (const chunk of process.stdin) { bytes += chunk.length; if (bytes > 8388608) throw Error('Source request too large'); input += chunk; }
  const source = JSON.parse(input); assertLegacyPlaybackSource(source);
  const result = await compileVisual({ source });
  if (!result.ok) process.stdout.write(JSON.stringify(result));
  else { const linked = await linkRuntime(result.artifact); process.stdout.write(JSON.stringify({ ok: true, linked, sourceHash: result.artifact.sourceHash })); }
} catch (error) { process.stdout.write(JSON.stringify({ ok: false, code: 'COMPILE_FAILED', diagnostics: [{ code: error.code || 'COMPILE_FAILED', message: String(error.message).slice(0, 2000) }] })); }
