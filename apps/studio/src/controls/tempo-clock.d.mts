export type TempoSnapshot=Readonly<{bpm:number;beatPosition:number;beatPhase:number;tempoSequence:number}>;
export type TempoSetAcknowledgement=TempoSnapshot&Readonly<{tempoResult:'applied'|'same-bpm'}>;
export type TempoTapAcknowledgement=TempoSnapshot&Readonly<{tempoResult:'accepted'|'restarted'|'ignored-short'}>;
export type TempoClock=Readonly<{
 snapshot(timeSeconds:number):TempoSnapshot;
 setBpm(bpm:number,timeSeconds:number):TempoSetAcknowledgement;
 tap(timeSeconds:number):TempoTapAcknowledgement;
 reset(timeSeconds:number):TempoSnapshot;
}>;
export function createTempoClock(options:{nowMs:()=>number;bpm?:number;tempoSequence?:number}):TempoClock;
