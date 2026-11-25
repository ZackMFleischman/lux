import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTranscript } from '../../tools/live-copilot/transcript.js';

test('speech packets append to one paragraph across activity messages', () => {
  const view = createTranscript();
  view.append({ speaker: 'Copilot', delta: ' I still', startMs: 0, endMs: 100 });
  view.activity('→ delegated');
  view.append({ speaker: 'Copilot', delta: " couldn't", startMs: 100, endMs: 200 });
  view.append({ speaker: 'Copilot', delta: ' do that.', startMs: 200, endMs: 300 });
  assert.equal(view.text(), "Copilot: I still couldn't do that.\n→ delegated");
});

test('speaker changes, pauses and new sessions start fresh paragraphs', () => {
  const view = createTranscript();
  for (const fragment of [
    { speaker: 'You', delta: 'faster', startMs: 0, endMs: 100 },
    { speaker: 'Copilot', delta: 'Done.', startMs: 100, endMs: 200 },
    { speaker: 'Copilot', delta: 'Hello.', startMs: 2000, endMs: 2100 },
  ]) view.append(fragment);
  view.reset();
  view.append({ speaker: 'Copilot', delta: 'New session.', startMs: 0, endMs: 100 });
  assert.equal(view.text(), 'You: faster\nCopilot: Done.\nCopilot: Hello.\nCopilot: New session.');
});
