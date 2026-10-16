import { type DeviceState, defineDevice } from "@audio-ui/core/device";

const TABLE_SAMPLES = 2048;

/**
 * A gate as a device: it lets a signal through above a threshold and turns it
 * down to a floor below it, with a response for how fast it opens and closes,
 * and no panel and no audio in it. It takes a key: with `external` on, its
 * level is the one of the signal connected to the engine's `sidechain` input,
 * so a kick can open a held chord.
 */
export const gateDevice = defineDevice({
  description:
    "Cleans up between sounds: above the threshold the signal passes, below it the signal is turned down to the floor, with a response for how fast the gate follows the level. With the key on, the level it follows is the one of another signal, the sidechain.",
  id: "audioui.gate",
  name: "Gate",
  sidechain: true,
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: -36,
      id: "thresholdDb",
      label: "Threshold",
      max: 0,
      min: -70,
      step: 0.5,
      unit: "dB",
    },
    {
      default: -60,
      id: "floorDb",
      label: "Floor",
      max: 0,
      min: -80,
      step: 1,
      unit: "dB",
    },
    { default: false, id: "external", kind: "toggle", label: "Key" },
    {
      default: 30,
      id: "responseMs",
      label: "Response",
      max: 500,
      min: 1,
      scale: "log",
      step: 1,
      unit: "ms",
    },
  ],
});

export type GateState = DeviceState<typeof gateDevice.parameters>;

const toGain = (db: number) => 10 ** (db / 20);

/** The numbers that go on the nodes for a state. Off, the gate is fully open. */
export function gateSettings(state: GateState) {
  return {
    // Which signal the level is measured on: the key when it is on, the signal itself otherwise.
    ownKey: state.external ? 0 : 1,
    outerKey: state.external ? 1 : 0,
    floor: state.enabled ? toGain(state.floorDb) : 1,
    // A one-pole low-pass of the rectified signal: its cutoff gives the response time.
    smoothingHz: 1 / (2 * Math.PI * (state.responseMs / 1000)),
    threshold: toGain(state.thresholdDb),
  };
}

/**
 * The table of a `WaveShaperNode` that turns the smoothed level (0 to 1) into
 * a gain: the floor under the threshold, 1 above it. The first half of the
 * table (negative inputs) is never reached by a level.
 */
export function gateTable(
  state: Pick<GateState, "enabled" | "floorDb" | "thresholdDb">
): Float32Array<ArrayBuffer> {
  const { floor, threshold } = gateSettings({
    ...(gateDevice.defaults() as GateState),
    ...state,
  });
  const table = new Float32Array(new ArrayBuffer(TABLE_SAMPLES * 4));
  for (let index = 0; index < TABLE_SAMPLES; index += 1) {
    const level = (index * 2) / (TABLE_SAMPLES - 1) - 1;
    table[index] = level >= threshold ? 1 : floor;
  }
  return table;
}

/** The curve a state plays: the output level in dB for an input level in dB. */
export function gateCurve(state: GateState) {
  if (!state.enabled) {
    return (inputDb: number) => inputDb;
  }
  return (inputDb: number) =>
    inputDb >= state.thresholdDb ? inputDb : inputDb + state.floorDb;
}
