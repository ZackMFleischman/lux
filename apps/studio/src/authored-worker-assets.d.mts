/** Trusted pre-import worker operation. The importer must be supplied by runtime code. */
export function loadAuthoredModule<T>(message:unknown,importModule:(code:string)=>Promise<T>):Promise<{module:T;assets:ReadonlyMap<string,Readonly<Uint8Array>>;images:ReadonlyMap<string,import('../../../packages/assets/src/index.mjs').DecodedImage>}>;

export function prepareAuthoredModule(message:unknown):Promise<{readonly admission:Readonly<{kind:'legacy'|'visual'|'component';sdkVersion?:string;component?:import('../../../packages/runtime-contracts/src/components.mjs').ComponentMetadata;controls?:import('../../../packages/runtime-contracts/src/parameters.mjs').ControlSchema;controlSchemaHash?:string}>;import<T>(importer:(code:string)=>Promise<T>):ReturnType<typeof loadAuthoredModule<T>>}>;
