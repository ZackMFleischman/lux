import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { runFixture } from './run-fixture.mjs';

// Three independently bounded 10-second phases plus 5 seconds for cleanup per run.
const fixtureRunBudgetMs = 3 * 10000 + 5000;

test('isolated stdio fixture negotiates legacy profile, discovers tool, and returns decodable PNG', { timeout: fixtureRunBudgetMs }, async () => {
  const { response, transcript } = await runFixture();
  assert.ok(transcript.some((item: any) => item.direction === 'server->client' && item.message.result?.protocolVersion === '2025-11-25'));
  assert.ok(transcript.some((item: any) => item.message.result?.tools?.some((tool: any) => tool.name === 'lux_fixture_image')));
  const image = CallToolResultSchema.parse(response).content.find(block => block.type === 'image');
  assert.ok(image && image.type === 'image');
  assert.equal(image.mimeType, 'image/png');
  const png = Buffer.from(image.data, 'base64');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 32);
  assert.equal(png.readUInt32BE(20), 32);
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  assert.equal(inflateSync(Buffer.concat(chunks)).length, 32 * (1 + 32 * 3));
});

test('unsupported negotiated profile is rejected and a fresh connection succeeds', { timeout: 2 * fixtureRunBudgetMs }, async () => {
  await assert.rejects(runFixture({ profile: '1900-01-01' }), /Unsupported MCP profile/);
  const result = await runFixture();
  assert.equal(result.imageObserved, false);
  assert.ok(result.transcript.some((item: any) => item.message.method === 'tools/call'));
});
