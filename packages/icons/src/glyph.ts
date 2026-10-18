import type { IconWeight } from "./weight.ts";

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

const COMMAND = /([a-zA-Z])|(-?\d*\.?\d+(?:e-?\d+)?)/g;
const START = /^M\s*(-?[\d.]+)/;
const LETTER_GAP = / ?([a-zA-Z]) ?/g;
const NEGATIVE_GAP = / -/g;
/** What each number of a path command is: x, y, or a length. */
const PARAMS: Record<string, ("x" | "y" | "k")[]> = {
  a: ["k", "k", "k", "k", "k", "x", "y"],
  c: ["x", "y", "x", "y", "x", "y"],
  h: ["x"],
  l: ["x", "y"],
  m: ["x", "y"],
  q: ["x", "y", "x", "y"],
  s: ["x", "y", "x", "y"],
  t: ["x", "y"],
  v: ["y"],
  z: [],
};
const round = (value: number) => Number(value.toFixed(2));

/** A path drawn on a 24 grid, scaled by `scale` around the middle of the grid. */
export function scalePath(d: string, scale: number): string {
  const centre = 12 * (1 - scale);
  let command = "";
  let index = 0;
  const out: string[] = [];
  for (const [, letter, number] of d.matchAll(COMMAND)) {
    if (letter) {
      command = letter;
      index = 0;
      out.push(letter);
      continue;
    }
    const params = PARAMS[command.toLowerCase()] ?? [];
    const at = index % params.length;
    // An arc's two flags are not coordinates.
    const kind =
      command.toLowerCase() === "a" && (at === 3 || at === 4)
        ? undefined
        : params[at];
    const absolute = command === command.toUpperCase();
    let value = Number(number);
    if (kind === "x" || kind === "y") {
      value = value * scale + (absolute ? centre : 0);
    } else if (kind === "k") {
      value *= scale;
    }
    out.push(String(round(value)));
    index += 1;
  }
  return out.join(" ").replace(LETTER_GAP, "$1").replace(NEGATIVE_GAP, "-");
}

/**
 * A curve in every weight: a line in the thin ones, the line over a tint of
 * the area under it in duotone, and a solid screen with the curve cut out of
 * it in fill. The thin weights keep the full width of the grid.
 */
export function curve(d: string, baseline = 20): Shape[] {
  const start = d.match(START)?.[1] ?? "2";
  return [
    path(`${d}V${baseline}H${start}z`, {
      backdrop: true,
      weights: ["duotone"],
    }),
    path(d, { weights: ["regular", "bold", "duotone"] }),
    rect(3, 5, 18, 14, 3, { tint: true, weights: ["fill"] }),
    path(scalePath(d, 0.7), { knock: true, weights: ["fill"] }),
  ];
}
