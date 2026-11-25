import type OpenAI from 'openai';
import { SidebandWS } from 'openai/resources/live/sideband/ws';
import { createDelegationHandler } from './delegation.ts';
import type { Delegate } from './delegation.ts';

/** Browser owns audio. This trusted sideband alone owns tool execution. */
export function attachLive({ client, sessionId, execute, state, onFailure, onEnded, log = (_s: string) => {}, debug = false, driver }: {
  client: OpenAI; sessionId: string; execute: Delegate; state: unknown;
  onFailure: (error: Error) => void; onEnded: () => void;
  log?: (message: string) => void; debug?: boolean; driver?: SidebandWS;
}) {
  const ws = driver ?? new SidebandWS(client, { session_id: sessionId }, { reconnect: null });
  let opened = false, closing = false, finalized = false, disconnected = false, failed = false;
  let finish!: () => void, readyResolve!: () => void, readyReject!: (error: Error) => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  void ready.catch(() => {});
  let closingPromise: Promise<void> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const startupTimer = setTimeout(() => fail(Error('GPT-Live backend attachment timed out')), 15000);
  const backend = createDelegationHandler({ execute, state, log, send(event) {
    if (closing || disconnected) throw Error('GPT-Live connection closed');
    ws.send(event as Parameters<SidebandWS['send']>[0]);
  } });
  function fail(error: Error) {
    if (failed || closing) return;
    failed = true; clearTimeout(startupTimer); backend.stop(); readyReject(error); onFailure(error);
  }
  ws.socket.on('open', () => { opened = true; clearTimeout(startupTimer); readyResolve(); });
  ws.on('event', event => {
    if (debug && !['session.input_audio.append', 'session.output_audio.delta'].includes(event.type)) {
      log(`[Live] ${event.type}${event.type === 'response.event' ? ` ${String(event.event.type)}` : ''}`);
    }
    if (event.type === 'session.closed') {
      const wasClosing = closing;
      finalized = true; closing = true; backend.stop(); clearTimeout(startupTimer); clearTimeout(closeTimer);
      readyReject(Error('GPT-Live session closed')); ws.close(); finish();
      if (!wasClosing) onEnded(); return;
    }
    if (closing || failed) return;
    if (event.type === 'session.input_transcript.delta' || event.type === 'session.output_transcript.delta') {
      log(`${event.type === 'session.input_transcript.delta' ? 'You' : 'Copilot'}: ${event.delta}`);
    } void backend.handle(event).catch(error => fail(error as Error));
  });
  ws.on('error', error => fail(Error(`GPT-Live: ${error.message}`)));
  ws.socket.on('close', () => {
    disconnected = true; clearTimeout(startupTimer); clearTimeout(closeTimer); backend.stop();
    readyReject(Error('GPT-Live connection closed'));
    if (!closing && !finalized) fail(Error('GPT-Live backend connection closed unexpectedly. Check Lux state before reconnecting.'));
    finish();
  });
  return { ready, close() {
    if (closingPromise) return closingPromise;
    closing = true; const tasksStopped = backend.stop(); clearTimeout(startupTimer); readyReject(Error('GPT-Live connection closed'));
    closingPromise = (async () => {
      if (finalized) return;
      if (disconnected) throw Error('GPT-Live disconnected without final usage confirmation.');
      if (!opened || ws.socket.readyState !== 1) { ws.socket.platformSocket.terminate(); throw Error('GPT-Live attachment closed before final usage could be confirmed.'); }
      closeTimer = setTimeout(() => {
        log('✗ GPT-Live close timed out; final usage is unconfirmed');
        ws.socket.platformSocket.terminate(); finish();
      }, 5000);
      ws.send({ type: 'session.close' }); await finished; clearTimeout(closeTimer);
      if (!finalized) throw Error('GPT-Live closure and final usage are unconfirmed.');
    })().finally(() => tasksStopped);
    return closingPromise;
  } };
}

