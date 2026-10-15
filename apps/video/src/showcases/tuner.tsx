import { createSource } from "@audio-ui/react";
import { type CSSProperties, useLayoutEffect, useState } from "react";
import { Tuner } from "@/registry-audio/bases/base/audio/elements/tuner";
import type { PitchReading } from "@/registry-audio/bases/base/hooks/use-pitch";
import { MOTION, ramp, tw } from "../motion.ts";

const A4_HZ = 440;
const A4_NOTE = 69;

/** Three strings of a guitar, tuned one after the other: each is plucked out of tune and turned onto its note. */
const STRINGS = [
  { name: "E", note: 40, octave: 2, off: 31 },
  { name: "A", note: 45, octave: 2, off: -24 },
  { name: "D", note: 50, octave: 3, off: 18 },
] as const;

const FIRST_PLUCK = 0.2;
const PER_STRING = 2.35;
/** The string rings for this long, the last part of it with nothing playing. */
const RINGS = 2.05;
/** How long the peg takes to bring the string onto its note. */
const TURN = 1.2;
/** How far the string still wobbles on its note, in cents. */
const SETTLED_WOBBLE = 1.2;

const noteHz = (note: number, cents: number) =>
  A4_HZ * 2 ** ((note - A4_NOTE + cents / 100) / 12);

/** The reading at `t`: the string being tuned, how far off it is, or nothing between two strings. */
function readingAt(t: number): PitchReading | null {
  const index = Math.floor((t - FIRST_PLUCK) / PER_STRING);
  const string = STRINGS[index];
  if (!string) {
    return null;
  }
  const since = t - FIRST_PLUCK - index * PER_STRING;
  if (since < 0 || since > RINGS) {
    return null;
  }
  // The hand turns the peg: the string comes onto its note, then wobbles on it.
  const turned = tw(since, 0.15, 0.15 + TURN, string.off, 0, MOTION.move);
  const wobble =
    SETTLED_WOBBLE * Math.sin(since * 9 + index * 2) * ramp(since - TURN, 0.3);
  const cents = turned + wobble;
  return {
    cents,
    confidence: 0.98,
    frequency: noteHz(string.note, cents),
    name: string.name,
    octave: string.octave,
    pitch: string.note,
  };
}

/** A guitar tuned string by string: the needle comes onto the note and the display turns to the primary color. */
export function TunerShowcase({ t }: { t: number }) {
  const [reading] = useState(() => createSource<PitchReading | null>(null));
  // The display follows its source, written outside React as it is live.
  useLayoutEffect(() => {
    reading.set(readingAt(t));
  }, [reading, t]);
  return (
    // In tune reads green, as a meter's fill does: the site's primary is black in the light theme.
    <div
      className="flex h-full items-center justify-center"
      style={{ "--primary": "var(--success)" } as CSSProperties}
    >
      <Tuner source={reading} />
    </div>
  );
}
