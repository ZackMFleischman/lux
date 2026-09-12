import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
export async function createAgentBridge(invoke: (method: string, params: unknown) => Promise<unknown>) {
  const token = randomBytes(32).toString('hex');
  const requests = new Map<string, { body: string; result: Promise<unknown> }>();
  let active = 0;
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.method !== 'POST' || request.url !== '/' || request.headers.origin || request.headers.authorization !== `Bearer ${token}`) { response.writeHead(403).end('{"error":"Forbidden"}'); return; }
    let body = '', bytes = 0;
    try {
      for await (const chunk of request) { bytes += chunk.length; if (bytes > 8388608) throw Error('Request exceeds 8 MiB'); body += chunk; }
      const command = JSON.parse(body);
      if (!command || Object.keys(command).some(key => !['id', 'method', 'params'].includes(key)) || typeof command.id !== 'string' || command.id.length > 100 || !['read', 'build', 'capture', 'status', 'parameters', 'playback', 'restart'].includes(command.method)) throw Error('Invalid authoring command');
      let entry = requests.get(command.id);
      if (entry && entry.body !== body) throw Error('Request ID reused with different payload');
      if (!entry) {
        if (active >= 4) throw Error('Authoring queue is full');
        active++;
        const result = Promise.resolve().then(() => invoke(command.method, command.params)).finally(() => { active--; });
        entry = { body, result }; requests.set(command.id, entry);
        if (requests.size > 8) requests.delete(requests.keys().next().value!);
      }
      response.end(JSON.stringify({ ok: true, result: await entry.result }));
    } catch (error) { response.writeHead(400).end(JSON.stringify({ ok: false, error: String((error as Error).message).slice(0, 2000) })); }
  });
  server.requestTimeout = 80000;
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw Error('Local authoring listener failed');
  return { url: `http://127.0.0.1:${address.port}/`, token, close: () => { server.closeAllConnections(); server.close(); } };
}
