import type {Look, LookSummary, SaveLook} from '../../../packages/core/src/look-store.ts';
export interface LookClient {
  list(): Promise<readonly LookSummary[]>;
  read(id: string): Promise<Look>;
  save(input: SaveLook): Promise<LookSummary>;
}
declare global { interface Window { luxLooks: LookClient } }
