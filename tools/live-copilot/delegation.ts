import { randomUUID } from 'node:crypto';

export type Delegate = (task: string, signal: AbortSignal) => Promise<string>;
/** GPT-Live's client delegation event has an ID, not a task prompt. */
export function createDelegationHandler({ execute, state, send, log = (_s: string) => {} }: {
  execute: Delegate; state: unknown; send: (event: any) => void; log?: (s: string) => void;
}) {
  const transcript: { speaker: string; text: string; start: number; end: number }[] = [];
  const seen = new Set<string>();
  const controller = new AbortController();
  let queue = Promise.resolve();
  let recentResult = '';
  let inputVersion = 0, delegatedVersion = 0;
  return {
    handle(event: any): Promise<void> {
      if (controller.signal.aborted) return Promise.resolve();
      if (event.type === 'session.input_transcript.delta' || event.type === 'session.output_transcript.delta') {
        if (event.type === 'session.input_transcript.delta' && event.delta?.trim()) inputVersion++;
        transcript.push({ speaker: event.type === 'session.input_transcript.delta' ? 'User' : 'Copilot',
          text: event.delta, start: event.start_ms ?? 0, end: event.end_ms ?? 0 });
        if (transcript.length > 400) transcript.shift();
        return Promise.resolve();
      }
      if (event.type !== 'session.delegation.created' || event.delegation?.target !== 'client') return Promise.resolve();
      const id = event.delegation.id;
      if (typeof id !== 'string' || seen.has(id)) return queue;
      seen.add(id);
      // Snapshot the available transcript now so a queued request cannot consume a later instruction.
      const context = transcript.filter(t => event.offset_ms === undefined || t.start <= event.offset_ms);
      const hasNewInput = inputVersion > delegatedVersion;
      delegatedVersion = inputVersion;
      queue = queue.then(async () => {
        if (controller.signal.aborted) return;
        log('→ delegated to local Codex');
        const start = Date.now();
        let content: string;
        try {
          if (!hasNewInput || !context.some(t => t.speaker === 'User' && t.text.trim())) throw Error('No user transcript is available for this request. Ask the user to repeat the request.');
          const task = JSON.stringify({ instruction: 'Execute the latest user request, using preceding conversation for relative follow-ups. Use MCP for Lux control; use workspace files and commands for software engineering.',
            transcript: context, previousVerifiedResult: recentResult, startupState: state });
          content = await execute(task, controller.signal);
          if (controller.signal.aborted) return;
          recentResult = content;
          log(`✓ completed ${Date.now() - start}ms`);
        } catch (error) {
          if (controller.signal.aborted) return;
          content = `Could not confirm the requested Lux operation: ${(error as Error).message}`;
          log(`✗ ${content}`);
        }
        // Under the documented 500-token append limit even for non-Latin text.
        let short = '';
        for (const character of content) {
          if (Buffer.byteLength(short + character, 'utf8') > 480) break;
          short += character;
        }
        send({ type: 'session.commentary.append', event_id: randomUUID(), delegation_id: id, content: short });
      });
      return queue;
    },
    stop() { controller.abort(); return queue.catch(() => {}); },
  };
}
