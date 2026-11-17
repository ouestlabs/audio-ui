export type NoteId = number | string;

/** A note of a MIDI clip: its pitch, start and length, how hard and how likely it plays, how far its velocity may stray, and whether it is deactivated. */
export interface Note {
  /** How likely the note is to play each time it comes round, 0 to 1. @default 1 */
  chance?: number;
  /** How far the velocity may stray each time the note plays, as a share of the full range. @default 0 */
  deviation?: number;
  id: NoteId;
  /** Length, in the clip's units. */
  length: number;
  /** Whether the note is deactivated: it stays in the clip, and does not play. @default false */
  muted?: boolean;
  /** MIDI pitch: 60 is middle C. */
  pitch: number;
  /** Where the note starts, in the clip's units. */
  start: number;
  /** How hard the note is played, 0 to 1. @default 1 */
  velocity?: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/**
 * How hard a note plays this time round, from 0 to 1, or `null` when it does
 * not: a deactivated note never plays, one with a `chance` plays that share of
 * the times, and a `deviation` strays its velocity by up to that much, a new
 * roll each time. `random` gives numbers from 0 to 1: `Math.random` unless a
 * test or a seeded render passes its own.
 */
export function playedVelocity(
  note: Pick<Note, "chance" | "deviation" | "muted" | "velocity">,
  random: () => number = Math.random
): number | null {
  if (note.muted || random() >= (note.chance ?? 1)) {
    return null;
  }
  return clamp((note.velocity ?? 1) + random() * (note.deviation ?? 0), 0, 1);
}