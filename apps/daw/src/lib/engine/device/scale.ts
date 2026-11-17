export interface ParameterScale {
  toPosition: (value: number, min: number, max: number) => number;
  toValue: (position: number, min: number, max: number) => number;
}

/** A scale as a parameter takes it: `"linear"`, `"log"`, or a scale of your own. */
export type ParameterScaleProp = "linear" | "log" | ParameterScale;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/** Even steps: the right feel for levels, times and anything heard in differences. */
export const LINEAR_SCALE: ParameterScale = {
  toPosition: (value, min, max) =>
    clamp((value - min) / (max - min || 1), 0, 1),
  toValue: (position, min, max) => min + clamp(position, 0, 1) * (max - min),
};

/**
 * Even ratios: the right feel for frequency, Q, ratios and times heard in
 * proportions. Needs a positive `min`; below that it falls back to linear.
 */
export const LOGARITHMIC_SCALE: ParameterScale = {
  toPosition: (value, min, max) => {
    if (!(min > 0 && max > min)) {
      return LINEAR_SCALE.toPosition(value, min, max);
    }
    return Math.log(clamp(value, min, max) / min) / Math.log(max / min);
  },
  toValue: (position, min, max) => {
    if (!(min > 0 && max > min)) {
      return LINEAR_SCALE.toValue(position, min, max);
    }
    return min * (max / min) ** clamp(position, 0, 1);
  },
};

/** The scale a parameter names: `"linear"` and `"log"` as the two above, a scale of your own as it is. */
export function resolveScale(scale: ParameterScaleProp): ParameterScale {
  if (scale === "log") {
    return LOGARITHMIC_SCALE;
  }
  return scale === "linear" ? LINEAR_SCALE : scale;
}