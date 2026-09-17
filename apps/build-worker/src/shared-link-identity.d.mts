import type {CompiledArtifact,ControlSchema,DerivedAssets} from '../../../packages/runtime-contracts/src/index.ts';
export type SharedCapsuleImport={readonly start:number;readonly end:number;readonly target:string};
export type SharedCapsuleFile={readonly path:string;readonly code:string;readonly sourceMap:string;readonly codeHash:string;readonly sourceMapHash:string;readonly imports:readonly SharedCapsuleImport[]};
export type SharedCapsuleVisual={readonly id:string;readonly entry:string;readonly sourceHash:string;readonly bundleHash:string;readonly artifactVersion:3|6;readonly sdkVersion:'0.2.0';readonly controls:ControlSchema;readonly controlSchemaHash:string;readonly assets:DerivedAssets;readonly assetSetHash:string;readonly storyCapability?:unknown;readonly storyCapabilityHash?:string};
export type SharedVisualCapsule={readonly kind:'lux-shared-visuals';readonly version:1;readonly linker:{readonly version:'0.28.2';readonly implementationHash:string;readonly apiHash:string;readonly binaryHash:string};readonly dependencyHashes:Readonly<Record<string,string>>;readonly runtimeEntry:'runtime.js';readonly visuals:readonly SharedCapsuleVisual[];readonly files:readonly SharedCapsuleFile[];readonly capsuleHash:string};
export declare function verifySharedVisuals(input:unknown,hashBytes:(bytes:Uint8Array)=>Promise<string>,expectedArtifacts?:readonly {readonly id:string;readonly artifact:CompiledArtifact}[]):Promise<SharedVisualCapsule>;
/** Binds the complete capsule and validates asset metadata/quotas without
 * decoding payloads. Complete brokered asset verification before any import. */
export declare function verifySharedVisualsStructure(input:unknown,hashBytes:(bytes:Uint8Array)=>Promise<string>):Promise<SharedVisualCapsule>;
export declare function sharedCapsuleBody(input:SharedVisualCapsule):Omit<SharedVisualCapsule,'capsuleHash'>;
export declare const sharedVisualsBody:typeof sharedCapsuleBody;
export declare const sharedRequiredDependencyKeys:readonly string[];
