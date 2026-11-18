/**
 * How alike the two channels of a sound are, from -1 to 1, as a correlation
 * meter reads it: 1 when both carry the same sound (mono, at any levels), 0
 * when they have nothing in common or only one side sounds, and -1 when one is
 * the other upside down, which cancels out once the two are summed to mono.
 * Over the samples both channels have; 0 for silence, never `NaN`.
 */
export function stereoCorrelation(
  left: ArrayLike<number>,
  right: ArrayLike<number>
): number {
  const length = Math.min(left.length, right.length);
  let both = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let index = 0; index < length; index += 1) {
    const l = left[index] as number;
    const r = right[index] as number;
    both += l * r;
    leftEnergy += l * l;
    rightEnergy += r * r;
  }
  const scale = Math.sqrt(leftEnergy * rightEnergy);
  return scale > 0 && Number.isFinite(scale)
    ? Math.max(-1, Math.min(1, both / scale))
    : 0;
}
