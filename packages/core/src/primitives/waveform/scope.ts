export interface ScopePoint {
  x: number;
  y: number;
}

export interface ScopeOptions {
  /** Visual gain applied to the samples. */
  gain: number;
  /** Bitmap height, in device pixels. */
  height: number;
  /** Room kept above and below, so the line's own thickness stays inside. */
  inset: number;
  /** Bitmap width, in device pixels. */
  width: number;
}

/**
 * Where a line through `samples` (-1…1 each) goes: left to right across the
 * width, around the middle of the height. More samples than pixel columns are
 * thinned out; too few to draw a line give a flat one.
 */
export function scopePoints(
  samples: ArrayLike<number>,
  { gain, height, inset, width }: ScopeOptions
): ScopePoint[] {
  const middle = height / 2;
  const { length } = samples;
  if (length < 2 || width <= 0) {
    return [
      { x: 0, y: middle },
      { x: Math.max(0, width), y: middle },
    ];
  }
  const reach = Math.max(0, middle - inset);
  const stride = Math.max(1, Math.floor(length / width));
  const points: ScopePoint[] = [];
  for (let index = 0; index < length; index += stride) {
    const sample = Math.min(1, Math.max(-1, (samples[index] ?? 0) * gain));
    points.push({
      x: (index / (length - 1)) * width,
      y: middle - sample * reach,
    });
  }
  return points;
}
