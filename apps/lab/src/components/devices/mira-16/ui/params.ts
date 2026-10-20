import type { BassControl, Control, Instrument } from "../audio/engine";

/** What the panel and the LCD call each instrument: the short name on the key, and the long one. */
export const NAMES: Record<Instrument, { long: string; short: string }> = {
  clap: { long: "Clap", short: "CP" },
  closedHat: { long: "Closed hat", short: "CH" },
  cowbell: { long: "Cowbell", short: "CB" },
  highTom: { long: "High tom", short: "HT" },
  kick: { long: "Kick", short: "BD" },
  lowTom: { long: "Low tom", short: "LT" },
  openHat: { long: "Open hat", short: "OH" },
  snare: { long: "Snare", short: "SD" },
};

/** What a hit of each instrument plays on a MIDI keyboard or pads, by note number. */
export const MIDI_NOTES: Record<number, Instrument> = {
  36: "kick",
  38: "snare",
  39: "clap",
  41: "lowTom",
  42: "closedHat",
  46: "openHat",
  48: "highTom",
  56: "cowbell",
};

export const CONTROLS: { control: Control; label: string }[] = [
  { control: "level", label: "Level" },
  { control: "tone", label: "Tone" },
  { control: "decay", label: "Decay" },
];

export const BASS_CONTROLS: { control: BassControl; label: string }[] = [
  { control: "cutoff", label: "Cutoff" },
  { control: "reso", label: "Reso" },
  { control: "envmod", label: "Env mod" },
  { control: "bassDecay", label: "Decay" },
];

/** A knob of the panel: the three of the chosen instrument, the bass's four, the tempo and the volume. */
export type Param = BassControl | Control | "tempo" | "volume";
export type OnParam = (param: Param, value: number) => void;

/** What the LCD calls each bass knob. */
export const BASS_NAMES: Record<BassControl, string> = {
  bassDecay: "decay",
  cutoff: "cutoff",
  envmod: "env mod",
  reso: "reso",
};

export const isBass = (param: Param): param is BassControl =>
  param in BASS_NAMES;
