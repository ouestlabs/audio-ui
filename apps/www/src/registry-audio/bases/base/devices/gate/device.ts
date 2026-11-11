import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import { GATE_KERNELS } from "@audio-ui/engine/kernels";
import { manifestWorklet } from "@/registry-audio/bases/base/lib/manifest-worklet";

/**
 * A gate as a device: it lets a signal through above a threshold and turns it
 * down to a floor below it, with an attack and a release for how fast it opens
 * and closes, a hold for how long it stays open once the level has dropped, and
 * a look-ahead that delays the signal so the gate is open before a transient
 * arrives, and no panel and no audio in it. It is the gate of
 * `@audio/dynamics-gate`, which closes only under a lower threshold than the
 * one it opens at.
 */
/** The longest look-ahead, in milliseconds. */
export const MAX_LOOKAHEAD_MS = 10;

export const gateDevice = defineDevice({
  description:
    "Cleans up between sounds: above the threshold the signal passes, below it the signal is turned down to the floor. The attack and the release say how fast it opens and closes, the hold how long it stays open after the level drops, and the look-ahead delays the signal so the gate is open before a transient arrives. Once open it closes only when the level falls the hysteresis under the threshold, so a level around the threshold does not make it chatter.",
  id: "audioui.gate",
  // The look-ahead delays the signal, and so the device; off, the signal goes straight through.
  latency: (state) => (state.enabled ? state.lookaheadMs / 1000 : 0),
  name: "Gate",
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
      default: 6,
      id: "hysteresisDb",
      label: "Hysteresis",
      max: 24,
      min: 0,
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
  ],
});

export type GateState = DeviceState<typeof gateDevice.parameters>;

/** The numbers that go on the worklet for a state, in its manifest's units: it closes the hysteresis under the threshold. Off, the gate is fully open. */
export function gateSettings(state: GateState) {
  return {
    modelParams: {
      attack: state.attackMs,
      closeThreshold: state.thresholdDb - state.hysteresisDb,
      hold: state.holdMs,
      lookahead: state.enabled ? state.lookaheadMs : 0,
      range: state.enabled ? state.floorDb : 0,
      release: state.releaseMs,
      threshold: state.thresholdDb,
    },
  };
}

/** The curve a state plays: the output level in dB for an input level in dB. */
export function gateCurve(state: GateState) {
  if (!state.enabled) {
    return (inputDb: number) => inputDb;
  }
  return (inputDb: number) =>
    inputDb >= state.thresholdDb ? inputDb : inputDb + state.floorDb;
}

/**
 * The source of the gate's `AudioWorklet`, processor `audioui-gate`: the
 * manifest of `@audio/dynamics-gate`, played by `manifestWorklet`. Every
 * parameter makes it again.
 */
export const GATE_WORKLET = manifestWorklet({
  kernels: GATE_KERNELS,
  models: { noise: "gate" },
  processor: "audioui-gate",
});
