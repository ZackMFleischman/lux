import { memo } from 'react';
import type { PerformanceSnapshot } from './performance-state.ts';
import type { LiveMetric } from '../../../../packages/performance/live.mjs';
const duration=(metric:LiveMetric|undefined)=>metric?.p95===undefined?'pending':`${metric.p95.toFixed(2)} ms p95`;
/** Routine observations, intentionally without budget colors or pass badges. */
export const PerformanceStatus=memo(function PerformanceStatus({performance:value}:{performance?:PerformanceSnapshot}) {
 const worker=value?.worker;
 const incomplete=worker&&((worker.mode==='routine'&&worker.cpuCall.validity==='incomplete')||(worker.gpu.timestampQueryEnabled&&worker.gpu.validity==='incomplete')||worker.intervalLostRecords>0||worker.intervalInvalidRecords>0);
 const detail=worker?[
  `Mode: ${worker.mode}. Completed worker frames: ${worker.produced.sampleCount}; duration samples: ${worker.retainedRecords}; lost: ${worker.lostRecords}; invalid: ${worker.invalidRecords}.`,
  `Update ${duration(worker.update)}; synchronous render ${duration(worker.renderCall)}; render await ${duration(worker.renderAwait)}; queue completion wait ${duration(worker.queueWait)}.`,
  worker.cpuCall.reason??'',worker.gpu.reason??'',
  `Timestamp query support: ${worker.gpu.timestampQuerySupported===null?'unknown':worker.gpu.timestampQuerySupported?'yes':'no'}; enabled: ${worker.gpu.timestampQueryEnabled?'yes':'no'}.`,
  `GPU samples ${worker.gpu.sampleCount}/${worker.gpu.expectedCount} eligible frames; ${worker.gpu.samplingPolicy}; failed ${worker.gpu.failedSamples}; dropped ${worker.gpu.droppedSamples}; pending ${worker.gpu.pendingSamples}.`,
  'Hardware budgets are not evaluated.',
 ].join(' '):'Waiting for runtime telemetry. Hardware budgets are not evaluated.';
 return <div aria-label="Live performance" title={detail} style={{display:'flex',flexWrap:'wrap',gap:'4px 14px',fontSize:12,fontVariantNumeric:'tabular-nums',color:'inherit'}}>
  <span>Worker {worker?.produced.value===undefined?'pending':`${worker.produced.value.toFixed(1)} fps`}</span>
  <span>CPU calls {worker?.mode==='baseline'?'disabled (baseline)':duration(worker?.cpuCall)}</span>
  <span>GPU passes {worker?.mode==='baseline'?'disabled (baseline)':worker?.gpu.timestampQueryEnabled?`${duration(worker.gpu)} · sampled`:'unavailable'}</span>
  <span>{value?.status??'pending'}{incomplete?' · incomplete':''}</span>
 </div>;
});
