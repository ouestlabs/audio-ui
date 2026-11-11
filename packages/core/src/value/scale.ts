import { clamp } from "../shared/math.ts";

/**
 * How a value maps onto a control's travel, and back. `toPosition` gives
 * where `value` sits along the travel, from 0 at `min` to 1 at `max`;
 * `toValue` is its inverse.
 */
export interface ParameterScale {
  toPosition: (value: number, min: number, max: number) => number;
  toValue: (position: number, min: number, max: number) => number;
}

/** Even steps: the right feel for levels, times and anything heard in differences. */
export const LINEAR_SCALE: ParameterScale = {
  toPosition: (value, min, max) =>
    clamp((value - min) / (max - min || 1), 0, 1),
  toValue: (position, min, max) => min + clamp(position, 0, 1) * (max - min),
};

/**
 * Even ratios: the right feel for frequency, Q, ratios and times heard in
 * proportions, where a linear sweep hides the useful range in its first few
 * degrees. Needs a positive `min`; below that it falls back to linear.
 */
export const LOGARITHMIC_SCALE: ParameterScale = {
  toPosition: (value, min, max) => {
    if (!(min > 0 && max > min)) {
      return LINEAR_SCALE.toPosition(value, min, max);
    }
    const clamped = clamp(value, min, max);
    return Math.log(clamped / min) / Math.log(max / min);
  },
  toValue: (position, min, max) => {
    if (!(min > 0 && max > min)) {
      return LINEAR_SCALE.toValue(position, min, max);
    }
    return min * (max / min) ** clamp(position, 0, 1);
  },
};

/** A scale as an option takes it: `"linear"`, `"log"`, or a scale of your own. */
export type ParameterScaleProp = "linear" | "log" | ParameterScale;

/** The scale an option names: `"linear"` and `"log"` as `LINEAR_SCALE` and `LOGARITHMIC_SCALE`, a scale of your own as it is. */
export function resolveScale(scale: ParameterScaleProp): ParameterScale {
  if (scale === "log") {
    return LOGARITHMIC_SCALE;
  }
  return scale === "linear" ? LINEAR_SCALE : scale;
}
