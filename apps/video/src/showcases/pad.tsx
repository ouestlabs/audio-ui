import type { CSSProperties } from "react";
import { Pad, PadItem } from "@/registry-audio/bases/base/audio/elements/pad";
import { ramp } from "../motion.ts";

const LABELS = [
  "Kick",
  "Sub",
  "Snare",
  "Rim",
  "Low tom",
  "Mid tom",
  "Clap",
  "Snap",
  "Closed hat",
  "Pedal hat",
  "Open hat",
  "Shaker",
  "High tom",
  "Perc",
  "Ride",
  "Crash",
];
const KICK = 0;
const SNARE = 2;
const CLAP = 6;
const CLOSED_HAT = 8;
const OPEN_HAT = 10;
const LOW_TOM = 4;
const MID_TOM = 5;
const HIGH_TOM = 12;
const CRASH = 15;

const START = 0.4;
/** Sixteenths at 120 BPM. */
const STEPS_PER_SECOND = 8;
const STEPS = 32;
/** How long a pad stays lit after a strike, in seconds. */
const LIT = 0.16;

/** Two bars of a finger-drummed groove: [step, pad, velocity]. The second bar ends on a tom fill into a crash. */
const HITS: [number, number, number][] = [
  [0, KICK, 1],
  [0, CRASH, 0.8],
  [2, CLOSED_HAT, 0.5],
  [4, SNARE, 0.9],
  [4, CLOSED_HAT, 0.6],
  [6, CLOSED_HAT, 0.45],
  [7, KICK, 0.6],
  [8, KICK, 0.95],
  [8, CLOSED_HAT, 0.6],
  [10, OPEN_HAT, 0.7],
  [12, SNARE, 0.9],
  [12, CLAP, 0.55],
  [12, CLOSED_HAT, 0.6],
  [14, CLOSED_HAT, 0.45],
  [16, KICK, 1],
  [18, CLOSED_HAT, 0.5],
  [20, SNARE, 0.9],
  [20, CLOSED_HAT, 0.6],
  [22, CLOSED_HAT, 0.45],
  [23, KICK, 0.55],
  [24, HIGH_TOM, 0.7],
  [25, HIGH_TOM, 0.5],
  [26, MID_TOM, 0.75],
  [27, MID_TOM, 0.55],
  [28, LOW_TOM, 0.85],
  [29, LOW_TOM, 0.65],
  [30, SNARE, 0.6],
  [31, SNARE, 0.8],
];

/** A finger-drummed groove on a 4×4 rack: each pad flashes as hard as it is struck. */
export function PadShowcase({ t }: { t: number }) {
  const loop = Math.max(0, t - START) % (STEPS / STEPS_PER_SECOND);
  // Each pad shows its latest strike, fading over `LIT` seconds.
  const level = new Map<number, number>();
  if (t > START) {
    for (const [step, pad, velocity] of HITS) {
      const since = loop - step / STEPS_PER_SECOND;
      if (since >= 0 && since < LIT) {
        level.set(pad, velocity * (1 - 0.5 * ramp(since, LIT)));
      }
    }
  }
  return (
    <div className="flex h-full items-center justify-center">
      <Pad
        activePads={[...level.keys()].map(String)}
        aria-label="Drum rack"
        className="w-full"
        columns={4}
      >
        {LABELS.map((label, index) => (
          <PadItem
            key={label}
            style={
              {
                "--pad-velocity": level.get(index) ?? 0,
              } as CSSProperties
            }
            value={String(index)}
          >
            {label}
          </PadItem>
        ))}
      </Pad>
    </div>
  );
}
