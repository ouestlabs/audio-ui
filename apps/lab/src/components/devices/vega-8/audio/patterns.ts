import { INSTRUMENTS, type Instrument } from "./engine";

export const STEPS = 16;

interface Preset {
  bpm: number;
  name: string;
  /** One line per instrument, a step each: `x` is on. Instruments left out are silent. */
  rows: Partial<Record<Instrument, string>>;
}

export const PRESETS: readonly Preset[] = [
  {
    bpm: 124,
    name: "Four on floor",
    rows: {
      clap: "....x.......x...",
      closedHat: "x.x.x.x.x.x.x.x.",
      kick: "x...x...x...x...",
      openHat: "..x...x...x...x.",
    },
  },
  {
    bpm: 92,
    name: "Boom bap",
    rows: {
      closedHat: "x.x.x.x.x.x.x.x.",
      kick: "x.....x...x.....",
      openHat: "..............x.",
      snare: "....x.......x...",
    },
  },
  {
    bpm: 128,
    name: "Electro",
    rows: {
      clap: "....x.......x...",
      closedHat: "..x...x...x...x.",
      cowbell: "...x.......x....",
      kick: "x..x..x...x..x..",
      openHat: "x...............",
      snare: "....x.......x...",
    },
  },
  {
    bpm: 112,
    name: "Afro",
    rows: {
      closedHat: "x.x.x.x.x.x.x.x.",
      cowbell: "x.x.x..x.x.x..x.",
      highTom: "....x.....x.....",
      kick: "x..x..x..x..x...",
      lowTom: "..x....x....x...",
    },
  },
];

/** A preset as the grid takes it: a row of steps per instrument, in the panel's order. */
export function patternOf(index: number) {
  const rows = PRESETS[index]?.rows ?? {};
  return INSTRUMENTS.map((instrument) =>
    Array.from({ length: STEPS }, (_, step) => rows[instrument]?.[step] === "x")
  );
}
