export type Paths2DPortDescriptor = Readonly<{
  kind: 'paths2d';
  version: 1;
  coordinateSpace: 'canvas-height';
}>;

export type Paths2DPoint = Readonly<{
  x: number;
  y: number;
  width: number;
  distance: number;
  depositionTime: number;
}>;

export type Paths2DPath = Readonly<{
  id: number;
  generation: number;
  styleSeed: number;
  birthTime: number;
  lifetime: number;
  phase: number;
  opacity: number;
  points: readonly Paths2DPoint[];
}>;

export type Paths2DSnapshot = Readonly<{
  version: 1;
  paths: readonly Paths2DPath[];
}>;

export const PATHS2D_PORT_DESCRIPTOR: Paths2DPortDescriptor;
export function normalizePaths2DSnapshot(input: unknown): Paths2DSnapshot;
