/** A mark in the navigation: what changed, and the day it did. */
export interface MenuUpdate {
  mark: "New" | "Updated";
  /** The day the page came, or last changed for its readers, as YYYY-MM-DD. */
  on: string;
}

/** How long a mark stays after its day: past it, the page shows none. */
const MARK_DAYS = 30;

/** The marks still shown on `today`: those within `MARK_DAYS` of their day. */
export function shownMarks(
  updates: Readonly<Record<string, MenuUpdate>>,
  today = new Date()
): [string, string][] {
  // Whole days: a mark lasts to the end of its last day, whatever the hour.
  const since =
    Date.parse(today.toISOString().slice(0, 10)) -
    MARK_DAYS * 24 * 60 * 60 * 1000;
  return Object.entries(updates).flatMap(([page, { mark, on }]) =>
    Date.parse(on) >= since ? [[page, mark]] : []
  );
}

/** Pages of the docs' navigation that carry a mark: new, or updated, within the last weeks. */
export const DOCS_MENU_UPDATES: Record<string, MenuUpdate> = {
  arrangement: { mark: "Updated", on: "2026-11-07" },
  "auto-pan": { mark: "New", on: "2026-10-16" },
  "channel-eq": { mark: "New", on: "2026-10-16" },
  chorus: { mark: "New", on: "2026-10-16" },
  compressor: { mark: "New", on: "2026-10-16" },
  deesser: { mark: "New", on: "2026-10-16" },
  delay: { mark: "New", on: "2026-10-16" },
  "device-browser": { mark: "New", on: "2026-11-07" },
  "device-chain": { mark: "Updated", on: "2026-11-07" },
  distortion: { mark: "New", on: "2026-10-16" },
  envelope: { mark: "Updated", on: "2026-10-11" },
  equalizer: { mark: "New", on: "2026-10-16" },
  fader: { mark: "Updated", on: "2026-10-11" },
  filter: { mark: "New", on: "2026-10-16" },
  gate: { mark: "New", on: "2026-10-16" },
  knob: { mark: "Updated", on: "2026-10-11" },
  limiter: { mark: "New", on: "2026-10-16" },
  meter: { mark: "Updated", on: "2026-10-11" },
  "mid-side": { mark: "New", on: "2026-10-16" },
  mixer: { mark: "Updated", on: "2026-11-07" },
  multiband: { mark: "New", on: "2026-10-16" },
  overdrive: { mark: "New", on: "2026-10-16" },
  pad: { mark: "New", on: "2026-10-15" },
  phaser: { mark: "New", on: "2026-10-16" },
  "piano-roll": { mark: "New", on: "2026-10-11" },
  plot: { mark: "New", on: "2026-10-11" },
  "pocket-synth": { mark: "New", on: "2026-10-16" },
  "poly-synth": { mark: "New", on: "2026-11-07" },
  "electric-piano": { mark: "New", on: "2026-11-07" },
  "fm-synth": { mark: "New", on: "2026-11-07" },
  "mono-synth": { mark: "New", on: "2026-11-07" },
  organ: { mark: "New", on: "2026-11-07" },
  "string-machine": { mark: "New", on: "2026-11-07" },
  "tape-keys": { mark: "New", on: "2026-11-07" },
  guitar: { mark: "New", on: "2026-11-08" },
  "drum-synth": { mark: "New", on: "2026-11-08" },
  sampler: { mark: "New", on: "2026-11-07" },
  redux: { mark: "New", on: "2026-10-16" },
  lofi: { mark: "New", on: "2026-11-10" },
  reverb: { mark: "New", on: "2026-10-16" },
  saturator: { mark: "New", on: "2026-10-16" },
  scrubber: { mark: "New", on: "2026-10-11" },
  sequencer: { mark: "Updated", on: "2026-10-11" },
  "spectrum-analyzer": { mark: "New", on: "2026-10-15" },
  transient: { mark: "New", on: "2026-10-16" },
  tuner: { mark: "New", on: "2026-10-15" },
  utility: { mark: "New", on: "2026-10-16" },
  vibe: { mark: "New", on: "2026-11-07" },
  "wave-shaper": { mark: "New", on: "2026-10-16" },
  waveform: { mark: "Updated", on: "2026-10-11" },
};

/** The same for the catalog's categories. */
export const PATTERNS_MENU_UPDATES: Record<string, MenuUpdate> = {
  "device-browser": { mark: "New", on: "2026-11-07" },
  "device-chain": { mark: "Updated", on: "2026-11-07" },
  envelope: { mark: "Updated", on: "2026-10-11" },
  fader: { mark: "Updated", on: "2026-10-11" },
  knob: { mark: "Updated", on: "2026-10-11" },
  meter: { mark: "Updated", on: "2026-10-11" },
  mixer: { mark: "Updated", on: "2026-11-07" },
  pad: { mark: "New", on: "2026-10-15" },
  piano: { mark: "New", on: "2026-10-11" },
  plot: { mark: "New", on: "2026-10-11" },
  scrubber: { mark: "New", on: "2026-10-11" },
  sequencer: { mark: "Updated", on: "2026-10-11" },
  spectrum: { mark: "New", on: "2026-10-15" },
  timeline: { mark: "Updated", on: "2026-11-07" },
  tuner: { mark: "New", on: "2026-10-15" },
  waveform: { mark: "Updated", on: "2026-10-11" },
};
