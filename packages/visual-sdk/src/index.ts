export type {AudioSpectrumFrame};
import type { ControlDefinition, ControlValues, AudioSpectrumFrame, OutputSettings } from '../../runtime-contracts/src/index.ts';

export const sdkVersion = '0.1.0' as const;
export interface OutputTarget {
  readonly width: number; readonly height: number;
  readonly colorSpace: 'linear-srgb'; readonly alphaMode: 'premultiplied';
}
export interface FrameContext {
  readonly audioSpectrum?: AudioSpectrumFrame;
  readonly tick: number; readonly timeSeconds: number; readonly deltaSeconds: number;
  readonly controls: Readonly<ControlValues>; readonly events: readonly never[];
  readonly sampleControl?: (controlId: string, instanceKey: string | number) => number;
}
export interface VisualContext {
  readonly settings: Readonly<OutputSettings>;
  readonly assets: ReadonlyMap<string, Readonly<Uint8Array>>;
  readonly images: ReadonlyMap<string, Readonly<{ width: number; height: number; colorSpace: 'srgb'; alphaMode: 'straight'; data: Uint8Array }>>;
  random(): number;
  reportError(message: string): void;
  readonly renderer: { render(scene: unknown, camera: unknown, target: OutputTarget): void | Promise<void> };
}
export interface VisualInstance {
  update(frame: FrameContext): void;
  render(target: OutputTarget): void | Promise<void>;
  reset(seed: number): void | Promise<void>;
  dispose(): void | Promise<void>;
}
export interface VisualDefinition {
  readonly sdkVersion: typeof sdkVersion;
  readonly controls: readonly ControlDefinition[];
  create(context: VisualContext): Promise<VisualInstance>;
}
const controls: readonly ControlDefinition[] = Object.freeze([Object.freeze({
  id: 'intensity', type: 'number', label: 'Intensity', default: 0.5, min: 0, max: 1, changeCost: 'live',
})]);
export function defineVisual(definition: Pick<VisualDefinition, 'create'>): VisualDefinition {
  return Object.freeze({ sdkVersion, controls, create: definition.create });
}
