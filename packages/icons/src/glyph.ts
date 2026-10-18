/** One shape of a glyph, on a 24 grid. */
export interface Shape {
  attrs: Record<string, number | string>;
  /** Drawn only in the duotone weight, as a tint without a stroke: what lines need to have a body. */
  backdrop?: true;
  tag: "circle" | "path" | "rect";
  /** A closed shape that takes the tint of the duotone weight. */
  tint?: true;
}

/** What an icon draws: shapes in one thin stroke. */
export type Glyph = readonly Shape[];

interface Options {
  backdrop?: true;
  tint?: true;
}

export const path = (d: string, options: Options = {}): Shape => ({
  attrs: { d },
  tag: "path",
  ...options,
});

export const circle = (
  cx: number,
  cy: number,
  r: number,
  options: Options = {}
): Shape => ({ attrs: { cx, cy, r }, tag: "circle", ...options });

export const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  options: Options = {}
): Shape => ({ attrs: { height, rx, width, x, y }, tag: "rect", ...options });
