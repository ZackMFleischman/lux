// Internal root-output profile. Public Studio admission remains SDK 0.1/0.2.
import { normalizeComponentDeclaration } from '../../runtime-contracts/src/components.mjs';
import type { ComponentDeclaration, ComponentMetadata } from '../../runtime-contracts/src/components.mjs';
import type { ControlDeclarations, ControlsOf } from '../../runtime-contracts/src/parameters.mjs';
import type { OutputSettings } from '../../runtime-contracts/src/index.ts';
export const sdkVersion = '0.3.0' as const;
declare const imageResourceBrand: unique symbol;
export interface ImageResource {
  readonly [imageResourceBrand]: true;
  readonly width: number; readonly height: number;
  readonly colorSpace: 'linear-srgb'; readonly alphaMode: 'premultiplied';
}
export type EmptyInputs = Readonly<Record<string, never>>;
export interface EvaluationContext { render(scene: unknown, camera: unknown): Promise<ImageResource> }
export interface ComponentFrame<C extends ControlDeclarations = ControlDeclarations> {
  readonly tick: number; readonly timeSeconds: number; readonly deltaSeconds: number;
  readonly controls: ControlsOf<C>; readonly events: readonly never[];
}
export interface ComponentContext {
  readonly settings: Readonly<OutputSettings>;
  readonly assets: ReadonlyMap<string, Readonly<Uint8Array>>;
  readonly images: ReadonlyMap<string, Readonly<{width:number;height:number;colorSpace:'srgb';alphaMode:'straight';data:Uint8Array}>>;
  random(): number; reportError(message: string): void;
}
export interface ComponentInstance<C extends ControlDeclarations = ControlDeclarations> {
  update(frame: ComponentFrame<C>): void;
  evaluate(inputs: EmptyInputs, context: EvaluationContext): Promise<Readonly<{image:ImageResource}>>;
  reset(seed:number): void | Promise<void>; dispose(): void | Promise<void>;
}
export interface ComponentDefinition<C extends ControlDeclarations = ControlDeclarations> {
  readonly kind:'component'; readonly sdkVersion:'0.3.0'; readonly metadata:ComponentMetadata;
  create(context:ComponentContext): Promise<ComponentInstance<C>>;
}
export function defineComponent<const C extends ControlDeclarations>(definition:{
  readonly metadata:Omit<ComponentDeclaration,'controls'|'controlDescriptions'> & {
    readonly controls:C; readonly controlDescriptions:{readonly [K in keyof C]:string};
  };
  create(context:ComponentContext):Promise<ComponentInstance<NoInfer<C>>>;
}):ComponentDefinition<C> {
  if(!definition || ![Object.prototype,null].includes(Object.getPrototypeOf(definition))) throw Error('Expected plain component definition');
  const keys=Reflect.ownKeys(definition), metadata=Object.getOwnPropertyDescriptor(definition,'metadata'), create=Object.getOwnPropertyDescriptor(definition,'create');
  if(keys.length!==2 || !metadata?.enumerable || !Object.hasOwn(metadata,'value') || !create?.enumerable || !Object.hasOwn(create,'value') || typeof create.value!=='function') throw Error('Component requires only own metadata and create data properties');
  return Object.freeze({kind:'component',sdkVersion,metadata:normalizeComponentDeclaration(metadata.value),create:create.value});
}
