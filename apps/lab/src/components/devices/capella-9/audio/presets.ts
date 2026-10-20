import { DEFAULTS, type Settings } from "./engine";

/** A registration: what the panel's drawbars, switches and knobs read, plus the volume. */
export type Patch = Settings & { volume: number };

interface Preset {
  /** The nine drawbars as they are written, a digit each, from the 16' to the 1'. */
  bars: string;
  name: string;
  patch: Partial<Patch>;
}

/** Six registrations for the preset keys; each one names its drawbars and only what else it changes. */
export const PRESETS: readonly Preset[] = [
  {
    bars: "888000000",
    name: "Jazz",
    patch: { harmonic: "3rd", leslie: "Slow", percussion: true },
  },
  {
    bars: "888800008",
    name: "Gospel",
    patch: { drive: 3, leslie: "Fast" },
  },
  {
    bars: "888800000",
    name: "Rock",
    patch: { drive: 6, leslie: "Fast" },
  },
  {
    bars: "006080400",
    name: "Church",
    patch: { drive: 0, leslie: "Stop" },
  },
  {
    bars: "008000000",
    name: "Flute",
    patch: { drive: 0, harmonic: "2nd", leslie: "Slow", percussion: true },
  },
  {
    bars: "888888888",
    name: "Full",
    patch: { drive: 2, leslie: "Fast" },
  },
];

/** A preset's whole patch: the defaults, with its drawbars and what it names on top. */
export const patchOf = (index: number): Patch => {
  const preset = PRESETS[index];
  return {
    ...DEFAULTS,
    ...(preset?.patch ?? {}),
    drawbars: Array.from(preset?.bars ?? "", Number),
    percussion: preset?.patch.percussion ?? false,
  };
};
