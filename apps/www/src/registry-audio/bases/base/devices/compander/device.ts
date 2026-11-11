import { compandStream } from "@audio/dynamics-compand";
import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import { COMPANDER_KERNELS } from "@/registry-audio/bases/base/devices/compander/kernels";
import { manifestWorklet } from "@/registry-audio/bases/base/lib/manifest-worklet";

/** The levels in, in dB, whose levels out the compander's points set: the manifest's own. */
export const COMPANDER_POINTS_DB = [-90, -60, -20, 0] as const;
/** Each point's parameter, by its level in. */
export const COMPANDER_POINTS = [
  "out0Db",
  "out1Db",
  "out2Db",
  "out3Db",
] as const;

/**
 * A compander as a device: the multi-segment compander of
 * `@audio/dynamics-compand`, its transfer curve set by four points, with no
 * panel and no audio in it. One curve does a compressor's work, an
 * expander's or a gate's.
 */
export const companderDevice = defineDevice({
  description:
    "Draws its own transfer curve: the level out at -90, -60, -20 and 0 dB in, in straight lines between them. A point under the straight line of a clean sound turns the sound down at that level, one over it turns it up: one curve brings the loud parts down, lifts the quiet ones or closes on the noise. The attack and the release say how fast it follows the level.",
  id: "audioui.compander",
  name: "Compander",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: -90,
      id: "out0Db",
      label: "At -90 dB",
      max: 0,
      min: -90,
      step: 0.5,
      unit: "dB",
    },
    {
      default: -60,
      id: "out1Db",
      label: "At -60 dB",
      max: 0,
      min: -90,
      step: 0.5,
      unit: "dB",
    },
    {
      default: -20,
      id: "out2Db",
      label: "At -20 dB",
      max: 0,
      min: -90,
      step: 0.5,
      unit: "dB",
    },
    {
      default: -8,
      id: "out3Db",
      label: "At 0 dB",
      max: 0,
      min: -90,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 5,
      id: "attackMs",
      label: "Attack",
      max: 200,
      min: 0.1,
      scale: "log",
      step: 0.1,
      unit: "ms",
    },
    {
      default: 200,
      id: "releaseMs",
      label: "Release",
      max: 2000,
      min: 1,
      scale: "log",
      step: 1,
      unit: "ms",
    },
  ],
});

export type CompanderState = DeviceState<typeof companderDevice.parameters>;

/** The numbers that go on the worklet for a state, in the manifest's units. Off, the sound goes round it. */
export function companderSettings(state: CompanderState) {
  return {
    modelParams: {
      attack: state.attackMs,
      out0: state.out0Db,
      out1: state.out1Db,
      out2: state.out2Db,
      out3: state.out3Db,
      release: state.releaseMs,
    },
    wet: state.enabled ? 1 : 0,
  };
}

/** The rate the compander runs at to be measured: a steady level settles the same at any rate, and this one is cheap. */
const CURVE_RATE = 1000;

/**
 * The curve a state plays: the level out in dB for a level in, once it has
 * settled, measured from the package's own stream run on a steady level for
 * ten of its attacks, a decibel apart, read in between in a line.
 */
export function companderCurve(state: CompanderState) {
  if (!state.enabled) {
    return (inputDb: number) => inputDb;
  }
  const points = COMPANDER_POINTS_DB.map((inDb, index): [number, number] => [
    inDb,
    state[COMPANDER_POINTS[index] ?? "out0Db"],
  ]);
  const levels: number[] = [];
  const block = new Float32Array(
    Math.max(512, Math.ceil(((10 * state.attackMs) / 1000) * CURVE_RATE))
  );
  for (let db = -90; db <= 0; db += 1) {
    const stream = compandStream({
      attack: state.attackMs,
      points,
      release: state.releaseMs,
      sampleRate: CURVE_RATE,
    });
    block.fill(10 ** (db / 20));
    const out = stream.write(block);
    levels.push(20 * Math.log10(Math.abs(out.at(-1) ?? 0) + 1e-30));
  }
  return (inputDb: number) => {
    const at = Math.min(Math.max(inputDb + 90, 0), levels.length - 1);
    const below = Math.min(Math.floor(at), levels.length - 2);
    const from = levels[below] ?? 0;
    const to = levels[below + 1] ?? from;
    return from + (at - below) * (to - from) + Math.min(0, inputDb + 90);
  };
}

/**
 * The source of the compander's `AudioWorklet`, processor
 * `audioui-compander`: the manifest of `@audio/dynamics-compand`, played by
 * `manifestWorklet`. Every parameter makes it again.
 */
export const COMPANDER_WORKLET = manifestWorklet({
  kernels: COMPANDER_KERNELS,
  models: { compander: "compand" },
  processor: "audioui-compander",
});
