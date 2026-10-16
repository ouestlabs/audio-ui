import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/**
 * A chorus as a device: a short delay swept by a slow oscillator, mixed with
 * the dry sound, with no panel and no audio in it.
 */
export const chorusDevice = defineDevice({
  description:
    "Thickens the sound: a short delay whose time is swept up and down by a slow oscillator (the rate and the depth), mixed with the dry sound so the two drift apart.",
  id: "audioui.chorus",
  name: "Chorus",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 0.8,
      id: "rateHz",
      label: "Rate",
      max: 8,
      min: 0.05,
      scale: "log",
      step: 0.05,
      unit: "Hz",
    },
    {
      default: 40,
      id: "depth",
      label: "Depth",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 18,
      id: "delayMs",
      label: "Delay",
      max: 40,
      min: 5,
      step: 0.5,
      unit: "ms",
    },
    {
      default: 50,
      id: "mix",
      label: "Mix",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
  ],
});

export type ChorusState = DeviceState<typeof chorusDevice.parameters>;

/** The longest sweep either side of the delay time, in milliseconds, at full depth. */
const MAX_SWEEP_MS = 8;

/** The numbers that go on the nodes for a state. The sweep is kept inside the delay so the time never goes negative. */
export function chorusSettings(state: ChorusState) {
  const mix = state.enabled ? state.mix / 100 : 0;
  const sweepMs = Math.min(
    state.delayMs - 1,
    (MAX_SWEEP_MS * state.depth) / 100
  );
  return {
    delay: state.delayMs / 1000,
    dry: 1 - mix,
    rate: state.rateHz,
    sweep: sweepMs / 1000,
    wet: mix,
  };
}

/** The delay time in milliseconds at `seconds`, as the oscillator sweeps it: what the panel draws. */
export function chorusSweep(state: ChorusState) {
  const { delay, rate, sweep } = chorusSettings(state);
  return (seconds: number) =>
    (delay + sweep * Math.sin(2 * Math.PI * rate * seconds)) * 1000;
}
