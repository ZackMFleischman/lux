/** Keep streaming speech in one paragraph, even when activity arrives between packets. */
export function createTranscript() {
  const rows = [];
  let current;
  return {
    reset() { current = undefined; },
    activity(text) { rows.push({ text }); },
    append({ speaker, delta, startMs, endMs }) {
      if (!delta) return;
      if (!current || current.speaker !== speaker || startMs - current.endMs > 1500) {
        current = { speaker, text: `${speaker}: ${delta.trimStart()}`, endMs };
        rows.push(current);
      } else { current.text += delta; current.endMs = endMs; }
    },
    text() {
      while (rows.length > 200) rows.shift();
      return rows.map(row => row.text).join('\n').slice(-18000);
    },
  };
}
