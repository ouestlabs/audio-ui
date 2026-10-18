/**
 * How a level in dB is spread along the meter's length: evenly, or the way
 * digital peak meters spread it, with room at the top where it matters.
 */
export type LevelScale = "iec" | "linear" | LevelScaleFunction;

/** A custom curve: any increasing function of the level, rescaled to the meter's range. */
export type LevelScaleFunction = (level: number) => number;

/**
 * The deflection of an IEC 60268-18 style digital peak meter, from 0 at
 * -70 dB to 100 at 0 dB: each stretch of the scale gets more room than the
 * one below, so the top 20 dB take half the length.
 */
export function iecDeflection(level: number): number {
  if (level < -70) {
    return 0;
  }
  if (level < -60) {
    return (level + 70) * 0.25;
  }
  if (level < -50) {
    return (level + 60) * 0.5 + 2.5;
  }
  if (level < -40) {
    return (level + 50) * 0.75 + 7.5;
  }
  if (level < -30) {
    return (level + 40) * 1.5 + 15;
  }
  if (level < -20) {
    return (level + 30) * 2 + 30;
  }
  return (level + 20) * 2.5 + 50;
}

/**
 * The deflection of a VU meter's pointer. It moves with the voltage of the
 * signal, not with its dB, so on a scale that ends at +3 VU the mark of 0 VU
 * sits at 71% of the length and that of -20 VU at 7%. Give it to
 * `levelPosition` from `Number.NEGATIVE_INFINITY`, where the pointer rests.
 */
export function vuDeflection(level: number): number {
  return 10 ** (level / 20);
}

const evenly: LevelScaleFunction = (level) => level;

/** A function from a level to its position along the length, 0 at `min` and 1 at `max`. */
export function levelPosition(
  scale: LevelScale,
  min: number,
  max: number
): (level: number) => number {
  let curve = scale;
  if (scale === "iec") {
    curve = iecDeflection;
  } else if (scale === "linear") {
    curve = evenly;
  }
  const spread = curve as LevelScaleFunction;
  const low = spread(min);
  const span = spread(max) - low || 1;
  return (level) => Math.min(1, Math.max(0, (spread(level) - low) / span));
}
