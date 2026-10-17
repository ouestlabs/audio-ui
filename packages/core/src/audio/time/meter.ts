/**
 * Bars through time-signature changes: a song starts in its tempo's
 * signature, and each change starts counting bars of its own from where it is
 * put. A change that lands inside a bar cuts that bar short, a partial bar,
 * as a DAW shows it. Positions are seconds, at one tempo.
 */

import { type BarsBeats, secondsPerQuarter, type Tempo } from "./tempo.ts";

/** A new signature from `at` on, in seconds: `beatsPerBar` beats of a `beatUnit` note. */
export interface SignatureChange {
  at: number;
  beatsPerBar: number;
  beatUnit: number;
}

/** A bar as a ruler draws it. */
export interface Bar {
  beatsPerBar: number;
  beatUnit: number;
  /** In seconds. */
  length: number;
  /** Counted from one, the way every DAW counts them. */
  number: number;
  /** Whether a signature change cuts it short. */
  partial: boolean;
  /** In seconds. */
  start: number;
}

const BEAT_UNITS = [1, 2, 4, 8, 16];

/** Whether a signature is one a bar can have: 1 to 99 beats of a whole, half, quarter, eighth or sixteenth note. */
export function isSignature(beatsPerBar: number, beatUnit: number): boolean {
  return (
    Number.isInteger(beatsPerBar) &&
    beatsPerBar >= 1 &&
    beatsPerBar <= 99 &&
    BEAT_UNITS.includes(beatUnit)
  );
}

/** How long a bar of a signature lasts at `tempo`, in seconds. */
function barSeconds(
  tempo: Tempo,
  beatsPerBar: number,
  beatUnit: number
): number {
  return (beatsPerBar * 4 * secondsPerQuarter(tempo)) / beatUnit;
}

/** The changes that hold, in order: valid ones, the last of several at one place, one at 0 or before standing for the start. */
function changesIn(
  tempo: Tempo,
  changes: readonly SignatureChange[]
): SignatureChange[] {
  const byPlace = new Map<number, SignatureChange>();
  // The tempo's own signature, or 4/4 when it is not one a bar can have.
  const valid = isSignature(tempo.beatsPerBar, tempo.beatUnit);
  byPlace.set(0, {
    at: 0,
    beatUnit: valid ? tempo.beatUnit : 4,
    beatsPerBar: valid ? tempo.beatsPerBar : 4,
  });
  for (const change of changes) {
    if (
      Number.isFinite(change.at) &&
      isSignature(change.beatsPerBar, change.beatUnit)
    ) {
      const at = Math.max(0, change.at);
      byPlace.set(at, { ...change, at });
    }
  }
  return [...byPlace.values()].sort((a, b) => a.at - b.at);
}

/** Small enough not to count as a bar: what is left of one by a rounding error. */
const SLIVER = 1e-9;

/**
 * The bars from 0 to `until` seconds, through the signature changes: whole
 * bars of each signature, and a partial bar where a change cuts one short.
 */
export function barsOf(
  tempo: Tempo,
  changes: readonly SignatureChange[],
  until: number
): Bar[] {
  const held = changesIn(tempo, changes);
  const bars: Bar[] = [];
  held.forEach((change, index) => {
    const next = held[index + 1]?.at ?? Number.POSITIVE_INFINITY;
    const length = barSeconds(tempo, change.beatsPerBar, change.beatUnit);
    for (let start = change.at; start < Math.min(next, until) - SLIVER; ) {
      const cut = start + length > next + SLIVER;
      bars.push({
        beatUnit: change.beatUnit,
        beatsPerBar: change.beatsPerBar,
        length: cut ? next - start : length,
        number: bars.length + 1,
        partial: cut,
        start,
      });
      start += length;
    }
  });
  return bars;
}

/** Where `seconds` falls in bars, beats and sixteenths through the signature changes, each counted from one. */
export function barsBeatsWith(
  seconds: number,
  tempo: Tempo,
  changes: readonly SignatureChange[]
): BarsBeats {
  const at = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const bars = barsOf(tempo, changes, at + SLIVER * 2);
  const bar = bars.at(-1);
  if (!bar) {
    return { bar: 1, beat: 1, sixteenth: 1 };
  }
  const sixteenth = secondsPerQuarter(tempo) / 4;
  // Nudged past the representation error, so a position on a beat reads as that beat.
  const sixteenths = Math.floor((at - bar.start) / sixteenth + 1e-9);
  const perBeat = 16 / bar.beatUnit;
  return {
    bar: bar.number,
    beat: Math.floor(sixteenths / perBeat) + 1,
    sixteenth: (sixteenths % perBeat) + 1,
  };
}
