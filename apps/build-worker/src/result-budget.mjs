import { limits, violation } from './source-policy.mjs';

const jsonBytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
const truncated = Object.freeze({ code: 'DIAGNOSTICS_TRUNCATED', message: 'Additional diagnostics omitted to keep the serialized result within 128 KiB.' });

// Measure the exact wire representation: escaping and multibyte text count.
// Reserve the explicit truncation marker while further diagnostics remain.
export function boundDiagnostics(diagnostics) {
  const kept = [];
  for (let i = 0; i < diagnostics.length; i++) {
    const candidate = [...kept, diagnostics[i]];
    if (jsonBytes(i + 1 < diagnostics.length ? [...candidate, truncated] : candidate) > limits.diagnosticBytes) return [...kept, truncated];
    kept.push(diagnostics[i]);
  }
  return kept;
}

// Run independently in the parent after decoding the worker result. A worker
// regression must not turn the larger aggregate result-file cap into a bypass.
export function assertResultBudgets(result) {
  if (!Array.isArray(result?.diagnostics)) throw violation('Compiler result is missing its diagnostics array', 'SERVICE_UNAVAILABLE');
  if (jsonBytes(result.diagnostics) > limits.diagnosticBytes) throw violation('Serialized compiler diagnostics exceed 128 KiB', 'QUOTA_EXCEEDED');
  if (result.ok === true && jsonBytes(result.artifact) > limits.outputBytes) throw violation('Final serialized artifact exceeds 4 MiB', 'QUOTA_EXCEEDED');
}
