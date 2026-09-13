// SDK 0.2 entry prepared for compiler version selection. The package's current
// index/discovery remain 0.1 until compilation and artifact support land.
import { normalizeControlDeclarations } from '../../runtime-contracts/src/parameters.mjs';
import type { ControlDeclarations, ControlSchema, ControlsOf } from '../../runtime-contracts/src/parameters.mjs';
import type { OutputSettings } from '../../runtime-contracts/src/index.ts';
export type { ControlDeclarations, ControlSchema, ControlsOf, NumberDeclaration } from '../../runtime-contracts/src/parameters.mjs';

export const sdkVersion = '0.2.0' as const;
export interface OutputTarget {
  readonly width: number; readonly height: number;
  readonly colorSpace: 'linear-srgb'; readonly alphaMode: 'premultiplied';
}
export interface FrameContext<C extends ControlDeclarations = ControlDeclarations> {
  readonly tick: number; readonly timeSeconds: number; readonly deltaSeconds: number;
  readonly controls: ControlsOf<C>; readonly events: readonly never[];
}
export interface VisualContext {
  readonly settings: Readonly<OutputSettings>;
  readonly assets: ReadonlyMap<string, Readonly<Uint8Array>>;
  readonly images: ReadonlyMap<string, Readonly<{ width: number; height: number; colorSpace: 'srgb'; alphaMode: 'straight'; data: Uint8Array }>>;
  random(): number;
  reportError(message: string): void;
  readonly renderer: { render(scene: unknown, camera: unknown, target: OutputTarget): void | Promise<void> };
}
export interface VisualInstance<C extends ControlDeclarations = ControlDeclarations> {
  update(frame: FrameContext<C>): void;
  render(target: OutputTarget): void | Promise<void>;
  reset(seed: number): void | Promise<void>;
  dispose(): void | Promise<void>;
}
export interface VisualDefinition<C extends ControlDeclarations = ControlDeclarations> {
  readonly sdkVersion: typeof sdkVersion;
  readonly controls: ControlSchema;
  create(context: VisualContext): Promise<VisualInstance<C>>;
}
export function defineVisual<const C extends ControlDeclarations>(definition: {
  readonly controls: C;
  create(context: VisualContext): Promise<VisualInstance<NoInfer<C>>>;
}): VisualDefinition<C> {
  if (!definition || typeof definition !== 'object' ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(definition))) throw Error('Expected a plain visual definition');
  const keys = Reflect.ownKeys(definition);
  if (keys.length !== 2 || !keys.includes('controls') || !keys.includes('create')) throw Error('Visual definition requires only controls and create');
  const controls = Object.getOwnPropertyDescriptor(definition, 'controls');
  const create = Object.getOwnPropertyDescriptor(definition, 'create');
  if (!controls?.enumerable || !Object.hasOwn(controls, 'value') || !create?.enumerable || !Object.hasOwn(create, 'value') || typeof create.value !== 'function') {
    throw Error('Visual controls and create must be enumerable own data properties; create must be a function');
  }
  return Object.freeze({ sdkVersion, controls: normalizeControlDeclarations(controls.value), create: create.value });
}
