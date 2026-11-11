import key from "@audio/mir-key";
import { NAMES_SHARP } from "@audio/note";
import type { Scale } from "./scale.ts";

/** What a key is read from: a note's pitch and how long it lasts, in any unit. A muted note counts for nothing. */
export interface KeyNote {
  length: number;
  muted?: boolean;
  pitch: number;
}

/**
 * The keys `notes` are likeliest in, likeliest first, at most `count`: each
 * pitch class weighed by how long it sounds, against the major and minor key
 * profiles of `@audio/mir-key` (Krumhansl-Schmuckler). `audio` adds the
 * sound of recordings, a weight per pitch class in the same unit as the
 * notes' lengths, such as an `audioChroma` times the seconds it plays. One
 * part alone is often ambiguous, as a bass line is: pass every part of the
 * song. None for no notes and no sound.
 */
export function detectKeys(
  notes: readonly KeyNote[],
  count = 3,
  audio?: readonly number[]
): Scale[] {
  const chroma = Array.from({ length: 12 }, (_, at) => audio?.[at] ?? 0);
  for (const note of notes) {
    if (!note.muted && note.length > 0) {
      const at = ((Math.round(note.pitch) % 12) + 12) % 12;
      chroma[at] = (chroma[at] as number) + note.length;
    }
  }
  // One pitch class alone, or none, correlates with nothing.
  if (chroma.filter((weight) => weight > 0).length < 2) {
    return [];
  }
  return key(chroma)
    .scores.slice(0, count)
    .map(({ label }) => {
      const minor = label.endsWith("m");
      return {
        name: minor ? "minor" : "major",
        root: NAMES_SHARP.indexOf(minor ? label.slice(0, -1) : label),
      } satisfies Scale;
    });
}
