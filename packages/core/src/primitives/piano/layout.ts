import { isBlackKey } from "../../shared/pitch";

/**
 * How the keys share the keyboard's length: `"keyboard"` like a piano, white
 * keys side by side with the black ones between them, or `"even"`, one equal
 * share each, the way a piano roll's rows are.
 */
export type KeyLayout = "even" | "keyboard";

/** How far across the keyboard a black key reaches; past it, a press lands on a white key. */
export const BLACK_KEY_DEPTH = 0.6;
/** A black key's width, as a share of a white key's. */
const BLACK_KEY_WIDTH = 0.65;

export interface KeyPlacement {
  black: boolean;
  pitch: number;
  /** How much of the keyboard's length the key takes, 0…1. */
  size: number;
  /** Where the key starts, from the keyboard's low end, 0…1. */
  start: number;
}

/** Where each of `pitches` (lowest first) sits along the keyboard. */
export function placeKeys(
  pitches: readonly number[],
  layout: KeyLayout
): KeyPlacement[] {
  if (layout === "even") {
    const size = 1 / Math.max(pitches.length, 1);
    return pitches.map((pitch, index) => ({
      black: isBlackKey(pitch),
      pitch,
      size,
      start: index * size,
    }));
  }
  const white = 1 / Math.max(pitches.filter((p) => !isBlackKey(p)).length, 1);
  const black = white * BLACK_KEY_WIDTH;
  let whites = 0;
  return pitches.map((pitch) => {
    if (isBlackKey(pitch)) {
      return {
        black: true,
        pitch,
        size: black,
        start: whites * white - black / 2,
      };
    }
    whites += 1;
    return { black: false, pitch, size: white, start: (whites - 1) * white };
  });
}

/**
 * The key under a point, given as shares of the keyboard: `along` its length
 * from the low end, `across` its depth from the back, where black keys are.
 * Black keys sit on top of the white ones, so they are tried first.
 */
export function keyAt(
  placements: readonly KeyPlacement[],
  along: number,
  across: number,
  layout: KeyLayout
): KeyPlacement | null {
  const covers = (key: KeyPlacement) =>
    along >= key.start && along < key.start + key.size;
  if (layout === "even") {
    return placements.find(covers) ?? null;
  }
  if (across < BLACK_KEY_DEPTH) {
    const black = placements.find((key) => key.black && covers(key));
    if (black) {
      return black;
    }
  }
  return placements.find((key) => !key.black && covers(key)) ?? null;
}
