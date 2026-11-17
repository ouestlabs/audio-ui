export function adjacentPoint(
  points: readonly number[],
  from: number,
  direction: 1 | -1
): number | null {
  let found: number | null = null;
  for (const point of points) {
    if (
      (direction === 1 ? point > from : point < from) &&
      (found === null || (direction === 1 ? point < found : point > found))
    ) {
      found = point;
    }
  }
  return found;
}