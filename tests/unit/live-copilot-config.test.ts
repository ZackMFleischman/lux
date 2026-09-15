import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../../tools/live-copilot/config.ts';

test('normal startup rejects absent or placeholder keys without disclosing them', () => {
  for (const value of [undefined, '', 'replace-with-your-openai-api-key']) {
    assert.throws(() => readConfig([], { OPENAI_API_KEY: value }), /OPENAI_API_KEY/);
  }
  const result = readConfig(['--debug'], { OPENAI_API_KEY: 'test-secret-value' });
  assert.equal(result.debug, true); assert.equal(result.apiKey, 'test-secret-value');
  assert.throws(() => readConfig(['--unknown'], { OPENAI_API_KEY: 'test-secret-value' }), /Unknown option/);
});

test('MCP-only and help checks do not need API credentials', () => {
  assert.equal(readConfig(['--check-mcp'], {}).checkMcp, true);
  assert.equal(readConfig(['--help'], {}).help, true);
});
