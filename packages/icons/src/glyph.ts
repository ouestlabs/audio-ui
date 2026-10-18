/** One shape of a glyph, on a 24 grid. */
export interface Shape {
  attrs: Record<string, number | string>;
  /** Drawn only in the duotone weight, as a tint without a stroke: what lines need to have a body. */
  backdrop?: true;
  /** A tile that frames a curve: drawn faint, and solid in the fill weight. */
  faint?: true;
  /** A detail inside a solid shape: the fill weight cuts it out of the shape. */
  knock?: true;
  tag: "circle" | "path" | "rect";
  /** A closed shape that takes the tint of the duotone weight and is solid in the fill weight. */
  tint?: true;
}

/** What an icon draws: shapes in one thin stroke. */
export type Glyph = readonly Shape[];

interface Options {
  backdrop?: true;
  faint?: true;
  knock?: true;
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

const COMMAND = /([a-zA-Z])|(-?\d*\.?\d+(?:e-?\d+)?)/g;
/** How many numbers a path command takes, and which of them are x, y or a length. */
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
const LETTER_GAP = / ?([a-zA-Z]) ?/g;
const NEGATIVE_GAP = / -/g;
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

/** The tile a curve is drawn on, like the screen of a plugin. */
export const screen = (): Shape =>
  rect(3, 5, 18, 14, 3, { faint: true, tint: true });

/** A curve on its screen: cut out of the tile in the fill weight. */
export const curve = (d: string): Shape =>
  path(scalePath(d, 0.7), { knock: true });
