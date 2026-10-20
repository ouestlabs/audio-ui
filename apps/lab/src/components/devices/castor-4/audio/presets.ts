import { DEFAULTS, type Settings } from "./engine";

/** A patch: what the panel's sliders and knobs read, plus the volume, from the defaults up. */
export type Patch = Settings & { volume: number };

interface Preset {
  name: string;
  patch: Partial<Patch>;
}

/** Eight registrations for the patch keys; each one names only what it changes. */
export const PRESETS: readonly Preset[] = [
  { name: "Strings", patch: {} },
  { name: "Violins", patch: { bass: 0, cello: 0, viola: 3, violin: 10 } },
  {
    name: "Cellos",
    patch: { bass: 3, cello: 9, viola: 2, violin: 0, bright: 4 },
  },
  {
    name: "Full",
    patch: { bass: 5, cello: 7, ensemble: 8, viola: 7, violin: 9 },
  },
  { name: "Swell", patch: { attack: 8, release: 8, ensemble: 7, bright: 5 } },
  {
    name: "Pizz",
    patch: { attack: 0, release: 1, ensemble: 3, bright: 8, cello: 3 },
  },
  {
    name: "Dark",
    patch: { bright: 2, viola: 7, violin: 3, cello: 6, ensemble: 5 },
  },
  {
    name: "Choir",
    patch: {
      attack: 7,
      release: 7,
      bright: 3,
      ensemble: 9,
      viola: 8,
      violin: 5,
      cello: 0,
    },
  },
];

/** A preset's whole patch: the defaults, with what it names on top. */
export const patchOf = (index: number): Patch => ({
  ...DEFAULTS,
  ...(PRESETS[index]?.patch ?? {}),
});
