/**
 * How the glyph is drawn, as Phosphor names its weights. `regular` is the thin
 * line, `bold` a thicker one, `duotone` the line over a tint of the same
 * color, and `fill` a solid shape with its details cut out of it.
 */
export type IconWeight = "bold" | "duotone" | "fill" | "regular";

export const WEIGHTS: readonly IconWeight[] = [
  "regular",
  "bold",
  "duotone",
  "fill",
];

export const STROKE_WIDTH: Record<IconWeight, number> = {
  bold: 2.25,
  duotone: 1.5,
  fill: 1.5,
  regular: 1.5,
};

export const TINT_OPACITY = 0.2;

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
  /** Drawn only in these weights, so a glyph can be a line in one and a body in another. */
  weights?: readonly IconWeight[];
}

/** What an icon draws: shapes in one thin stroke. */
export type Glyph = readonly Shape[];

interface Options {
  backdrop?: true;
  knock?: true;
  over?: true;
  tint?: true;
  weights?: readonly IconWeight[];
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

const START = /^M\s*(-?[\d.]+)/;

/**
 * A curve in every weight: a line, over a tint of the area under it in
 * duotone. A line has no body to fill, so its fill weight is the bold line.
 */
export function curve(d: string, baseline = 20): Shape[] {
  const start = d.match(START)?.[1] ?? "2";
  return [
    path(`${d}V${baseline}H${start}z`, {
      backdrop: true,
      weights: ["duotone"],
    }),
    path(d),
  ];
}
