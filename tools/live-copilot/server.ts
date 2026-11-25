import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import OpenAI from 'openai';
import { attachLive } from './live.ts';
import { voicePrompt } from './prompt.ts';
import type { Delegate } from './delegation.ts';

export async function startServer({ apiKey, preflight, execute, log = (_s: string) => {}, debug = false,
  client = new OpenAI({ apiKey, maxRetries: 0 }), attach = attachLive }: {
  apiKey: string; preflight: (signal: AbortSignal) => Promise<unknown>; execute: Delegate;
  log?: (s: string) => void; debug?: boolean; client?: OpenAI; attach?: typeof attachLive;
}) {
  const files: Record<string, [string, string]> = { '/': ['index.html', 'text/html'], '/client.js': ['client.js', 'text/javascript'], '/transcript.js': ['transcript.js', 'text/javascript'] };
  let url = '', closing = false;
  const server = createServer(async (req, res) => {
    if (req.headers.host !== new URL(url).host) { res.writeHead(403).end(); return; }
    const file = files[req.url ?? ''];
    if (req.method !== 'GET' || !file) { res.writeHead(404).end(); return; }
    try {
      res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'" });
      res.end(await readFile(join(import.meta.dirname, file[0])));
    } catch { res.writeHead(500).end(); }
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });
  const cleanups = new Set<() => Promise<void>>();
  server.on('upgrade', (req, socket, head) => {
    if (closing || req.url !== '/copilot' || req.headers.origin !== url || req.headers.host !== new URL(url).host || sockets.clients.size) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    sockets.handleUpgrade(req, socket, head, ws => sockets.emit('connection', ws));
  });
  sockets.on('connection', ws => {
    let live: ReturnType<typeof attachLive> | undefined, operation: Promise<void> | undefined;
    let controller: AbortController | undefined;
    const send = (event: unknown) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event)); };
    const report = (message: string) => {
      const safe = apiKey ? message.replaceAll(apiKey, '[redacted]') : message;
      log(safe); send({ type: 'log', message: safe });
    };
    const stop = async () => {
      controller?.abort();
      let confirmed = true;
      try { await live?.close(); } catch (error) { confirmed = false; report(`✗ ${(error as Error).message}`); }
      await operation;
      live = undefined; send({ type: 'stopped', confirmed });
    };
    cleanups.add(stop);
    ws.on('message', raw => {
      let command: any;
      try { command = JSON.parse(raw.toString()); } catch { send({ type: 'error', message: 'Invalid command' }); return; }
      if (command.type === 'disconnect') { void stop(); return; }
      if (command.type !== 'connect' || typeof command.sdp !== 'string' || !command.sdp.startsWith('v=0') || command.sdp.length > 100000) {
        send({ type: 'error', message: 'A valid WebRTC SDP offer is required' }); return;
      }
      if (operation || live) { send({ type: 'error', message: 'A voice session is already active' }); return; }
      controller = new AbortController(); const signal = controller.signal;
      operation = (async () => {
        try {
          // Required at every Start, before the first billable OpenAI operation.
          const state = await preflight(signal); signal.throwIfAborted();
          const session = await client.live.create({ session: { model: 'gpt-live-1', instructions: voicePrompt,
            delegation: { type: 'client' }, client: { data_channel: { allowed_client_events: [] } } },
            transport: { type: 'webrtc', sdp: command.sdp } }, { signal });
          live = attach({ client, sessionId: session.session.id, execute, state, debug, log: report,
            onTranscript(fragment) { send({ type: 'transcript', ...fragment, delta: apiKey ? fragment.delta.replaceAll(apiKey, '[redacted]') : fragment.delta }); },
            onFailure(error) { report(`✗ ${error.message}`); send({ type: 'error', message: 'Voice connection failed; final usage is unconfirmed. Stop and check the log.' }); void live?.close().catch(error => report(`✗ ${error.message}`)); },
            onEnded() { send({ type: 'stopped', confirmed: true }); live = undefined; } });
          if (signal.aborted || ws.readyState !== WebSocket.OPEN) { await live.close(); live = undefined; return; }
          await live.ready;
          if (signal.aborted) { await live.close(); live = undefined; return; }
          if (session.transport.type !== 'webrtc') throw Error('GPT-Live returned an unexpected transport');
          send({ type: 'answer', sdp: session.transport.sdp }); report('✓ GPT-Live connected');
        } catch (error) {
          await live?.close().catch(error => report(`✗ ${error.message}`)); live = undefined;
          if (!signal.aborted) { report(`✗ ${(error as Error).message}`); send({ type: 'error', message: 'Could not start voice. See the log for setup instructions.' }); }
        }
      })().finally(() => { operation = undefined; });
    });
    ws.on('error', () => { void stop(); });
    ws.on('close', () => { void stop().finally(() => cleanups.delete(stop)); });
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve()); });
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('No local server address');
  url = `http://127.0.0.1:${address.port}`;
  let closePromise: Promise<void> | undefined;
  return { url, close() {
    return closePromise ??= (async () => {
      closing = true;
      await Promise.allSettled([...cleanups].map(stop => stop()));
      for (const ws of sockets.clients) ws.terminate(); sockets.close();
      await new Promise<void>(resolve => server.close(() => resolve()));
    })();
  } };
}
