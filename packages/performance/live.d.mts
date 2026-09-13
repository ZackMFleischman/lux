export interface LiveMetric {
  readonly unit:'ms'|'Hz'; readonly availability:'available'|'pending'|'unsupported';
  readonly reason?:string; readonly sampleCount:number;readonly expectedCount:number;readonly missingCount:number;
  readonly samplingPolicy:string;readonly validity:'complete'|'incomplete';readonly gate:'not_evaluated';
  readonly p50?:number;readonly p95?:number;readonly p99?:number;readonly max?:number;readonly value?:number;
}
export interface FrameSummary {
  readonly schemaVersion:1;readonly mode:'routine';readonly sequence:number;readonly clockDomain:'dedicated-worker-monotonic-ms';
  readonly windowStartMs:number;readonly windowEndMs:number;readonly lostRecords:number;readonly invalidRecords:number;
  readonly intervalLostRecords:number;readonly intervalInvalidRecords:number;readonly retainedRecords:number;
  readonly produced:LiveMetric;readonly update:LiveMetric;readonly renderCall:LiveMetric;readonly cpuCall:LiveMetric;
  readonly renderAwait:LiveMetric;readonly queueWait:LiveMetric;
  readonly gpu:LiveMetric & Readonly<{timestampQuerySupported:boolean|null;timestampQueryEnabled:boolean}>;
}
export const LIVE_LIMITS:Readonly<{records:4096;windowMs:120000;summaryMs:500}>;
export function createFrameCollector(options:{startMs:number;capacity?:number;windowMs?:number}):Readonly<{
  record(at:number,frame:number,update:number,renderCall:number,queueWait:number,asyncRender:boolean,renderAwait?:number):boolean;
  summary(now:number,capability?:{timestampQuerySupported?:boolean|null;timestampQueryEnabled?:boolean}):FrameSummary;
}>;
