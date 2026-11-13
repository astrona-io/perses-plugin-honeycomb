import { CellShape } from "./honeycomb-chart-types";

/** Cell radius limits (px) when the size fits the panel. */
export const MIN_RADIUS = 5;
export const MAX_RADIUS = 30;
const RADIUS_STEP = 0.5;
/** Space between groups. */
export const GROUP_GAP = 12;
/** Height of a group's title. */
export const HEADER_HEIGHT = 18;
/** A group is at least this wide (or the panel width) so its title stays readable. */
const MIN_TITLE_WIDTH = 128;
/** Gap between neighbouring cells. */
const CELL_GAP = 1.5;

export interface Geometry {
  /** Horizontal distance between cell centres. */
  colStep: number;
  /** Vertical distance between row centres. */
  rowStep: number;
  /** Shift of every odd row (hexagons interlock). */
  oddOffset: number;
  cellWidth: number;
  cellHeight: number;
}

export function geometry(shape: CellShape, radius: number): Geometry {
  if (shape === "square") {
    const side = radius * 1.7;
    return {
      colStep: side + CELL_GAP,
      rowStep: side + CELL_GAP,
      oddOffset: 0,
      cellWidth: side,
      cellHeight: side,
    };
  }
  // Pointy-top hexagons.
  const w = Math.sqrt(3) * radius;
  return {
    colStep: w + CELL_GAP,
    rowStep: radius * 1.5 + CELL_GAP,
    oddOffset: (w + CELL_GAP) / 2,
    cellWidth: w,
    cellHeight: radius * 2,
  };
}

export interface GroupBox {
  x: number;
  y: number;
  width: number;
  height: number;
  cols: number;
}

export interface Layout {
  radius: number;
  geometry: Geometry;
  boxes: GroupBox[];
  height: number;
}

/** Lays groups out left to right, wrapping like text. `sizes` are the cell counts per group. */
export function layoutAt(
  sizes: number[],
  width: number,
  shape: CellShape,
  radius: number,
  headers: boolean,
): Layout {
  const g = geometry(shape, radius);
  const header = headers ? HEADER_HEIGHT : 0;
  const boxes: GroupBox[] = [];
  let x = 0;
  let y = 0;
  let line = 0;
  for (const n of sizes) {
    const fit = Math.floor((width - g.oddOffset - g.cellWidth) / g.colStep) + 1;
    const cols = Math.max(1, Math.min(n, fit));
    const rows = Math.ceil(n / cols);
    const cellsWidth =
      (cols - 1) * g.colStep + g.cellWidth + (rows > 1 ? g.oddOffset : 0);
    const boxWidth = headers
      ? Math.max(cellsWidth, Math.min(width, MIN_TITLE_WIDTH))
      : cellsWidth;
    const boxHeight = header + (rows - 1) * g.rowStep + g.cellHeight;
    if (x > 0 && x + boxWidth > width) {
      x = 0;
      y += line + GROUP_GAP;
      line = 0;
    }
    boxes.push({ x, y, width: boxWidth, height: boxHeight, cols });
    x += boxWidth + GROUP_GAP;
    line = Math.max(line, boxHeight);
  }
  return { radius, geometry: g, boxes, height: y + line };
}

/**
 * The largest radius whose layout fits the panel, or `fixed` when set. When even the smallest
 * radius overflows, the panel scrolls.
 */
export function fitLayout(
  sizes: number[],
  width: number,
  height: number,
  shape: CellShape,
  headers: boolean,
  fixed?: number,
): Layout {
  if (fixed !== undefined && fixed > 0)
    return layoutAt(sizes, width, shape, fixed, headers);
  for (let r = MAX_RADIUS; r > MIN_RADIUS; r -= RADIUS_STEP) {
    const l = layoutAt(sizes, width, shape, r, headers);
    if (l.height <= height) return l;
  }
  return layoutAt(sizes, width, shape, MIN_RADIUS, headers);
}

/** Centre of the i-th cell inside its group box, relative to the box. */
export function cellCentre(
  i: number,
  cols: number,
  g: Geometry,
  header: number,
): [number, number] {
  const row = Math.floor(i / cols);
  const col = i % cols;
  return [
    g.cellWidth / 2 + col * g.colStep + (row % 2 === 1 ? g.oddOffset : 0),
    header + g.cellHeight / 2 + row * g.rowStep,
  ];
}

/** SVG points of a pointy-top hexagon. */
export function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 90);
    pts.push(
      `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`,
    );
  }
  return pts.join(" ");
}
