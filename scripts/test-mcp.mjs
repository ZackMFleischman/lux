import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runFixture } from '../tests/mcp/run-fixture.mjs';
if (!process.argv.includes('--profile-fixture')) {
  console.error('UNAVAILABLE: TR-04 required for application MCP tests. TR-01 prerequisite fixture: pnpm test:mcp -- --profile-fixture');
  process.exitCode = 2;
} else {
  const test = spawnSync(process.execPath, ['--test', 'tests/mcp/profile-fixture.test.ts'], { stdio: 'inherit' });
  if (test.status !== 0) process.exitCode = test.status ?? 1;
  else {
    const result = await runFixture();
    const dir = `evidence/tracer-0.1/mcp-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/mcp-transcript.json`, JSON.stringify(result, null, 2) + '\n');
    console.log(`Protocol fixture passed. Evidence: ${dir}/mcp-transcript.json. Model observation remains unavailable until externally observed.`);
  }
}
