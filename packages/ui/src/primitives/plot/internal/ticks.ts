import { LOGARITHMIC_SCALE } from "../../internal/parameter-scale";
import type { PlotAxis } from "../context";

/** How many ticks an axis gets unless asked for another number. */
export const DEFAULT_TICK_COUNT = 5;

/** Candidates for a step's leading digit, in powers of ten: 1, 2, 5, 10. */
const STEP_MULTIPLES = [1, 2, 5, 10];

/** Even steps over `min`…`max`, at 1, 2 or 5 times a power of ten, roughly `count` of them. */
function linearTicks(min: number, max: number, count: number): number[] {
  const span = max - min;
  if (!(span > 0 && count > 0)) {
    return [];
  }
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step =
    (STEP_MULTIPLES.find((multiple) => multiple * power >= raw) ?? 10) * power;
  const ticks: number[] = [];
  for (
    let value = Math.ceil(min / step) * step;
    value <= max + step * 1e-9;
    value += step
  ) {
    // Rounded to the step's own decimals, so 0.1 + 0.2 is 0.3 and not 0.30000000000000004.
    ticks.push(
      Number(value.toFixed(Math.max(0, -Math.floor(Math.log10(step)) + 1)))
    );
  }
  return ticks;
}

/**
 * Ticks for a logarithmic axis: each power of ten, with the 2 and the 5 of it
 * as well when that still leaves room (no more than about one and a half
 * times `count`).
 */
function logTicks(min: number, max: number, count: number): number[] {
  if (!(min > 0 && max > min)) {
    return [];
  }
  const decades = (multiples: readonly number[]) => {
    const ticks: number[] = [];
    for (
      let power = Math.floor(Math.log10(min));
      10 ** power <= max;
      power += 1
    ) {
      for (const multiple of multiples) {
        const value = multiple * 10 ** power;
        if (value >= min * (1 - 1e-9) && value <= max * (1 + 1e-9)) {
          ticks.push(value);
        }
      }
    }
    return ticks;
  };
  const fine = decades([1, 2, 5]);
  return fine.length <= count * 1.5 ? fine : decades([1]);
}

/** Round, evenly-spread tick values for `axis`: by power of ten when it is logarithmic. */
export function axisTicks(
  axis: PlotAxis,
  count = DEFAULT_TICK_COUNT
): number[] {
  return axis.scale === LOGARITHMIC_SCALE
    ? logTicks(axis.min, axis.max, count)
    : linearTicks(axis.min, axis.max, count);
}

/** A tick as short text: 1000 as "1k", 0.5 as "0.5", -12 as "-12". */
export function formatTick(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) {
    return `${trim(value / 1_000_000)}M`;
  }
  if (magnitude >= 1000) {
    return `${trim(value / 1000)}k`;
  }
  return trim(value);
}

function trim(value: number): string {
  return String(Number(value.toFixed(2)));
}
