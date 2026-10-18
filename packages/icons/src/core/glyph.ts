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

export interface CurveOptions {
  /** The start of the input, at the left of the grid. @default -1 */
  from?: number;
  /** The top of the output, at the top of the grid. @default 1 */
  max?: number;
  /** The bottom of the output, at the bottom of the grid. @default -1 */
  min?: number;
  /** How many points the line is drawn with. @default 25 */
  samples?: number;
  /** The end of the input, at the right of the grid. @default 1 */
  to?: number;
}

const MARGIN = 3;
const SPAN = 18;
const trim = (value: number) => Number(value.toFixed(2));

/**
 * The glyph of a function: its curve over `from` to `to`, drawn on the 24 grid
 * with the 3px margin of the other icons, output up the page. An output out of
 * `min` to `max` is held at the edge. A device's own function gives a button
 * that draws what the device does, in the style of the rest of the icons.
 */
export function curveGlyph(
  shape: (input: number) => number,
  { from = -1, max = 1, min = -1, samples = 25, to = 1 }: CurveOptions = {}
): Glyph {
  const points = Array.from({ length: samples }, (_, index) => {
    const input = from + (index / (samples - 1)) * (to - from);
    const output = Math.max(min, Math.min(max, shape(input)));
    const x = MARGIN + ((input - from) / (to - from)) * SPAN;
    const y = MARGIN + ((max - output) / (max - min)) * SPAN;
    return `${index === 0 ? "M" : "L"}${trim(x)} ${trim(y)}`;
  });
  return curve(points.join(""), MARGIN + SPAN);
}
