import type { LibraryComponent, LibraryComponentSummary, LibraryDependency } from '../../../packages/core/src/component-library.ts';
import type { SourceBundle } from '../../../packages/runtime-contracts/src/index.ts';

export interface ComponentLibraryClient {
  location?():Promise<Readonly<{root:string;kind:'repository'|'fallback'|'test';seedRoots:readonly string[]}>>;
  list(): Promise<readonly LibraryComponentSummary[]>;
  read(id:string,revision?:number): Promise<LibraryComponent>;
  create(input:{name:string;description:string;source:SourceBundle;dependencies?:readonly LibraryDependency[]}):Promise<LibraryComponent>;
  update(input:{id:string;expectedRevision:number;name:string;description:string;source:SourceBundle;dependencies?:readonly LibraryDependency[]}):Promise<LibraryComponent>;
  copyRequest(id:string):Promise<string>;
}

declare global { interface Window { luxLibrary: ComponentLibraryClient } }
