/** Readouts for frequencies and levels, the way a meter or a plot labels them: `formatFrequency` and `formatLevel` of `@audio-ui/engine/format`, with their defaults. */
import { formatFrequency, formatLevel } from "../format/index.ts";

/** "120 Hz", "1.2 kHz", "12 kHz". */
export function formatHz(hz: number): string {
  return formatFrequency(hz);
}

/** "+3.0 dB", "-6.5 dB", "0.0 dB": a gain with its sign, never "-0.0". */
export function formatDb(db: number): string {
  return formatLevel(db, "dB");
}
