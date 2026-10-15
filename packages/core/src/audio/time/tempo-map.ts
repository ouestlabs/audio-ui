/**
 * Ticks and seconds, through the tempo changes of a song. A tick is a
 * fraction of a quarter note (`ticksPerQuarterNote`, the file's division), and
 * lasts `microsecondsPerQuarterNote / ticksPerQuarterNote` microseconds at
 * the tempo in force: so the seconds of a position are the sum of its ticks,
 * each stretch at the tempo that held over it.
 */

import { DEFAULT_MICROSECONDS_PER_QUARTER_NOTE } from "./tempo.ts";

/** A Set Tempo: how long a quarter note lasts from `tick` on. The shape `parseMidiFile` returns its tempos in. */
export interface TempoChange {
  microsecondsPerQuarterNote: number;
  tick: number;
}

const MICROSECONDS_PER_SECOND = 1_000_000;

interface Segment {
  /** Seconds at the start of the segment. */
  seconds: number;
  /** Seconds one tick lasts in it. */
  secondsPerTick: number;
  tick: number;
}

/**
 * The tempo changes as segments with the seconds each begins at, in tick
 * order. A song starts at 120 BPM, the file format's default, until its first
 * Set Tempo: one at tick 0 replaces it. Changes that are not a tick and a
 * positive tempo are left out.
 */
function segmentsOf(
  tempos: readonly TempoChange[],
  ticksPerQuarterNote: number
): Segment[] {
  const sorted = tempos
    .filter(
      (change) =>
        Number.isFinite(change.tick) &&
        change.tick >= 0 &&
        Number.isFinite(change.microsecondsPerQuarterNote) &&
        change.microsecondsPerQuarterNote > 0
    )
    .sort((a, b) => a.tick - b.tick);
  const perTick = (microseconds: number) =>
    microseconds / ticksPerQuarterNote / MICROSECONDS_PER_SECOND;
  const segments: Segment[] = [
    {
      seconds: 0,
      secondsPerTick: perTick(DEFAULT_MICROSECONDS_PER_QUARTER_NOTE),
      tick: 0,
    },
  ];
  for (const change of sorted) {
    const last = segments.at(-1) as Segment;
    const seconds =
      last.seconds + (change.tick - last.tick) * last.secondsPerTick;
    const next: Segment = {
      seconds,
      secondsPerTick: perTick(change.microsecondsPerQuarterNote),
      tick: change.tick,
    };
    if (change.tick === last.tick) {
      segments[segments.length - 1] = next;
    } else {
      segments.push(next);
    }
  }
  return segments;
}

const validDivision = (ticksPerQuarterNote: number) =>
  Number.isFinite(ticksPerQuarterNote) && ticksPerQuarterNote > 0;

/** The seconds a tick falls at, through `tempos`. `NaN` for a tick that is negative or not a number, or a division that is not positive. */
export function ticksToSeconds(
  tick: number,
  ticksPerQuarterNote: number,
  tempos: readonly TempoChange[] = []
): number {
  if (
    !(Number.isFinite(tick) && tick >= 0 && validDivision(ticksPerQuarterNote))
  ) {
    return Number.NaN;
  }
  const segments = segmentsOf(tempos, ticksPerQuarterNote);
  let segment = segments[0] as Segment;
  for (const candidate of segments) {
    if (candidate.tick > tick) {
      break;
    }
    segment = candidate;
  }
  return segment.seconds + (tick - segment.tick) * segment.secondsPerTick;
}

/** The tick a position in seconds falls at, through `tempos`: the inverse of `ticksToSeconds`, fractional between ticks. `NaN` for seconds that are negative or not a number. */
export function secondsToTicks(
  seconds: number,
  ticksPerQuarterNote: number,
  tempos: readonly TempoChange[] = []
): number {
  if (
    !(
      Number.isFinite(seconds) &&
      seconds >= 0 &&
      validDivision(ticksPerQuarterNote)
    )
  ) {
    return Number.NaN;
  }
  const segments = segmentsOf(tempos, ticksPerQuarterNote);
  let segment = segments[0] as Segment;
  for (const candidate of segments) {
    if (candidate.seconds > seconds) {
      break;
    }
    segment = candidate;
  }
  return segment.tick + (seconds - segment.seconds) / segment.secondsPerTick;
}
