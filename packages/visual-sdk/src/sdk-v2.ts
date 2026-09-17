// SDK 0.2 entry prepared for compiler version selection. The package's current
// index/discovery remain 0.1 until compilation and artifact support land.
import { normalizeControlDeclarations } from '../../runtime-contracts/src/parameters.mjs';
import { normalizeStoryCapabilityDeclaration } from '../../runtime-contracts/src/story.mjs';
import type { ControlDeclarations, ControlSchema, ControlsOf, ControlTriggerEvent, NumberControlIdsOf, ValidControlDeclarations } from '../../runtime-contracts/src/parameters.mjs';
import type { StoryBeatIdsOf, StoryCapabilityDeclaration, StoryCapabilityV1, StoryFrame } from '../../runtime-contracts/src/story.mjs';
import type { OutputSettings } from '../../runtime-contracts/src/index.ts';
export type {
  BooleanControlDefinition, BooleanDeclaration, ControlDeclaration, ControlDeclarations, ControlDefinition, ControlSchema,
  ControlsOf, ControlValue, ControlValues, EnumControlDefinition, EnumDeclaration, EnumOption, EnumPresentation,
  NumberControlDefinition, NumberControlIdsOf, NumberDeclaration, TriggerControlDefinition, TriggerDeclaration, TriggerIdsOf, ControlTriggerEvent,
} from '../../runtime-contracts/src/parameters.mjs';
export type {
  BeatTiming, SceneStoryV1, StoryActiveFrame, StoryBeat, StoryBeatCapability, StoryBeatIdsOf,
  StoryCapabilityDeclaration, StoryCapabilityV1, StoryFollow, StoryFrame, StoryNormalFrame, StoryOccurrence,
} from '../../runtime-contracts/src/story.mjs';

export const sdkVersion = '0.2.0' as const;
export interface OutputTarget {
  readonly width: number; readonly height: number;
  readonly colorSpace: 'linear-srgb'; readonly alphaMode: 'premultiplied';
}
export interface FrameContext<C extends ControlDeclarations = ControlDeclarations, S extends StoryCapabilityDeclaration | undefined = undefined> {
  readonly tick: number; readonly timeSeconds: number; readonly deltaSeconds: number;
  readonly controls: ControlsOf<C>; readonly events: readonly ControlTriggerEvent<C>[];
  readonly story: StoryFrame<S extends StoryCapabilityDeclaration ? StoryBeatIdsOf<S> : string>;
  readonly sampleControl?: (controlId: NumberControlIdsOf<C>, instanceKey: string | number) => number;
}
export interface VisualContext {
  readonly settings: Readonly<OutputSettings>;
  readonly assets: ReadonlyMap<string, Readonly<Uint8Array>>;
  readonly images: ReadonlyMap<string, Readonly<{ width: number; height: number; colorSpace: 'srgb'; alphaMode: 'straight'; data: Uint8Array }>>;
  random(): number;
  reportError(message: string): void;
  readonly renderer: { render(scene: unknown, camera: unknown, target: OutputTarget): void | Promise<void> };
}
export interface VisualInstance<C extends ControlDeclarations = ControlDeclarations, S extends StoryCapabilityDeclaration | undefined = undefined> {
  update(frame: FrameContext<C,S>): void;
  render(target: OutputTarget): void | Promise<void>;
  reset(seed: number): void | Promise<void>;
  dispose(): void | Promise<void>;
}
export type VisualDefinition<C extends ControlDeclarations = any, S extends StoryCapabilityDeclaration | undefined = any> = {
  readonly sdkVersion: typeof sdkVersion;
  readonly controls: ControlSchema;
  create(context: VisualContext): Promise<VisualInstance<C,S>>;
} & (S extends StoryCapabilityDeclaration ? {readonly story: StoryCapabilityV1} : {});
export function defineVisual<const C extends ControlDeclarations, const S extends StoryCapabilityDeclaration>(definition: {
  readonly controls: C & ValidControlDeclarations<C>;
  readonly story: S;
  create(context: VisualContext): Promise<VisualInstance<NoInfer<C>,NoInfer<S>>>;
}): VisualDefinition<C,S>;
export function defineVisual<const C extends ControlDeclarations>(definition: {
  readonly controls: C & ValidControlDeclarations<C>;
  create(context: VisualContext): Promise<VisualInstance<NoInfer<C>,undefined>>;
}): VisualDefinition<C,undefined>;
export function defineVisual(definition: {
  readonly controls: ControlDeclarations;
  readonly story?: StoryCapabilityDeclaration;
  create(context: VisualContext): Promise<VisualInstance>;
}): VisualDefinition {
  if (!definition || typeof definition !== 'object' ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(definition))) throw Error('Expected a plain visual definition');
  const keys = Reflect.ownKeys(definition);
  if (![2,3].includes(keys.length) || !keys.includes('controls') || !keys.includes('create') || (keys.length===3&&!keys.includes('story'))) throw Error('Visual definition requires controls, optional story, and create');
  const controls = Object.getOwnPropertyDescriptor(definition, 'controls');
  const create = Object.getOwnPropertyDescriptor(definition, 'create');
  if (!controls?.enumerable || !Object.hasOwn(controls, 'value') || !create?.enumerable || !Object.hasOwn(create, 'value') || typeof create.value !== 'function') {
    throw Error('Visual controls and create must be enumerable own data properties; create must be a function');
  }
  if(keys.includes('story')) {
    const story=Object.getOwnPropertyDescriptor(definition,'story');
    if(!story?.enumerable||!Object.hasOwn(story,'value')) throw Error('Visual story must be an enumerable own data property');
    return Object.freeze({sdkVersion,controls:normalizeControlDeclarations(controls.value),story:normalizeStoryCapabilityDeclaration(story.value),create:create.value});
  }
  return Object.freeze({ sdkVersion, controls: normalizeControlDeclarations(controls.value), create: create.value });
}
