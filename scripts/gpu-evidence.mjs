// A short standalone diagnostic is not actual Resolume or performance acceptance.
function compiledEvidence(producer, release) {
  if (!release) return true;
  const identity=producer.find(row=>row.kind==='release');
  const initial=producer.find(row=>row.kind==='initial-frame');
  const control=producer.find(row=>row.kind==='host-control');
  return identity?.sourceHash===release.sourceHash&&identity?.linkedHash===release.linked.linkedHash&&
    initial?.sourceHash===release.sourceHash&&initial?.frameId==='1'&&initial?.controlSequence===0&&
    Number.isFinite(control?.value)&&initial?.intensity===control.value;
}
export function validateProbeEvidence(producer, receiver, release) {
  const reasons = [];
  if(!compiledEvidence(producer,release))reasons.push('Compiled release or initial host frame acknowledgement missing/mismatched');
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

export function validateResolumeEvidence(producer, receiver, outcome, initialCounters, release) {
  let last = initialCounters, stable = !!last;
  for (const row of receiver) {
    if (row.kind === 'context' || row.kind === 'context-host-snapshot') stable = false;
    if (row.kind === 'counters') {
      if (!Number.isSafeInteger(row.callbacks) || !Number.isSafeInteger(row.consumed) ||
          row.callbacks < (last?.callbacks ?? 0) || row.consumed < (last?.consumed ?? 0)) stable = false;
      last = row;
    }
  }
  const summary = producer.findLast(row => row.kind === 'summary');
  const finalCounters = receiver.findLast(row => row.kind === 'counters');
  const consumed = (finalCounters?.consumed || 0) - (initialCounters?.consumed || 0);
  const ok = compiledEvidence(producer,release) && stable && outcome.code === 0 && summary?.paint > 0 && summary?.closed === true && summary.failed === false && summary.webgpuReady === true &&
    summary.held === 0 && summary.uncertain === 0 && summary.dropped === 0 && consumed > 0 &&
    receiver.some(row => row.kind === 'attached' && row.producerPid === outcome.pid) &&
    !receiver.some(row => row.kind === 'failure' || row.kind === 'bounded-unload-unsupported');
  return { ok, consumed };
}
