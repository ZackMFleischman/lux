export const limits: Readonly<{
  sourceBytes: number; files: number; diagnosticBytes: number;
  compileMs: number; outputBytes: number;
}>;
export function violation(message: string, code?: string): Error & { code: string };
export function validateSource(source: unknown): {
  sdkVersion: '0.1.0'; entry: string; files: Record<string, string>;
};
