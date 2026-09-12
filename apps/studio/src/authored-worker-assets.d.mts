/** Trusted pre-import worker operation. The importer must be supplied by runtime code. */
export function loadAuthoredModule<T>(message:unknown,importModule:(code:string)=>Promise<T>):Promise<{module:T;assets:ReadonlyMap<string,Readonly<Uint8Array>>}>;
