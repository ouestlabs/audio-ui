import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/**
 * A gate as a device: it lets a signal through above a threshold and turns it
 * down to a floor below it, with an attack and a release for how fast it opens
 * and closes, a hold for how long it stays open once the level has dropped, and
 * a look-ahead that delays the signal so the gate is open before a transient
 * arrives, and no panel and no audio in it. It takes a sidechain: with `external` on, its
 * level is the one of the signal connected to the engine's `sidechain` input,
 * so a kick can open a held chord.
 */
/** The longest look-ahead, in milliseconds: the delay the engine makes room for. */
export const MAX_LOOKAHEAD_MS = 10;

export const gateDevice = defineDevice({
  description:
    "Cleans up between sounds: above the threshold the signal passes, below it the signal is turned down to the floor. The attack and the release say how fast it opens and closes, the hold how long it stays open after the level drops, and the look-ahead delays the signal so the gate is open before a transient arrives. With the sidechain on, the level it follows is the one of another signal.",
  id: "audioui.gate",
  // The look-ahead delays the signal, and so the device; off, the signal goes straight through.
  latency: (state) => (state.enabled ? state.lookaheadMs / 1000 : 0),
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
    {
      default: 1,
      id: "attackMs",
      label: "Attack",
      max: 50,
      min: 0.1,
      scale: "log",
      step: 0.1,
      unit: "ms",
    },
    {
      default: 30,
      id: "holdMs",
      label: "Hold",
      max: 500,
      min: 0,
      step: 1,
      unit: "ms",
    },
    {
      default: 120,
      id: "releaseMs",
      label: "Release",
      max: 2000,
      min: 5,
      scale: "log",
      step: 1,
      unit: "ms",
    },
    {
      default: 0,
      id: "lookaheadMs",
      label: "Look-ahead",
      max: MAX_LOOKAHEAD_MS,
      min: 0,
      step: 0.5,
      unit: "ms",
    },
    { default: false, id: "external", kind: "toggle", label: "Sidechain" },
  ],
});

export type GateState = DeviceState<typeof gateDevice.parameters>;

const toGain = (db: number) => 10 ** (db / 20);

/** The numbers that go on the nodes for a state. Off, the gate is fully open. */
export function gateSettings(state: GateState) {
  return {
    attack: state.attackMs / 1000,
    floor: state.enabled ? toGain(state.floorDb) : 1,
    hold: state.holdMs / 1000,
    lookahead: state.enabled ? state.lookaheadMs / 1000 : 0,
    // Which signal the level is measured on: the key when it is on, the signal itself otherwise.
    outerKey: state.external ? 1 : 0,
    ownKey: state.external ? 0 : 1,
    release: state.releaseMs / 1000,
    threshold: toGain(state.thresholdDb),
  };
}

/**
 * The processor of the gate, as the source of an `AudioWorklet`. It reads the
 * key and writes the gain to apply, one value per sample: the level is a peak
 * follower (instant up, a few milliseconds down, so a low note does not make
 * the gate chatter at every zero crossing), the gate is open while the level is
 * over the threshold and for the hold after, and the gain starts at the floor and moves toward 1 or the
 * floor with the attack or the release as a time constant. The engine loads it
 * from a blob, so there is no file to serve.
 */
export const GATE_WORKLET = `
class AudioUiGate extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "threshold", defaultValue: 0.016, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "floor", defaultValue: 0.001, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "attack", defaultValue: 0.001, minValue: 0.00005, maxValue: 1, automationRate: "k-rate" },
      { name: "hold", defaultValue: 0.03, minValue: 0, maxValue: 5, automationRate: "k-rate" },
      { name: "release", defaultValue: 0.12, minValue: 0.001, maxValue: 10, automationRate: "k-rate" }
    ];
  }
  constructor() {
    super();
    this.level = 0;
    this.gain = -1;
    this.holdLeft = 0;
  }
  process(inputs, outputs, parameters) {
    const key = inputs[0];
    const out = outputs[0][0];
    if (!out) return true;
    const threshold = parameters.threshold[0];
    const floor = parameters.floor[0];
    const holdSamples = parameters.hold[0] * sampleRate;
    const attack = 1 - Math.exp(-1 / (parameters.attack[0] * sampleRate));
    const release = 1 - Math.exp(-1 / (parameters.release[0] * sampleRate));
    const fall = Math.exp(-1 / (0.005 * sampleRate));
    if (this.gain < 0) this.gain = floor;
    for (let n = 0; n < out.length; n += 1) {
      let peak = 0;
      for (let c = 0; c < key.length; c += 1) {
        const v = Math.abs(key[c][n]);
        if (v > peak) peak = v;
      }
      this.level = peak > this.level ? peak : this.level * fall;
      if (this.level >= threshold) this.holdLeft = holdSamples;
      else if (this.holdLeft > 0) this.holdLeft -= 1;
      const target = this.level >= threshold || this.holdLeft > 0 ? 1 : floor;
      this.gain += (target - this.gain) * (target > this.gain ? attack : release);
      out[n] = this.gain;
    }
    return true;
  }
}
registerProcessor("audioui-gate", AudioUiGate);
`;

/** The curve a state plays: the output level in dB for an input level in dB. */
export function gateCurve(state: GateState) {
  if (!state.enabled) {
    return (inputDb: number) => inputDb;
  }
  return (inputDb: number) =>
    inputDb >= state.thresholdDb ? inputDb : inputDb + state.floorDb;
}
