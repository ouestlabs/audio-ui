/** Readouts for frequencies and levels, the way a meter or a plot labels them. */

/** "120 Hz", "1.2 kHz", "12 kHz". */
export function formatHz(hz: number): string {
  if (!Number.isFinite(hz)) {
    return "";
  }
  if (hz >= 10_000) {
    return `${Math.round(hz / 1000)} kHz`;
  }
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(1)} kHz`;
  }
  return `${Math.round(hz)} Hz`;
}

/** "+3.0 dB", "-6.5 dB", "0.0 dB": a gain with its sign, never "-0.0". */
export function formatDb(db: number): string {
  if (Number.isNaN(db)) {
    return "";
  }
  if (db === Number.NEGATIVE_INFINITY) {
    return "-∞ dB";
  }
  const rounded = Math.abs(db) < 0.05 ? 0 : db;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} dB`;
}
