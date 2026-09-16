export type SceneTempoSettings=Readonly<{bpm:number}>;
export const TEMPO_BPM_MIN:20;
export const TEMPO_BPM_MAX:300;
export const DEFAULT_TEMPO_SETTINGS:SceneTempoSettings;
export function normalizeTempoSettings(input?:unknown):SceneTempoSettings;
