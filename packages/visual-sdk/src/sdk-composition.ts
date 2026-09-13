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
export interface ComponentDefinition<C extends ControlDeclarations=ControlDeclarations>{readonly kind:'component';readonly sdkVersion:'0.4.0';readonly metadata:ComponentMetadata;create(context:ComponentContext):Promise<ComponentInstance<C>>}
export function defineComponent<const C extends ControlDeclarations>(definition:{readonly metadata:Omit<ComponentDeclaration,'controls'|'controlDescriptions'>&{readonly controls:C;readonly controlDescriptions:{readonly [K in keyof C]:string}};create(context:ComponentContext):Promise<ComponentInstance<NoInfer<C>>>}):ComponentDefinition<C>{
 if(!definition||![Object.prototype,null].includes(Object.getPrototypeOf(definition)))throw Error('Expected plain component definition');const keys=Reflect.ownKeys(definition),metadata=Object.getOwnPropertyDescriptor(definition,'metadata'),create=Object.getOwnPropertyDescriptor(definition,'create');if(keys.length!==2||!metadata?.enumerable||!Object.hasOwn(metadata,'value')||!create?.enumerable||!Object.hasOwn(create,'value')||typeof create.value!=='function')throw Error('Component requires only own metadata and create data properties');return Object.freeze({kind:'component',sdkVersion,metadata:normalizeComponentDeclaration(metadata.value),create:create.value});
}
type Node={readonly id:string;readonly definition:string};type Ref={readonly nodeId:string;readonly portId:'image'};type Edge={readonly id:string;readonly from:Ref;readonly to:Ref;readonly delay:'none'};type Exposure={readonly id:string;readonly nodeId:string;readonly controlId:string};
export interface CompositionDefinition{readonly kind:'composition';readonly sdkVersion:'0.4.0';readonly definitions:Readonly<Record<string,ComponentDefinition>>;readonly nodes:readonly Node[];readonly edges:readonly Edge[];readonly output:Ref;readonly expose:readonly Exposure[]}
export function defineComposition(definition:Omit<CompositionDefinition,'kind'|'sdkVersion'>):CompositionDefinition{
 if(!definition||![Object.prototype,null].includes(Object.getPrototypeOf(definition)))throw Error('Expected plain composition definition');const fields=['definitions','nodes','edges','output','expose'];if(Reflect.ownKeys(definition).length!==fields.length||fields.some(k=>!Object.getOwnPropertyDescriptor(definition,k)?.enumerable||!Object.hasOwn(Object.getOwnPropertyDescriptor(definition,k)!,'value')))throw Error('Composition requires literal data fields');return Object.freeze({kind:'composition',sdkVersion,...definition});
}
