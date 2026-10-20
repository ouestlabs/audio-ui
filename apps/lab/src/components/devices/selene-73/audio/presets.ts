import { DEFAULTS, type Settings } from "./engine";

/** A patch: what the panel's knobs read, plus the volume, from the defaults up. */
export type Patch = Settings & { volume: number };

interface Preset {
  name: string;
  patch: Partial<Patch>;
}

/** Four sounds for the patch keys; each one names only what it changes. */
export const PRESETS: readonly Preset[] = [
  { name: "Warm", patch: {} },
  { name: "Bell", patch: { bark: 2, bell: 9, decay: 7, depth: 1, drive: 1 } },
  { name: "Bark", patch: { bark: 9, bell: 3, decay: 4, depth: 2, drive: 6 } },
  {
    name: "Mellow",
    patch: { bark: 1, bell: 2, decay: 8, depth: 6, drive: 0, rate: 3 },
  },
];

/** A preset's whole patch: the defaults, with what it names on top. */
export const patchOf = (index: number): Patch => ({
  ...DEFAULTS,
  ...(PRESETS[index]?.patch ?? {}),
});
