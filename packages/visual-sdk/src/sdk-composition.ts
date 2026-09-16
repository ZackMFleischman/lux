import {normalizeComponentDeclaration} from '../../runtime-contracts/src/components.mjs';
import type {ComponentDeclaration,ComponentMetadata} from '../../runtime-contracts/src/components.mjs';
import type {ControlDeclarations,ControlsOf} from '../../runtime-contracts/src/parameters.mjs';
import type {OutputSettings} from '../../runtime-contracts/src/index.ts';
export const sdkVersion='0.4.0' as const;
declare const imageResourceBrand:unique symbol;
export interface ImageResource {readonly [imageResourceBrand]:true;readonly width:number;readonly height:number;readonly colorSpace:'linear-srgb';readonly alphaMode:'premultiplied';readonly texture:unknown}
export interface ComponentFrame<C extends ControlDeclarations=ControlDeclarations>{readonly tick:number;readonly timeSeconds:number;readonly deltaSeconds:number;readonly controls:ControlsOf<C>;readonly events:readonly never[]}
export interface ComponentContext {readonly settings:Readonly<OutputSettings>;readonly assets:ReadonlyMap<string,Readonly<Uint8Array>>;readonly images:ReadonlyMap<string,Readonly<{width:number;height:number;colorSpace:'srgb';alphaMode:'straight';data:Uint8Array}>>;random():number;reportError(message:string):void}
export type ImageInputs=Readonly<Record<string,ImageResource>>;
export interface EvaluationContext {render(scene:unknown,camera:unknown):Promise<ImageResource>}
export interface ComponentInstance<C extends ControlDeclarations=ControlDeclarations>{update(frame:ComponentFrame<C>):void;evaluate(inputs:ImageInputs,context:EvaluationContext):Promise<Readonly<{image:ImageResource}>>;reset(seed:number):void|Promise<void>;dispose():void|Promise<void>}
export interface CodeComponentDefinition<C extends ControlDeclarations=ControlDeclarations>{readonly kind:'component';readonly sdkVersion:'0.4.0';readonly metadata:ComponentMetadata;create(context:ComponentContext):Promise<ComponentInstance<C>>}
type CodeDeclaration<C extends ControlDeclarations>={readonly metadata:Omit<ComponentDeclaration,'controls'|'controlDescriptions'>&{readonly controls:C;readonly controlDescriptions:{readonly [K in keyof C]:string}};create(context:ComponentContext):Promise<ComponentInstance<NoInfer<C>>>};
type Node={readonly id:string;readonly definition:string};type Ref={readonly nodeId:string;readonly portId:'image'};type Edge={readonly id:string;readonly from:Ref;readonly to:Ref;readonly delay:'none'};type Exposure={readonly id:string;readonly nodeId:string;readonly controlId:string};
export interface GraphComponentDefinition{readonly kind:'composition';readonly sdkVersion:'0.4.0';readonly label?:string;readonly definitions:Readonly<Record<string,ComponentDefinition>>;readonly nodes:readonly Node[];readonly edges:readonly Edge[];readonly input?:Ref;readonly output:Ref;readonly expose:readonly Exposure[]}
export type ComponentDefinition<C extends ControlDeclarations=ControlDeclarations>=CodeComponentDefinition<C>|GraphComponentDefinition;
/** Compatibility name for the existing sealed graph representation. */
export type CompositionDefinition=GraphComponentDefinition;
export type VisualDefinition=Omit<GraphComponentDefinition,'input'>&{readonly input?:never};
type GraphDeclaration=Omit<GraphComponentDefinition,'kind'|'sdkVersion'>;
type VisualDeclaration=Omit<GraphDeclaration,'input'>&{readonly input?:never};

export function defineComponent<const C extends ControlDeclarations>(definition:CodeDeclaration<C>):CodeComponentDefinition<C>;
export function defineComponent(definition:GraphDeclaration):GraphComponentDefinition;
export function defineComponent(definition:CodeDeclaration<ControlDeclarations>|GraphDeclaration):ComponentDefinition{
 if(!definition||![Object.prototype,null].includes(Object.getPrototypeOf(definition)))throw Error('Expected plain component definition');
 if(Object.hasOwn(definition,'definitions'))return defineComposition(definition as GraphDeclaration);
 const keys=Reflect.ownKeys(definition),metadata=Object.getOwnPropertyDescriptor(definition,'metadata'),create=Object.getOwnPropertyDescriptor(definition,'create');
 if(keys.length!==2||!metadata?.enumerable||!Object.hasOwn(metadata,'value')||!create?.enumerable||!Object.hasOwn(create,'value')||typeof create.value!=='function')throw Error('Component requires only own metadata and create data properties');
 return Object.freeze({kind:'component',sdkVersion,metadata:normalizeComponentDeclaration(metadata.value),create:create.value});
}

/** A runnable graph. External image input requires a future host provider. */
export function defineVisual(definition:VisualDeclaration):VisualDefinition{
 const graph=defineComposition(definition);
 if(Object.hasOwn(graph,'input'))throw Error('Runnable visuals do not yet support external image input');
 return graph as VisualDefinition;
}

/** Existing source remains valid; prefer defineComponent or defineVisual in new code. */
export function defineComposition(definition:GraphDeclaration):CompositionDefinition{
 if(!definition||![Object.prototype,null].includes(Object.getPrototypeOf(definition)))throw Error('Expected plain composition definition');const required=['definitions','nodes','edges','output','expose'],allowed=[...required,'input','label'],keys=Reflect.ownKeys(definition);if(keys.some(k=>typeof k!=='string'||!allowed.includes(k))||required.some(k=>!Object.getOwnPropertyDescriptor(definition,k)?.enumerable||!Object.hasOwn(Object.getOwnPropertyDescriptor(definition,k)!,'value'))||keys.some(k=>!Object.getOwnPropertyDescriptor(definition,k)?.enumerable||!Object.hasOwn(Object.getOwnPropertyDescriptor(definition,k)!,'value')))throw Error('Composition requires literal data fields');return Object.freeze({kind:'composition',sdkVersion,...definition});
}
