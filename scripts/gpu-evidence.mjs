// A short standalone diagnostic is not actual Resolume or performance acceptance.
export function validateProbeEvidence(producer, receiver) {
  const reasons = [];
  const summary = producer.findLast(row => row.kind === 'summary');
  if (!summary || summary.closed !== true || summary.failed !== false || summary.webgpuReady !== true ||
      summary.held !== 0 || summary.uncertain !== 0 || summary.dropped !== 0 || !(summary.paint > 0)) {
    reasons.push('Producer did not prove successful WebGPU production and complete ownership drain');
  }
  if (!receiver.some(row => row.kind === 'context' && row.sharedContext === true && row.nvInterop === true)) reasons.push('Receiver context unavailable');
  if (!receiver.some(row => row.kind === 'counters' && row.consumed > 0)) reasons.push('No completed receiver consumption');
  if ([...producer, ...receiver].some(row => row.kind === 'failure' || row.kind === 'bounded-unload-unsupported')) reasons.push('Failure recorded');
  return { ok: reasons.length === 0, scope: 'short-standalone-diagnostic-only', reasons };
}
