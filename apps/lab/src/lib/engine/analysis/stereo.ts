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