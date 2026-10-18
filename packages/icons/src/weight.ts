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
