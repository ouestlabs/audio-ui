import { clamp } from "@audio-ui/core";
import type { Note } from "@audio-ui/core/piano-roll";

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
