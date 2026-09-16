import {normalizeComponentDeclaration} from '../../runtime-contracts/src/components.mjs';
import type {ComponentDeclaration,ComponentMetadata} from '../../runtime-contracts/src/components.mjs';
import type {ControlDeclarations,ControlsOf} from '../../runtime-contracts/src/parameters.mjs';
import type {Paths2DSnapshot} from '../../runtime-contracts/src/paths2d.mjs';
import type {ShaderFieldSnapshot} from '../../runtime-contracts/src/shader-field.mjs';
import type {OutputSettings} from '../../runtime-contracts/src/index.ts';
export const sdkVersion='0.4.0' as const;
declare const imageResourceBrand:unique symbol;
declare const paths2dResourceBrand:unique symbol;
declare const shaderFieldResourceBrand:unique symbol;
export interface ShaderFieldResource {readonly [shaderFieldResourceBrand]:true;readonly data:ShaderFieldSnapshot}
export interface ImageResource {readonly [imageResourceBrand]:true;readonly width:number;readonly height:number;readonly colorSpace:'linear-srgb';readonly alphaMode:'premultiplied';readonly texture:unknown}
export interface Paths2DResource {readonly [paths2dResourceBrand]:true;readonly data:Paths2DSnapshot}
export interface ComponentFrame<C extends ControlDeclarations=ControlDeclarations>{readonly tick:number;readonly timeSeconds:number;readonly deltaSeconds:number;readonly controls:ControlsOf<C>;readonly events:readonly never[]}
export interface ComponentContext {readonly settings:Readonly<OutputSettings>;readonly assets:ReadonlyMap<string,Readonly<Uint8Array>>;readonly images:ReadonlyMap<string,Readonly<{width:number;height:number;colorSpace:'srgb';alphaMode:'straight';data:Uint8Array}>>;random():number;reportError(message:string):void}
export type ImageInputs=Readonly<Record<string,ImageResource>>;
type PortDeclarations=ComponentDeclaration['inputs'];
type LegacyImagePort={readonly type:{readonly kind:'image';readonly colorSpace:'linear-srgb';readonly alphaMode:'premultiplied'};readonly label:string;readonly description:string};
type LegacyImageInputs=Readonly<Record<string,LegacyImagePort>>;
type LegacyImageOutputs={readonly image:LegacyImagePort};
export type ResourceForPort<P extends PortDeclarations[string]['type']>=P extends {readonly kind:'image'}?ImageResource:P extends {readonly kind:'paths2d'}?Paths2DResource:P extends {readonly kind:'shader-field'}?ShaderFieldResource:never;
export type PortResources<P extends PortDeclarations>=Readonly<{readonly [K in keyof P]:ResourceForPort<P[K]['type']>}>;
type PortIdsOfKind<P extends PortDeclarations,K extends string>={[I in keyof P]:P[I]['type']['kind'] extends K?I:never}[keyof P]&string;
type IsAny<T>=0 extends (1&T)?true:false;
type RenderArguments<O extends PortDeclarations>=IsAny<O> extends true?[scene:unknown,camera:unknown,portId?:string]:'image' extends PortIdsOfKind<O,'image'>?[scene:unknown,camera:unknown,portId?:PortIdsOfKind<O,'image'>]:[scene:unknown,camera:unknown,portId:PortIdsOfKind<O,'image'>];
export interface EvaluationContext<O extends PortDeclarations=any>{render(...arguments_:RenderArguments<O>):Promise<ImageResource>;paths(portId:PortIdsOfKind<O,'paths2d'>,snapshot:Paths2DSnapshot):Paths2DResource;shaderField(portId:PortIdsOfKind<O,'shader-field'>,snapshot:ShaderFieldSnapshot):ShaderFieldResource}
export interface ComponentInstance<C extends ControlDeclarations=ControlDeclarations,I extends PortDeclarations=LegacyImageInputs,O extends PortDeclarations=LegacyImageOutputs>{update(frame:ComponentFrame<C>):void;evaluate(inputs:PortResources<I>,context:EvaluationContext<O>):Promise<PortResources<O>>;reset(seed:number):void|Promise<void>;dispose():void|Promise<void>}
export interface ComponentDefinition<C extends ControlDeclarations=ControlDeclarations,I extends PortDeclarations=LegacyImageInputs,O extends PortDeclarations=LegacyImageOutputs>{readonly kind:'component';readonly sdkVersion:'0.4.0';readonly metadata:Omit<ComponentMetadata,'inputs'|'outputs'>&{readonly inputs:I;readonly outputs:O};create(context:ComponentContext):Promise<ComponentInstance<C,I,O>>}
export function defineComponent<const C extends ControlDeclarations,const I extends PortDeclarations,const O extends PortDeclarations>(definition:{readonly metadata:Omit<ComponentDeclaration,'inputs'|'outputs'|'controls'|'controlDescriptions'>&{readonly inputs:I;readonly outputs:O;readonly controls:C;readonly controlDescriptions:{readonly [K in keyof C]:string}};create(context:ComponentContext):Promise<ComponentInstance<NoInfer<C>,NoInfer<I>,NoInfer<O>>>}):ComponentDefinition<C,I,O>{
 if(!definition||![Object.prototype,null].includes(Object.getPrototypeOf(definition)))throw Error('Expected plain component definition');const keys=Reflect.ownKeys(definition),metadata=Object.getOwnPropertyDescriptor(definition,'metadata'),create=Object.getOwnPropertyDescriptor(definition,'create');if(keys.length!==2||!metadata?.enumerable||!Object.hasOwn(metadata,'value')||!create?.enumerable||!Object.hasOwn(create,'value')||typeof create.value!=='function')throw Error('Component requires only own metadata and create data properties');return Object.freeze({kind:'component',sdkVersion,metadata:normalizeComponentDeclaration(metadata.value),create:create.value}) as ComponentDefinition<C,I,O>;
}
type Node={readonly id:string;readonly definition:string};type Ref={readonly nodeId:string;readonly portId:string};type Edge={readonly id:string;readonly from:Ref;readonly to:Ref;readonly delay:'none'};type Exposure={readonly id:string;readonly nodeId:string;readonly controlId:string};
export interface CompositionDefinition{readonly kind:'composition';readonly sdkVersion:'0.4.0';readonly label?:string;readonly definitions:Readonly<Record<string,ComponentDefinition<any,any,any>|CompositionDefinition>>;readonly nodes:readonly Node[];readonly edges:readonly Edge[];readonly input?:Ref;readonly output:Ref;readonly expose:readonly Exposure[]}
export function defineComposition(definition:Omit<CompositionDefinition,'kind'|'sdkVersion'>):CompositionDefinition{
 if(!definition||![Object.prototype,null].includes(Object.getPrototypeOf(definition)))throw Error('Expected plain composition definition');const required=['definitions','nodes','edges','output','expose'],allowed=[...required,'input','label'],keys=Reflect.ownKeys(definition);if(keys.some(k=>typeof k!=='string'||!allowed.includes(k))||required.some(k=>!Object.getOwnPropertyDescriptor(definition,k)?.enumerable||!Object.hasOwn(Object.getOwnPropertyDescriptor(definition,k)!,'value'))||keys.some(k=>!Object.getOwnPropertyDescriptor(definition,k)?.enumerable||!Object.hasOwn(Object.getOwnPropertyDescriptor(definition,k)!,'value')))throw Error('Composition requires literal data fields');return Object.freeze({kind:'composition',sdkVersion,...definition});
}
