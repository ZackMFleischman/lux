import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const installed = JSON.parse(await readFile(join(process.env.LOCALAPPDATA, 'Programs/Lux/installation.json'), 'utf8'));
const client = new Client({ name: 'lux-library-verification', version: '1.0.0' });
try {
  await client.connect(new StdioClientTransport({ command: installed.node, args: [installed.adapter], cwd: installed.workspace, env: { ...process.env } }));
  const names = (await client.listTools()).tools.map(tool => tool.name);
  const libraryTools = names.filter(name => name.startsWith('lux.library.'));
  for (const operation of ['list', 'read', 'create', 'update']) {
    if (!libraryTools.includes(`lux.library.${operation}`)) throw new Error(`Missing ${operation}`);
  }
  const result = { sourceCommit: installed.sourceCommit, libraryTools, canonicalLibraryRoot: installed.canonicalLibraryRoot };
  await writeFile(new URL('./profile-merge/installed-tools.json', import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await client.close(); }
