import type {CompiledArtifact} from '../../../packages/runtime-contracts/src/index.ts';import type {SharedVisualCapsule} from './shared-link-identity.mjs';
export declare function linkSharedVisuals(visuals:readonly {readonly id:string;readonly artifact:CompiledArtifact}[],options?:{readonly dependencyRoot?:string}):Promise<SharedVisualCapsule>;
