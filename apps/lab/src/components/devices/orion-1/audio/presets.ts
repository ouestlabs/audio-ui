import { DEFAULTS, type Settings } from "./engine.ts";

/** A patch: what the panel's knobs and sliders read, plus the volume, from the defaults up. */
export type Patch = Omit<Settings, "range"> & { volume: number };

interface Preset {
  name: string;
  patch: Partial<Patch>;
}

const { range: _range, ...BASE } = DEFAULTS;

/** Eight sounds for the LCD to page through; each one names only what it changes. */
export const PRESETS: readonly Preset[] = [
  { name: "Init Saw", patch: {} },
  {
    name: "Warm Pad",
    patch: {
      attack: 6,
      contour: 3,
      cutoff: 4,
      decay: 6,
      release: 6,
      resonance: 1,
      sub: 5,
      sustain: 8,
      wave: "Tri",
    },
  },
  {
    name: "Acid Bass",
    patch: {
      attack: 0,
      contour: 8,
      cutoff: 3,
      decay: 3,
      glide: 3,
      release: 2,
      resonance: 8,
      sub: 0,
      sustain: 2,
      wave: "Saw",
    },
  },
  {
    name: "Pluck",
    patch: {
      attack: 0,
      contour: 6,
      cutoff: 5,
      decay: 3,
      release: 3,
      resonance: 3,
      sustain: 0,
      wave: "Square",
    },
  },
  {
    name: "Brass",
    patch: {
      attack: 2,
      contour: 5,
      cutoff: 5,
      decay: 4,
      release: 3,
      resonance: 2,
      sustain: 6,
      wave: "Saw",
    },
  },
  {
    name: "Sub Bass",
    patch: {
      attack: 0,
      contour: 2,
      cutoff: 3,
      decay: 4,
      osc: 5,
      release: 2,
      resonance: 1,
      sub: 10,
      sustain: 8,
      wave: "Square",
    },
  },
  {
    name: "Lead",
    patch: {
      contour: 4,
      cutoff: 7,
      depth: 2,
      glide: 4,
      rate: 5,
      resonance: 4,
      wave: "Pulse",
      width: 5,
    },
  },
  {
    name: "Wind",
    patch: {
      attack: 6,
      cutoff: 5,
      decay: 6,
      noise: 8,
      osc: 2,
      release: 7,
      resonance: 5,
      sub: 0,
      sustain: 6,
      wave: "Tri",
    },
  },
];

export const patchOf = (index: number): Patch => ({
  ...BASE,
  ...PRESETS[index]?.patch,
});
