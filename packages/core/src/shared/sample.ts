/** Where in an interval, as a share of it, a curve is checked against its chord. */
const PROBES = [0.25, 0.5, 0.75];
/** How many times an interval may be halved: a corner is resolved to 1/256 of the grid step. */
const MAX_DEPTH = 8;
/** A ceiling on the vertices of one curve, so a function that jumps cannot make a path of any size. */
const MAX_POINTS = 4096;

/** A vertex of the polyline: where along the curve (0 to 1) and its value there. */
export type Sample = readonly [t: number, value: number];

/**
 * The vertices of a polyline that draws `f(t)` for `t` from 0 to 1 without
 * straying more than `tolerance` from it. It starts from the vertices of
 * `grid` and halves every interval whose curve leaves its chord, so a corner
 * or a tight bend gets the vertices it needs and a straight stretch keeps
 * none it does not.
 *
 * `tolerance` is a share of the box the curve is drawn in, measured
 * perpendicular to the curve; `width` is how wide, in that box, `t` from 0 to
 * 1 spans (1 when the curve crosses the whole box), which tells a steep stretch
 * from a flat one. Vertices come back in order, the grid's included.
 */
export function adaptiveSamples(
  f: (t: number) => number,
  grid: readonly number[],
  tolerance: number,
  width = 1
): Sample[] {
  const samples: Sample[] = [];
  const values = grid.map(f);
  let budget = MAX_POINTS - grid.length;

  const refine = (
    from: number,
    start: number,
    to: number,
    end: number,
    depth: number
  ) => {
    if (depth >= MAX_DEPTH || budget <= 0) {
      return;
    }
    let stray = 0;
    let middle = Number.NaN;
    for (const probe of PROBES) {
      const value = f(from + (to - from) * probe);
      stray = Math.max(
        stray,
        Math.abs(value - (start + (end - start) * probe))
      );
      if (probe === 0.5) {
        middle = value;
      }
    }
    const slope = (end - start) / ((to - from) * width);
    if (stray / Math.sqrt(1 + slope * slope) <= tolerance) {
      return;
    }
    const half = (from + to) / 2;
    budget -= 1;
    refine(from, start, half, middle, depth + 1);
    samples.push([half, middle]);
    refine(half, middle, to, end, depth + 1);
  };

  grid.forEach((t, index) => {
    const value = values[index] ?? 0;
    samples.push([t, value]);
    const next = grid[index + 1];
    if (next !== undefined) {
      refine(t, value, next, values[index + 1] ?? 0, 0);
    }
  });
  return samples;
}
