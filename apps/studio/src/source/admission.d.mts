import type { SourceBundle } from '../../../../packages/runtime-contracts/src/index.ts';
export interface AdmissionWorkerEvent { data?: unknown; message?: string; }
export interface AdmissionWorker {
  postMessage(message: unknown): void;
  addEventListener(type: 'message' | 'error' | 'messageerror', listener: (event: AdmissionWorkerEvent) => void): void;
  removeEventListener(type: 'message' | 'error' | 'messageerror', listener: (event: AdmissionWorkerEvent) => void): void;
  terminate(): void;
}
/** Trusted host capability; never accepted from source or other wire DTOs.
 * Return a fresh dedicated worker per call, never shared or reused. */
export type AdmissionWorkerFactory = () => AdmissionWorker;
export interface SourceAdmissionSession {
  admit(source: unknown): SourceBundle;
  edit(ownedSource: SourceBundle, files: Readonly<Record<string,string>>): SourceBundle;
  admitAsync(source: unknown, createWorker: AdmissionWorkerFactory, timeoutMs?: number): Promise<SourceBundle>;
}
export function createSourceAdmissionSession(): SourceAdmissionSession;
