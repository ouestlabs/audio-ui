/**
 * How heavy the stroke is, as Phosphor names its weights. `regular` is the
 * thin line, `bold` a thicker one, and `duotone` the line over a tint of the
 * same color.
 */
export type IconWeight = "bold" | "duotone" | "regular";

export const WEIGHTS: readonly IconWeight[] = ["regular", "bold", "duotone"];

export const STROKE_WIDTH: Record<IconWeight, number> = {
  bold: 2.25,
  duotone: 1.5,
  regular: 1.5,
};

export const TINT_OPACITY = 0.2;
