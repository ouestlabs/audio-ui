import { DEFAULTS, type Settings } from "./engine";

/** A patch: what the panel's sliders, switch and volume read, from the defaults up. */
export type Patch = Settings & { volume: number };

interface Preset {
  name: string;
  patch: Partial<Patch>;
}

/** Eight sounds for the patch keys; each one names only what it changes. */
export const PRESETS: readonly Preset[] = [
  {
    name: "Brass",
    patch: {
      attack: 2,
      chorus: "I",
      contour: 6,
      cutoff: 4,
      decay: 5,
      pulse: 0,
      release: 2,
      saw: 9,
      sub: 2,
      sustain: 6,
    },
  },
  {
    name: "Strings",
    patch: {
      attack: 6,
      chorus: "II",
      contour: 1,
      cutoff: 6,
      decay: 6,
      pulse: 6,
      rate: 3,
      release: 6,
      saw: 8,
      sub: 0,
      sustain: 8,
      vibrato: 2,
      width: 5,
    },
  },
  {
    name: "Soft Pad",
    patch: {
      attack: 7,
      chorus: "II",
      contour: 3,
      cutoff: 4,
      decay: 7,
      pulse: 7,
      release: 8,
      saw: 3,
      sub: 4,
      sustain: 9,
      width: 2,
    },
  },
  {
    name: "Pluck",
    patch: {
      attack: 0,
      chorus: "I",
      contour: 8,
      cutoff: 4,
      decay: 3,
      pulse: 6,
      release: 2,
      resonance: 3,
      saw: 8,
      sub: 2,
      sustain: 0,
    },
  },
  {
    name: "Fat Bass",
    patch: {
      attack: 0,
      chorus: "Off",
      contour: 6,
      cutoff: 3,
      decay: 4,
      pulse: 6,
      release: 2,
      resonance: 4,
      saw: 8,
      sub: 8,
      sustain: 6,
    },
  },
  {
    name: "Organ",
    patch: {
      attack: 0,
      chorus: "II",
      contour: 0,
      cutoff: 10,
      decay: 0,
      pulse: 8,
      rate: 6,
      release: 1,
      saw: 0,
      sub: 7,
      sustain: 10,
      vibrato: 3,
    },
  },
  {
    name: "Sweep",
    patch: {
      attack: 4,
      chorus: "I",
      contour: 9,
      cutoff: 2,
      decay: 8,
      pulse: 7,
      release: 6,
      resonance: 6,
      saw: 7,
      sub: 3,
      sustain: 5,
    },
  },
  {
    name: "Glass Lead",
    patch: {
      attack: 0,
      chorus: "I",
      contour: 2,
      cutoff: 7,
      decay: 3,
      pulse: 8,
      rate: 5,
      release: 3,
      resonance: 2,
      saw: 5,
      sub: 0,
      sustain: 8,
      vibrato: 4,
      width: 6,
    },
  },
];

/** A preset's whole patch: the defaults, with what it names on top. */
export const patchOf = (index: number): Patch => ({
  ...DEFAULTS,
  ...(PRESETS[index]?.patch ?? {}),
});
