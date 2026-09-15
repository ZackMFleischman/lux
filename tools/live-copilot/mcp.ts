import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { join } from 'node:path';
import { sanitizeEnvironment } from './codex.ts';

export type ToolResult = Pick<CallToolResult, 'content' | 'isError'>;
export const resultText = (result: ToolResult) => result.content.filter(p => p.type === 'text').map(p => p.text).join('\n');

/** Startup health check only. Delegated tools run inside Codex using its saved MCP configuration. */
export async function connectMcp({ root, env = process.env, configuration, apiKey = '',
  client = new Client({ name: 'lux-live-copilot', version: '0.1.0' }), transport, signal }: {
  root: string; env?: NodeJS.ProcessEnv; configuration?: any; apiKey?: string;
  client?: Client; transport?: StdioClientTransport; signal?: AbortSignal;
}) {
  const selected = configuration?.transport;
  const childEnv = sanitizeEnvironment({ ...env, ...selected?.env }, apiKey) as Record<string, string>;
  const stdio = transport ?? new StdioClientTransport({ command: selected?.command ?? process.execPath,
    args: selected?.args ?? [join(root, 'scripts/studio-mcp.mjs')], cwd: selected?.cwd ?? root, env: childEnv, stderr: 'pipe' });
  let closed = false;
  const close = async () => { if (closed) return; closed = true; await client.close(); };
  const abort = () => { void close().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    signal?.throwIfAborted();
    await client.connect(stdio, { timeout: 10000 });
    const catalog: Tool[] = [];
    let cursor: string | undefined;
    do {
      const page = await client.listTools(cursor ? { cursor } : {}, { timeout: 10000, signal });
      catalog.push(...page.tools); cursor = page.nextCursor;
    } while (cursor);
    if (configuration?.disabled_tools?.includes('lux.studio.status') ||
      (configuration?.enabled_tools && !configuration.enabled_tools.includes('lux.studio.status'))) {
      throw Error('lux.studio.status is disabled in Codex MCP permissions');
    }
    const status = await client.callTool({ name: 'lux.studio.status', arguments: {} }, undefined, { timeout: 10000, signal });
    if (status.isError) throw Error(resultText(status as ToolResult));
    const state = JSON.parse(resultText(status as ToolResult));
    if (!state.studioSession) throw Error('Studio status did not identify a running instance');
    return { status: state, catalog,
      async close() { signal?.removeEventListener('abort', abort); await close(); } };
  } catch (error) {
    signal?.removeEventListener('abort', abort); await close().catch(() => {});
    throw Error(`Could not connect to Lux MCP server. Make sure Lux is running and codex mcp get lux-studio points to its matching checkout/profile. ${(error as Error).message}`);
  }
}
