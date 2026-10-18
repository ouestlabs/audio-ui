/** One shape of a glyph, on a 24 grid. */
export interface Shape {
  attrs: Record<string, number | string>;
  /** Drawn only in the duotone weight, as a tint without a stroke: what lines need to have a body. */
  backdrop?: true;
  /** A detail inside a solid shape: the fill weight cuts it out of the shape. */
  knock?: true;
  /** A closed shape that sits on a line: the line stops short of it, so no stroke crosses its outline. Implies tint. */
  over?: true;
  tag: "circle" | "path" | "rect";
  /** A closed shape that takes the tint of the duotone weight and is solid in the fill weight. */
  tint?: true;
}

const START = /^M\s*(-?[\d.]+)/;

/** What an icon draws: shapes in one thin stroke. */
export type Glyph = readonly Shape[];

interface Options {
  backdrop?: true;
  knock?: true;
  over?: true;
  tint?: true;
}

export const path = (d: string, options: Options = {}): Shape => ({
  attrs: { d },
  tag: "path",
  ...(options.over ? { tint: true } : {}),
  ...options,
});

export const circle = (
  cx: number,
  cy: number,
  r: number,
  options: Options = {}
): Shape => ({
  attrs: { cx, cy, r },
  tag: "circle",
  ...(options.over ? { tint: true } : {}),
  ...options,
});

export const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  options: Options = {}
): Shape => ({
  attrs: { height, rx, width, x, y },
  tag: "rect",
  ...(options.over ? { tint: true } : {}),
  ...options,
});

/** The body under a curve, down to a baseline: solid in the fill weight, tinted in the duotone one, and not drawn in the lines. */
export function area(d: string, baseline = 20): Shape {
  const start = d.match(START)?.[1] ?? "2";
  return path(`${d}V${baseline}H${start}z`, { backdrop: true });
}
