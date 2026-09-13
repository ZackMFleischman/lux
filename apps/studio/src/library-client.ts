import type { LibraryComponent, LibraryComponentSummary } from '../../../packages/core/src/component-library.ts';
import type { SourceBundle } from '../../../packages/runtime-contracts/src/index.ts';

export interface ComponentLibraryClient {
  list(): Promise<readonly LibraryComponentSummary[]>;
  read(id:string): Promise<LibraryComponent>;
  create(input:{name:string;description:string;source:SourceBundle}):Promise<LibraryComponent>;
  update(input:{id:string;expectedRevision:number;name:string;description:string;source:SourceBundle}):Promise<LibraryComponent>;
  copyRequest(id:string):Promise<string>;
}

declare global { interface Window { luxLibrary: ComponentLibraryClient } }
