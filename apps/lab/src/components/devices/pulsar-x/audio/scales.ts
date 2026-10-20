/** The notes the plate can play: from C3, over three octaves. */
export const ROOT = 48;
export const SPAN = 36;

export type Scale = "Blues" | "Free" | "Major" | "Minor" | "Penta";

/** The semitones of each scale inside an octave. `Free` has no steps: the pitch slides between them. */
const STEPS: Record<Exclude<Scale, "Free">, readonly number[]> = {
  Blues: [0, 3, 5, 6, 7, 10],
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Penta: [0, 2, 4, 7, 9],
};

export const SCALES: readonly Scale[] = [
  "Free",
  "Major",
  "Minor",
  "Penta",
  "Blues",
];

/** Whether a semitone above the root is a note of the scale. `Free` counts every one. */
export function inScale(semitone: number, scale: Scale) {
  if (scale === "Free") {
    return true;
  }
  return STEPS[scale].includes(((semitone % 12) + 12) % 12);
}

/** The pitch the plate plays for a position: the nearest note of the scale, or the position itself when free. */
export function snap(position: number, scale: Scale) {
  const clamped = Math.min(SPAN, Math.max(0, position));
  if (scale === "Free") {
    return clamped;
  }
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (let note = 0; note <= SPAN; note += 1) {
    const away = Math.abs(note - clamped);
    if (inScale(note, scale) && away < distance) {
      best = note;
      distance = away;
    }
  }
  return best;
}
