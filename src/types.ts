export type Point = [number, number];

export type PathSegment =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'Q'; cx: number; cy: number; x: number; y: number }
  | { type: 'C'; cx1: number; cy1: number; cx2: number; cy2: number; x: number; y: number }
  | { type: 'Z' };

export type GroupId =
  | 'p1'
  | 'p2'
  | 'pm'
  | 'pg'
  | 'cm'
  | 'pmm'
  | 'pmg'
  | 'cmm'
  | 'p4'
  | 'p4m'
  | 'p4g'
  | 'p3'
  | 'p3m1'
  | 'p31m'
  | 'p6'
  | 'p6m';

export interface StyleSpec {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

/**
 * A color role is finite metadata shared by derived instances. `null` means the
 * corresponding value is inherited from the single source object, keeping the
 * identity role and old monochrome projects bit-for-bit equivalent.
 */
export interface ColorRole {
  id: string;
  name: string;
  fill: string | null;
  stroke: string | null;
  opacity: number | null;
}

/** Full role permutation for each generator symbol. */
export interface ColorConfig {
  roles: ColorRole[];
  generatorPermutations: Record<string, Record<string, string>>;
}

export interface ColorSupercell {
  /** Number of primitive cells in the rectangular color period. */
  repeats: [number, number];
  baseCells: [number, number];
  width: number;
  height: number;
}

export interface PatternObject extends StyleSpec {
  id: string;
  name: string;
  path: PathSegment[];
}

export interface Project {
  id: string;
  name: string;
  group: GroupId;
  cellWidth: number;
  cellHeight: number;
  colorConfig: ColorConfig;
  colorSupercell: ColorSupercell;
  objects: PatternObject[];
  updatedAt: number;
}

export type Tool = 'select' | 'node' | 'pen' | 'rectangle' | 'ellipse';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface RenderOptions {
  showDomain: boolean;
  showGrid: boolean;
  showSymmetry: boolean;
  showHandles: boolean;
}
